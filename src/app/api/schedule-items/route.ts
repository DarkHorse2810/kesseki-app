import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const year = Number(searchParams.get("year"));
  const month = Number(searchParams.get("month"));

  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: "year, month を正しく指定してください" }, { status: 400 });
  }

  const rangeStart = new Date(Date.UTC(year, month - 1, 1));
  const rangeEnd = new Date(Date.UTC(year, month, 1));

  const items = await prisma.scheduleItem.findMany({
    where: { date: { gte: rangeStart, lt: rangeEnd } },
    orderBy: { date: "asc" },
  });

  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "リクエストボディが不正です" }, { status: 400 });
  }

  const { date, text } = body as { date?: unknown; text?: unknown };

  if (typeof date !== "string" || date.trim().length === 0) {
    return NextResponse.json({ error: "日付を入力してください" }, { status: 400 });
  }

  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) {
    return NextResponse.json({ error: "日付を正しく入力してください" }, { status: 400 });
  }

  if (typeof text !== "string" || text.trim().length === 0) {
    return NextResponse.json({ error: "予定の内容を入力してください" }, { status: 400 });
  }

  const item = await prisma.scheduleItem.create({
    data: { date: parsedDate, text: text.trim() },
  });

  return NextResponse.json({ item }, { status: 201 });
}
