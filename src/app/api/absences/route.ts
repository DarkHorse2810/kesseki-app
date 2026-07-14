import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateCurrentGrade } from "@/lib/grade";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const dateParam = searchParams.get("date");

  let rangeStart: Date;
  let rangeEnd: Date;

  if (dateParam) {
    const day = new Date(dateParam);
    if (Number.isNaN(day.getTime())) {
      return NextResponse.json({ error: "date を正しく指定してください" }, { status: 400 });
    }
    rangeStart = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()));
    rangeEnd = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate() + 1));
  } else {
    const year = Number(searchParams.get("year"));
    const month = Number(searchParams.get("month"));

    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
      return NextResponse.json(
        { error: "year, month または date を正しく指定してください" },
        { status: 400 },
      );
    }

    rangeStart = new Date(Date.UTC(year, month - 1, 1));
    rangeEnd = new Date(Date.UTC(year, month, 1));
  }

  const absences = await prisma.absence.findMany({
    where: { date: { gte: rangeStart, lt: rangeEnd } },
    include: { player: { include: { positions: true } } },
    orderBy: { date: "asc" },
  });

  const result = absences.map((absence) => ({
    id: absence.id,
    date: absence.date,
    reason: absence.reason,
    player: {
      id: absence.player.id,
      name: absence.player.name,
      currentGrade: calculateCurrentGrade(
        absence.player.baseGrade,
        absence.player.baseYear,
        absence.date,
      ),
      positions: absence.player.positions.map((p) => p.position),
    },
  }));

  return NextResponse.json({ absences: result });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "リクエストボディが不正です" }, { status: 400 });
  }

  const { playerId, date, reason } = body as {
    playerId?: unknown;
    date?: unknown;
    reason?: unknown;
  };

  const playerIdNumber = typeof playerId === "number" ? playerId : Number(playerId);
  if (!Number.isInteger(playerIdNumber)) {
    return NextResponse.json({ error: "選手を選択してください" }, { status: 400 });
  }

  if (typeof date !== "string" || date.trim().length === 0) {
    return NextResponse.json({ error: "日付を入力してください" }, { status: 400 });
  }

  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) {
    return NextResponse.json({ error: "日付を正しく入力してください" }, { status: 400 });
  }

  if (typeof reason !== "string" || reason.trim().length === 0) {
    return NextResponse.json({ error: "理由を入力してください" }, { status: 400 });
  }

  const player = await prisma.player.findUnique({ where: { id: playerIdNumber } });
  if (!player) {
    return NextResponse.json({ error: "選択された選手が見つかりません" }, { status: 400 });
  }

  const absence = await prisma.absence.create({
    data: {
      playerId: playerIdNumber,
      date: parsedDate,
      reason: reason.trim(),
    },
  });

  return NextResponse.json({ absence }, { status: 201 });
}
