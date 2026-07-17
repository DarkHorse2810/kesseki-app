import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateCurrentGrade } from "@/lib/grade";
import { getEffectiveSchedule } from "@/lib/notificationSchedule";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const dateParam = searchParams.get("date");
  const yearParam = searchParams.get("year");
  const monthParam = searchParams.get("month");

  let rangeStart: Date | undefined;
  let rangeEnd: Date | undefined;
  let sortOrder: "asc" | "desc" = "asc";

  if (dateParam) {
    const day = new Date(dateParam);
    if (Number.isNaN(day.getTime())) {
      return NextResponse.json({ error: "date を正しく指定してください" }, { status: 400 });
    }
    rangeStart = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()));
    rangeEnd = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate() + 1));
  } else if (yearParam || monthParam) {
    const year = Number(yearParam);
    const month = Number(monthParam);

    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
      return NextResponse.json(
        { error: "year, month または date を正しく指定してください" },
        { status: 400 },
      );
    }

    rangeStart = new Date(Date.UTC(year, month - 1, 1));
    rangeEnd = new Date(Date.UTC(year, month, 1));
  } else {
    // No filters: return the full history, newest first (used by the
    // settings "欠席削除" list).
    sortOrder = "desc";
  }

  const absences = await prisma.absence.findMany({
    where: rangeStart && rangeEnd ? { date: { gte: rangeStart, lt: rangeEnd } } : undefined,
    include: { player: { include: { positions: true } } },
    orderBy: { date: sortOrder },
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
  const dateUtcMidnight = new Date(
    Date.UTC(parsedDate.getUTCFullYear(), parsedDate.getUTCMonth(), parsedDate.getUTCDate()),
  );

  if (typeof reason !== "string" || reason.trim().length === 0) {
    return NextResponse.json({ error: "理由を入力してください" }, { status: 400 });
  }

  const player = await prisma.player.findUnique({ where: { id: playerIdNumber } });
  if (!player) {
    return NextResponse.json({ error: "選択された選手が見つかりません" }, { status: 400 });
  }

  const schedule = await getEffectiveSchedule(dateUtcMidnight);
  if (schedule.time === null && !schedule.earlyLeaveSend) {
    return NextResponse.json(
      { error: "この日は欠席連絡を受け付けていません" },
      { status: 400 },
    );
  }

  const trimmedReason = reason.trim();
  const absence = await prisma.absence.create({
    data: { playerId: playerIdNumber, date: dateUtcMidnight, reason: trimmedReason },
  });

  return NextResponse.json({ absences: [absence] }, { status: 201 });
}
