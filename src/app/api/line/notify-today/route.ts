import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateCurrentGrade } from "@/lib/grade";
import { pushMessage } from "@/lib/line";

const NON_PLAYER_POSITIONS = new Set(["MANAGER", "ANALYST"]);

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
  const rangeStart = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const rangeEnd = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() + 1));

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

  return NextResponse.json({ ok: true, sent: items.length });
}
