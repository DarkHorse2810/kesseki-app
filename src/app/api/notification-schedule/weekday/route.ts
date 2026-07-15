import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function GET() {
  const rows = await prisma.weekdaySchedule.findMany({ orderBy: { weekday: "asc" } });
  return NextResponse.json({ schedule: rows });
}

export async function PUT(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "リクエストボディが不正です" }, { status: 400 });
  }

  const { password, schedule } = body as { password?: unknown; schedule?: unknown };
  if (typeof password !== "string" || password !== process.env.SETTINGS_PASSWORD) {
    return NextResponse.json({ error: "パスワードが違います" }, { status: 401 });
  }

  if (!Array.isArray(schedule)) {
    return NextResponse.json({ error: "リクエストボディが不正です" }, { status: 400 });
  }

  for (const entry of schedule as unknown[]) {
    const { weekday, time } = (entry ?? {}) as { weekday?: unknown; time?: unknown };
    if (
      typeof weekday !== "number" ||
      !Number.isInteger(weekday) ||
      weekday < 0 ||
      weekday > 6
    ) {
      return NextResponse.json({ error: "曜日の指定が不正です" }, { status: 400 });
    }
    if (time !== null && (typeof time !== "string" || !TIME_PATTERN.test(time))) {
      return NextResponse.json({ error: "時刻はHH:MM形式で指定してください" }, { status: 400 });
    }
  }

  await prisma.$transaction(
    (schedule as { weekday: number; time: string | null }[]).map((entry) =>
      prisma.weekdaySchedule.upsert({
        where: { weekday: entry.weekday },
        update: { time: entry.time },
        create: { weekday: entry.weekday, time: entry.time },
      }),
    ),
  );

  return NextResponse.json({ ok: true });
}
