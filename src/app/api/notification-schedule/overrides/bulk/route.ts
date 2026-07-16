import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "リクエストボディが不正です" }, { status: 400 });
  }

  const { password, overrides } = body as { password?: unknown; overrides?: unknown };
  if (typeof password !== "string" || password !== process.env.SETTINGS_PASSWORD) {
    return NextResponse.json({ error: "パスワードが違います" }, { status: 401 });
  }

  if (!Array.isArray(overrides) || overrides.length === 0) {
    return NextResponse.json({ error: "リクエストボディが不正です" }, { status: 400 });
  }

  const parsed: { date: Date; time: string | null }[] = [];
  for (const entry of overrides as unknown[]) {
    const { date, time } = (entry ?? {}) as { date?: unknown; time?: unknown };

    if (typeof date !== "string" || date.trim().length === 0) {
      return NextResponse.json({ error: "日付の指定が不正です" }, { status: 400 });
    }
    const parsedDate = new Date(date);
    if (Number.isNaN(parsedDate.getTime())) {
      return NextResponse.json({ error: "日付の指定が不正です" }, { status: 400 });
    }
    if (time !== null && (typeof time !== "string" || !TIME_PATTERN.test(time))) {
      return NextResponse.json({ error: "時刻はHH:MM形式で指定してください" }, { status: 400 });
    }

    parsed.push({ date: parsedDate, time: (time as string | null) ?? null });
  }

  const rows = await prisma.$transaction(
    parsed.map(({ date, time }) =>
      prisma.dateOverride.upsert({
        where: { date },
        update: { time },
        create: { date, time },
      }),
    ),
  );

  return NextResponse.json({ overrides: rows }, { status: 201 });
}
