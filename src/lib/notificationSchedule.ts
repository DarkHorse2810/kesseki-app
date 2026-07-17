import { prisma } from "@/lib/prisma";

export type EffectiveSchedule = {
  time: string | null;
  earlyLeaveSend: boolean;
  earlyLeaveTime: string | null;
};

// Resolves the notification schedule for a given calendar date (UTC
// midnight), preferring an explicit DateOverride and falling back to the
// weekday default. Early-leave settings only ever come from an explicit
// override — a weekday default alone has no time to send at, so a date that
// falls back to "don't send" via the weekday schedule is fully blocked
// rather than silently accepting reports that would never be notified.
export async function getEffectiveSchedule(dateUtcMidnight: Date): Promise<EffectiveSchedule> {
  const override = await prisma.dateOverride.findUnique({ where: { date: dateUtcMidnight } });
  if (override) {
    if (override.time !== null) {
      return { time: override.time, earlyLeaveSend: false, earlyLeaveTime: null };
    }
    return {
      time: null,
      earlyLeaveSend: override.earlyLeaveSend && override.earlyLeaveTime !== null,
      earlyLeaveTime: override.earlyLeaveTime,
    };
  }

  const weekdayRow = await prisma.weekdaySchedule.findUnique({
    where: { weekday: dateUtcMidnight.getUTCDay() },
  });
  return { time: weekdayRow?.time ?? null, earlyLeaveSend: false, earlyLeaveTime: null };
}
