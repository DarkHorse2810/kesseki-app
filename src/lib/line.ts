import crypto from "node:crypto";

export function verifyLineSignature(rawBody: string, signature: string | null): boolean {
  if (!signature) return false;
  const secret = process.env.LINE_CHANNEL_SECRET;
  if (!secret) return false;

  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("base64");
  return expected === signature;
}

async function callLineApi(path: string, body: unknown) {
  const res = await fetch(`https://api.line.me/v2/bot/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`LINE API error (${res.status}): ${text}`);
  }
}

export function replyMessage(replyToken: string, text: string) {
  return callLineApi("message/reply", {
    replyToken,
    messages: [{ type: "text", text }],
  });
}

export function pushMessage(to: string, text: string) {
  return callLineApi("message/push", {
    to,
    messages: [{ type: "text", text }],
  });
}
