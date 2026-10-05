import { prisma } from "@/lib/prisma";

export type EffectiveSchedule = {
  time: string | null;
  earlyLeaveSend: boolean;
  earlyLeaveTime: string | null;
};

// Time the early-leave check starts at when a "don't send" day has early-leave
// sending on but no explicit time saved. Matches the time the settings screen
// shows for such a day, so what's displayed there is what actually happens.
export const DEFAULT_EARLY_LEAVE_TIME = "07:00";

// Resolves the notification schedule for a given calendar date (UTC
// midnight), preferring an explicit DateOverride and falling back to the
// weekday default. On a "don't send" day, early-leave sending is on unless an
// override explicitly turns it off — the settings screen shows the "早退送信"
// box checked for those days whether or not an override has been saved, so
// a day that only falls back to "don't send" via the weekday schedule (or an
// override saved without a time) has to behave the same way.
export async function getEffectiveSchedule(dateUtcMidnight: Date): Promise<EffectiveSchedule> {
  const override = await prisma.dateOverride.findUnique({ where: { date: dateUtcMidnight } });
  if (override) {
    if (override.time !== null) {
      return { time: override.time, earlyLeaveSend: false, earlyLeaveTime: null };
    }
    return {
      time: null,
      earlyLeaveSend: override.earlyLeaveSend,
      earlyLeaveTime: override.earlyLeaveSend
        ? override.earlyLeaveTime ?? DEFAULT_EARLY_LEAVE_TIME
        : null,
    };
  }

  const weekdayRow = await prisma.weekdaySchedule.findUnique({
    where: { weekday: dateUtcMidnight.getUTCDay() },
  });
  const time = weekdayRow?.time ?? null;
  if (time !== null) {
    return { time, earlyLeaveSend: false, earlyLeaveTime: null };
  }
  return { time: null, earlyLeaveSend: true, earlyLeaveTime: DEFAULT_EARLY_LEAVE_TIME };
}
