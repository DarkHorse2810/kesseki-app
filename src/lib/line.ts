import crypto from "node:crypto";

// Environment variables copy-pasted from a dashboard UI can easily pick up a
// trailing newline or stray whitespace, which silently breaks signature
// checks and API calls. Trim defensively wherever we read one.
function trimmedEnv(name: string): string | undefined {
  return process.env[name]?.trim() || undefined;
}

export function verifyLineSignature(rawBody: string, signature: string | null): boolean {
  if (!signature) return false;
  const secret = trimmedEnv("LINE_CHANNEL_SECRET");
  if (!secret) return false;

  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("base64");
  return expected === signature.trim();
}

async function callLineApi(path: string, body: unknown) {
  const res = await fetch(`https://api.line.me/v2/bot/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${trimmedEnv("LINE_CHANNEL_ACCESS_TOKEN")}`,
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
    to: to.trim(),
    messages: [{ type: "text", text }],
  });
}
