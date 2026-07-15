import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateCurrentGrade } from "@/lib/grade";
import { pushMessage } from "@/lib/line";

const NON_PLAYER_POSITIONS = new Set(["MANAGER", "ANALYST"]);
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
// How close "now" must be to the configured send time to trigger a send.
// Needs to comfortably cover the ~15 minute gap between cron checks.
const MATCH_WINDOW_MINUTES = 10;

function jstWallClock(date: Date) {
  const shifted = new Date(date.getTime() + JST_OFFSET_MS);
  return {
    dateKey: shifted.toISOString().slice(0, 10),
    weekday: shifted.getUTCDay(),
    minutesSinceMidnight: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
  };
}

function minutesFromTimeString(time: string): number {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const targetUserId = process.env.LINE_TARGET_USER_ID;
  if (!targetUserId) {
    return NextResponse.json({ error: "LINE_TARGET_USER_ID が未設定です" }, { status: 500 });
  }

  const now = new Date();
  const { dateKey, weekday, minutesSinceMidnight } = jstWallClock(now);
  const todayUtcMidnight = new Date(`${dateKey}T00:00:00.000Z`);

  const override = await prisma.dateOverride.findUnique({ where: { date: todayUtcMidnight } });
  const weekdayRow = override
    ? null
    : await prisma.weekdaySchedule.findUnique({ where: { weekday } });

  const scheduledTime = override ? override.time : weekdayRow?.time ?? null;
  if (!scheduledTime) {
    return NextResponse.json({ ok: true, skipped: "no-schedule-today" });
  }

  const diff = Math.abs(minutesSinceMidnight - minutesFromTimeString(scheduledTime));
  if (diff > MATCH_WINDOW_MINUTES) {
    return NextResponse.json({ ok: true, skipped: "not-time-yet" });
  }

  const alreadySent = await prisma.notificationLog.findUnique({
    where: { date: todayUtcMidnight },
  });
  if (alreadySent) {
    return NextResponse.json({ ok: true, skipped: "already-sent" });
  }

  const rangeStart = todayUtcMidnight;
  const rangeEnd = new Date(todayUtcMidnight.getTime() + 24 * 60 * 60 * 1000);

  const absences = await prisma.absence.findMany({
    where: { date: { gte: rangeStart, lt: rangeEnd } },
    include: { player: { include: { positions: true } } },
    orderBy: { date: "asc" },
  });

  const items = absences.map((absence) => ({
    grade: calculateCurrentGrade(absence.player.baseGrade, absence.player.baseYear, absence.date),
    name: absence.player.name,
    reason: absence.reason,
    isNonPlayer: absence.player.positions.some((p) => NON_PLAYER_POSITIONS.has(p.position)),
  }));

  const nonPlayerCount = items.filter((item) => item.isNonPlayer).length;

  const lines = [`今日の欠席　${items.length}名（${nonPlayerCount}名）`];
  if (items.length === 0) {
    lines.push("本日の欠席者はいません。");
  } else {
    for (const item of items) {
      lines.push(`${item.grade}年${item.name}　${item.reason}`);
    }
  }

  await pushMessage(targetUserId, lines.join("\n"));
  await prisma.notificationLog.create({ data: { date: todayUtcMidnight } });

  return NextResponse.json({ ok: true, sent: items.length });
}
