import { NextResponse } from "next/server";
import { getEffectiveSchedule } from "@/lib/notificationSchedule";

// Public (no password) lookup used by the absence form to decide whether a
// given date is a normal send day, an early-leave-only day (needs the "早退
// として連絡します" confirmation), or blocked entirely.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const dateParam = searchParams.get("date");
  if (!dateParam) {
    return NextResponse.json({ error: "date を指定してください" }, { status: 400 });
  }

  const parsedDate = new Date(dateParam);
  if (Number.isNaN(parsedDate.getTime())) {
    return NextResponse.json({ error: "date を正しく指定してください" }, { status: 400 });
  }
  const dateUtcMidnight = new Date(
    Date.UTC(parsedDate.getUTCFullYear(), parsedDate.getUTCMonth(), parsedDate.getUTCDate()),
  );

  const schedule = await getEffectiveSchedule(dateUtcMidnight);
  const status = schedule.time !== null ? "normal" : schedule.earlyLeaveSend ? "early-leave" : "blocked";

  return NextResponse.json({ status });
}
