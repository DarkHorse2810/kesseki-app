import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateCurrentGrade } from "@/lib/grade";
import { pushMessage } from "@/lib/line";

const NON_PLAYER_POSITIONS = new Set(["MANAGER", "ANALYST"]);
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

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
  const authHeader = request.headers.get("authorization")?.trim();
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const { dateKey, weekday, minutesSinceMidnight } = jstWallClock(now);
  const todayUtcMidnight = new Date(`${dateKey}T00:00:00.000Z`);

  // Absence reports are only meant to cover today going forward, so once a
  // day has passed, drop its entries rather than let old reports pile up.
  // This runs on every call (not just when a notification is due) since the
  // external cron hits this endpoint every minute regardless.
  await prisma.absence.deleteMany({ where: { date: { lt: todayUtcMidnight } } });

  const recipients = await prisma.notificationRecipient.findMany();
  if (recipients.length === 0) {
    return NextResponse.json({ error: "通知先が登録されていません" }, { status: 500 });
  }

  const override = await prisma.dateOverride.findUnique({ where: { date: todayUtcMidnight } });
  const weekdayRow = override
    ? null
    : await prisma.weekdaySchedule.findUnique({ where: { weekday } });

  const scheduledTime = override ? override.time : weekdayRow?.time ?? null;
  if (!scheduledTime) {
    return NextResponse.json({ ok: true, skipped: "no-schedule-today" });
  }

  // Cron checks land at irregular intervals rather than exactly every 5
  // minutes, so instead of matching a narrow time window we just wait until
  // the scheduled time has passed. The (date, time) log below is what
  // prevents duplicate sends once it has.
  if (minutesSinceMidnight < minutesFromTimeString(scheduledTime)) {
    return NextResponse.json({ ok: true, skipped: "not-time-yet" });
  }

  const alreadySent = await prisma.notificationLog.findUnique({
    where: { date_time: { date: todayUtcMidnight, time: scheduledTime } },
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

  const message = lines.join("\n");
  const failures: { lineUserId: string; detail: string }[] = [];

  for (const recipient of recipients) {
    try {
      await pushMessage(recipient.lineUserId, message);
    } catch (error) {
      failures.push({
        lineUserId: recipient.lineUserId,
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Record this (date, time) as "sent" even if some recipients failed, so a
  // bad recipient doesn't cause it to be retried indefinitely.
  await prisma.notificationLog.create({
    data: { date: todayUtcMidnight, time: scheduledTime },
  });

  if (failures.length > 0) {
    return NextResponse.json(
      { ok: failures.length < recipients.length, sent: items.length, failures },
      { status: failures.length === recipients.length ? 502 : 200 },
    );
  }

  return NextResponse.json({ ok: true, sent: items.length, recipients: recipients.length });
}
