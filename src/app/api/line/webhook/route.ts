import { NextResponse } from "next/server";
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

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-line-signature");

  if (!verifyLineSignature(rawBody, signature)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  const body = JSON.parse(rawBody) as { events?: LineEvent[] };

  for (const event of body.events ?? []) {
    if (!event.replyToken) continue;

    // Fired the moment the bot is added to a group or room.
    if (event.type === "join") {
      await replyMessage(
        event.replyToken,
        `このグループ/ルームのIDです。管理者に伝えてください。\n\n${describeSource(event.source)}`,
      ).catch(() => {});
      continue;
    }

    if (event.type === "message" && event.message?.type === "text") {
      await replyMessage(
        event.replyToken,
        `あなたのLINE ${event.source?.type === "user" ? "User ID" : "グループ/ルームID"}です。管理者に伝えてください。\n\n${describeSource(event.source)}`,
      ).catch(() => {});
    }
  }

  return NextResponse.json({ ok: true });
}
