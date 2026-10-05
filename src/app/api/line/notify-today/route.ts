import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  buildAbsenceMessage,
  jstNow,
  minutesFromTimeString,
  pushToRecipients,
  sendPendingEarlyLeave,
  type SendFailure,
} from "@/lib/absenceNotification";
import { getEffectiveSchedule } from "@/lib/notificationSchedule";

function sendResultResponse(count: number, failures: SendFailure[], recipientCount: number) {
  if (failures.length > 0) {
    return NextResponse.json(
      { ok: failures.length < recipientCount, sent: count, failures },
      { status: failures.length === recipientCount ? 502 : 200 },
    );
  }
  return NextResponse.json({ ok: true, sent: count, recipients: recipientCount });
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")?.trim();
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { todayUtcMidnight, minutesSinceMidnight } = jstNow();

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
    const failures = await pushToRecipients(recipients, message);

    // Record this (date, time) as "sent" even if some recipients failed, so a
    // bad recipient doesn't cause it to be retried indefinitely.
    await prisma.notificationLog.create({
      data: { date: todayUtcMidnight, time: scheduledTime },
    });

    return sendResultResponse(count, failures, recipients.length);
  }

  // No roll-call scheduled today. If early-leave sending is on for this
  // date, everything reported by earlyLeaveTime goes out together in the
  // first call after it. Reports made later are sent as they're saved (see
  // POST /api/absences); this call also picks up any of those that were
  // missed.
  const result = await sendPendingEarlyLeave(
    todayUtcMidnight,
    minutesSinceMidnight,
    schedule,
    recipients,
  );
  if ("skipped" in result) {
    return NextResponse.json({ ok: true, skipped: result.skipped });
  }
  return sendResultResponse(result.sent, result.failures, recipients.length);
}
