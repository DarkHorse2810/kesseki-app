import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function GET() {
  const overrides = await prisma.dateOverride.findMany({ orderBy: { date: "asc" } });
  return NextResponse.json({ overrides });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "リクエストボディが不正です" }, { status: 400 });
  }

  const { password, date, time, earlyLeaveSend, earlyLeaveTime } = body as {
    password?: unknown;
    date?: unknown;
    time?: unknown;
    earlyLeaveSend?: unknown;
    earlyLeaveTime?: unknown;
  };

  if (typeof password !== "string" || password !== process.env.SETTINGS_PASSWORD) {
    return NextResponse.json({ error: "パスワードが違います" }, { status: 401 });
  }

  if (typeof date !== "string" || date.trim().length === 0) {
    return NextResponse.json({ error: "日付を入力してください" }, { status: 400 });
  }

  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) {
    return NextResponse.json({ error: "日付を正しく入力してください" }, { status: 400 });
  }

  if (time !== null && time !== undefined && (typeof time !== "string" || !TIME_PATTERN.test(time))) {
    return NextResponse.json({ error: "時刻はHH:MM形式で指定してください" }, { status: 400 });
  }

  if (
    earlyLeaveTime !== null &&
    earlyLeaveTime !== undefined &&
    (typeof earlyLeaveTime !== "string" || !TIME_PATTERN.test(earlyLeaveTime))
  ) {
    return NextResponse.json({ error: "早退送信の時刻はHH:MM形式で指定してください" }, { status: 400 });
  }

  const data = {
    time: (time as string | null | undefined) ?? null,
    earlyLeaveSend: typeof earlyLeaveSend === "boolean" ? earlyLeaveSend : true,
    earlyLeaveTime: (earlyLeaveTime as string | null | undefined) ?? null,
  };

  const override = await prisma.dateOverride.upsert({
    where: { date: parsedDate },
    update: data,
    create: { date: parsedDate, ...data },
  });

  return NextResponse.json({ override }, { status: 201 });
}
