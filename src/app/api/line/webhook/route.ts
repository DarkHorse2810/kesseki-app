import { NextResponse } from "next/server";
import { replyMessage, verifyLineSignature } from "@/lib/line";

type LineEvent = {
  type: string;
  replyToken?: string;
  source?: { userId?: string };
  message?: { type: string; text?: string };
};

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-line-signature");

  if (!verifyLineSignature(rawBody, signature)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  const body = JSON.parse(rawBody) as { events?: LineEvent[] };

  for (const event of body.events ?? []) {
    if (event.type === "message" && event.message?.type === "text" && event.replyToken) {
      const userId = event.source?.userId ?? "(取得できませんでした)";
      await replyMessage(
        event.replyToken,
        `あなたのLINE User IDです。管理者に伝えてください。\n\n${userId}`,
      ).catch(() => {});
    }
  }

  return NextResponse.json({ ok: true });
}
