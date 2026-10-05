import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateCurrentGrade } from "@/lib/grade";
import { pushMessage } from "@/lib/line";
import { getEffectiveSchedule } from "@/lib/notificationSchedule";

const NON_PLAYER_POSITIONS = new Set(["MANAGER", "ANALYST"]);
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
// NotificationLog.time prefix for early-leave sends, followed by the highest
// Absence id included so far (e.g. "early:42").
const EARLY_LEAVE_LOG_PREFIX = "early:";

function jstWallClock(date: Date) {
  const shifted = new Date(date.getTime() + JST_OFFSET_MS);
  return {
    dateKey: shifted.toISOString().slice(0, 10),
    minutesSinceMidnight: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
  };
}

function minutesFromTimeString(time: string): number {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

// `afterId` limits the message to reports newer than that Absence id.
async function buildAbsenceMessage(todayUtcMidnight: Date, headerLabel: string, afterId?: number) {
  const rangeStart = todayUtcMidnight;
  const rangeEnd = new Date(todayUtcMidnight.getTime() + 24 * 60 * 60 * 1000);

  const absences = await prisma.absence.findMany({
    where: {
      date: { gte: rangeStart, lt: rangeEnd },
      ...(afterId !== undefined ? { id: { gt: afterId } } : {}),
    },
    include: { player: { include: { positions: true } } },
    orderBy: [{ date: "asc" }, { id: "asc" }],
  });

  const items = absences.map((absence) => ({
    grade: calculateCurrentGrade(absence.player.baseGrade, absence.player.baseYear, absence.date),
    name: absence.player.name,
    reason: absence.reason,
    isNonPlayer: absence.player.positions.some((p) => NON_PLAYER_POSITIONS.has(p.position)),
  }));

  const nonPlayerCount = items.filter((item) => item.isNonPlayer).length;

  const lines = [`${headerLabel}　${items.length}名（${nonPlayerCount}名）`];
  if (items.length === 0) {
    lines.push("本日の欠席者はいません。");
  } else {
    for (const item of items) {
      lines.push(`${item.grade}年${item.name}　${item.reason}`);
    }
  }

  return {
    message: lines.join("\n"),
    count: items.length,
    maxId: absences.reduce((max, absence) => Math.max(max, absence.id), 0),
  };
}

async function sendToRecipients(
  todayUtcMidnight: Date,
  logTime: string,
  recipients: { lineUserId: string }[],
  message: string,
) {
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
    data: { date: todayUtcMidnight, time: logTime },
  });

  return failures;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")?.trim();
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const { dateKey, minutesSinceMidnight } = jstWallClock(now);
  const todayUtcMidnight = new Date(`${dateKey}T00:00:00.000Z`);

  // Absence reports and past schedule items are only meant to cover today
  // going forward, so once a day has passed, drop its entries rather than
  // let old data pile up. This runs on every call (not just when a
  // notification is due) since the external cron hits this endpoint every
  // minute regardless.
  await prisma.absence.deleteMany({ where: { date: { lt: todayUtcMidnight } } });
  await prisma.scheduleItem.deleteMany({ where: { date: { lt: todayUtcMidnight } } });

  const recipients = await prisma.notificationRecipient.findMany();
  if (recipients.length === 0) {
    return NextResponse.json({ error: "通知先が登録されていません" }, { status: 500 });
  }

  const schedule = await getEffectiveSchedule(todayUtcMidnight);
  const scheduledTime = schedule.time;

  // Normal roll-call day: send at scheduledTime regardless of headcount.
  if (scheduledTime) {
    // Cron checks land at irregular intervals rather than exactly every 5
    // minutes, so instead of matching a narrow time window we just wait
    // until the scheduled time has passed. The (date, time) log below is
    // what prevents duplicate sends once it has.
    if (minutesSinceMidnight < minutesFromTimeString(scheduledTime)) {
      return NextResponse.json({ ok: true, skipped: "not-time-yet" });
    }

    const alreadySent = await prisma.notificationLog.findUnique({
      where: { date_time: { date: todayUtcMidnight, time: scheduledTime } },
    });
    if (alreadySent) {
      return NextResponse.json({ ok: true, skipped: "already-sent" });
    }

    const { message, count } = await buildAbsenceMessage(todayUtcMidnight, "今日の欠席");
    const failures = await sendToRecipients(todayUtcMidnight, scheduledTime, recipients, message);

    if (failures.length > 0) {
      return NextResponse.json(
        { ok: failures.length < recipients.length, sent: count, failures },
        { status: failures.length === recipients.length ? 502 : 200 },
      );
    }
    return NextResponse.json({ ok: true, sent: count, recipients: recipients.length });
  }

  // No roll-call scheduled today. If early-leave sending is on for this
  // date, send a "今日の早退" summary once earlyLeaveTime has passed, but only
  // when there's at least one report.
  if (!schedule.earlyLeaveSend || !schedule.earlyLeaveTime) {
    return NextResponse.json({ ok: true, skipped: "no-schedule-today" });
  }

  if (minutesSinceMidnight < minutesFromTimeString(schedule.earlyLeaveTime)) {
    return NextResponse.json({ ok: true, skipped: "not-time-yet" });
  }

  // People report leaving early throughout the day, so this isn't a
  // one-shot send like the roll-call: each cron call sends whatever has been
  // reported since the last send. The log entry records the newest Absence
  // id already sent, so every report goes out exactly once.
  const earlierSends = await prisma.notificationLog.findMany({
    where: { date: todayUtcMidnight, time: { startsWith: EARLY_LEAVE_LOG_PREFIX } },
  });
  const lastSentId = earlierSends.reduce(
    (max, log) => Math.max(max, Number(log.time.slice(EARLY_LEAVE_LOG_PREFIX.length)) || 0),
    0,
  );

  const { message, count, maxId } = await buildAbsenceMessage(
    todayUtcMidnight,
    "今日の早退",
    lastSentId,
  );
  if (count === 0) {
    // Nothing new reported (yet) — later cron calls keep checking in case
    // someone reports before the day rolls over.
    return NextResponse.json({ ok: true, skipped: "no-early-leave-reports" });
  }

  const failures = await sendToRecipients(
    todayUtcMidnight,
    `${EARLY_LEAVE_LOG_PREFIX}${maxId}`,
    recipients,
    message,
  );

  if (failures.length > 0) {
    return NextResponse.json(
      { ok: failures.length < recipients.length, sent: count, failures },
      { status: failures.length === recipients.length ? 502 : 200 },
    );
  }
  return NextResponse.json({ ok: true, sent: count, recipients: recipients.length });
}
