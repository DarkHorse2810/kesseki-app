import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const password = (body as { password?: unknown } | null)?.password;

  if (typeof password !== "string" || password !== process.env.SETTINGS_PASSWORD) {
    return NextResponse.json({ error: "パスワードが違います" }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
