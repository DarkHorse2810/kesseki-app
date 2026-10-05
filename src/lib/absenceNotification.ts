import { prisma } from "@/lib/prisma";
import { calculateCurrentGrade } from "@/lib/grade";
import { pushMessage } from "@/lib/line";
import type { EffectiveSchedule } from "@/lib/notificationSchedule";

const NON_PLAYER_POSITIONS = new Set(["MANAGER", "ANALYST"]);
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
// NotificationLog.time prefix for early-leave sends, followed by the highest
// Absence id included so far (e.g. "early:42").
const EARLY_LEAVE_LOG_PREFIX = "early:";

export type Recipient = { lineUserId: string };
export type SendFailure = { lineUserId: string; detail: string };

// Current JST calendar date (as UTC midnight, matching how Absence.date is
// stored) and time of day.
export function jstNow(now: Date = new Date()) {
  const shifted = new Date(now.getTime() + JST_OFFSET_MS);
  return {
    todayUtcMidnight: new Date(`${shifted.toISOString().slice(0, 10)}T00:00:00.000Z`),
    minutesSinceMidnight: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
  };
}

export function minutesFromTimeString(time: string): number {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

// `afterId` limits the message to reports newer than that Absence id.
export async function buildAbsenceMessage(
  todayUtcMidnight: Date,
  headerLabel: string,
  afterId?: number,
) {
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

export async function pushToRecipients(recipients: Recipient[], message: string) {
  const failures: SendFailure[] = [];

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

  return failures;
}

export type EarlyLeaveSendResult =
  | { skipped: "no-schedule-today" | "not-time-yet" | "no-early-leave-reports" | "already-sent" }
  | { sent: number; failures: SendFailure[] };

// Sends today's early-leave reports that haven't gone out yet, as a single
// "今日の早退" message. Nothing is sent before earlyLeaveTime, so everything
// reported up to then goes out together in the first call after it; from
// then on each call only finds what was reported since the previous send.
// Called both by the cron (which delivers the batch at earlyLeaveTime) and
// right after a report is saved (so a report made after earlyLeaveTime goes
// out immediately instead of waiting for the next cron call).
export async function sendPendingEarlyLeave(
  todayUtcMidnight: Date,
  minutesSinceMidnight: number,
  schedule: EffectiveSchedule,
  recipients: Recipient[],
): Promise<EarlyLeaveSendResult> {
  if (schedule.time !== null || !schedule.earlyLeaveSend || !schedule.earlyLeaveTime) {
    return { skipped: "no-schedule-today" };
  }

  if (minutesSinceMidnight < minutesFromTimeString(schedule.earlyLeaveTime)) {
    return { skipped: "not-time-yet" };
  }

  // Each log entry records the newest Absence id already sent, so every
  // report goes out exactly once.
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
    return { skipped: "no-early-leave-reports" };
  }

  // Log before sending rather than after: the cron and a just-saved report
  // can get here at the same moment, and the log's (date, time) key lets
  // only one of them through. As with the roll-call, a send that then fails
  // stays logged so a bad recipient doesn't cause endless retries.
  try {
    await prisma.notificationLog.create({
      data: { date: todayUtcMidnight, time: `${EARLY_LEAVE_LOG_PREFIX}${maxId}` },
    });
  } catch {
    return { skipped: "already-sent" };
  }

  const failures = await pushToRecipients(recipients, message);
  return { sent: count, failures };
}
