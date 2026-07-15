import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { replyMessage, verifyLineSignature } from "@/lib/line";

type LineEvent = {
  type: string;
  replyToken?: string;
  source?: { type: string; userId?: string; groupId?: string; roomId?: string };
  message?: { type: string; text?: string };
};

function describeSource(source: LineEvent["source"]): string {
  if (!source) return "(取得できませんでした)";
  if (source.type === "group") return `グループID:\n${source.groupId}`;
  if (source.type === "room") return `ルームID:\n${source.roomId}`;
  return `User ID:\n${source.userId}`;
}

// Stable key per chat, so repeated events from the same group/room/user
// share one "already greeted" record.
function sourceKey(source: LineEvent["source"]): string | null {
  if (!source) return null;
  if (source.type === "group" && source.groupId) return `group:${source.groupId}`;
  if (source.type === "room" && source.roomId) return `room:${source.roomId}`;
  if (source.type === "user" && source.userId) return `user:${source.userId}`;
  return null;
}

async function hasBeenGreeted(key: string): Promise<boolean> {
  const row = await prisma.webhookGreetedSource.findUnique({ where: { id: key } });
  return row !== null;
}

async function markGreeted(key: string) {
  await prisma.webhookGreetedSource.upsert({
    where: { id: key },
    create: { id: key },
    update: {},
  });
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-line-signature");

  if (!verifyLineSignature(rawBody, signature)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  const body = JSON.parse(rawBody) as { events?: LineEvent[] };

  for (const event of body.events ?? []) {
    if (!event.replyToken) continue;

    const key = sourceKey(event.source);

    // Fired the moment the bot is added to a group or room.
    if (event.type === "join") {
      await replyMessage(
        event.replyToken,
        `このグループ/ルームのIDです。管理者に伝えてください。\n\n${describeSource(event.source)}`,
      ).catch(() => {});
      if (key) await markGreeted(key).catch(() => {});
      continue;
    }

    if (event.type === "message" && event.message?.type === "text") {
      // Once this chat has already been told its ID, stay quiet so the
      // group can have a normal conversation afterwards.
      if (key && (await hasBeenGreeted(key))) continue;

      await replyMessage(
        event.replyToken,
        `あなたのLINE ${event.source?.type === "user" ? "User ID" : "グループ/ルームID"}です。管理者に伝えてください。\n\n${describeSource(event.source)}`,
      ).catch(() => {});
      if (key) await markGreeted(key).catch(() => {});
    }
  }

  return NextResponse.json({ ok: true });
}
