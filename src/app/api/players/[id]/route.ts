import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateCurrentGrade, getCurrentFiscalYear } from "@/lib/grade";
import { Position } from "@/generated/prisma/enums";

const VALID_POSITIONS = new Set<string>(Object.values(Position));

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const playerId = Number(id);
  if (!Number.isInteger(playerId)) {
    return NextResponse.json({ error: "選手が見つかりません" }, { status: 404 });
  }

  const player = await prisma.player.findUnique({
    where: { id: playerId },
    include: { positions: true },
  });

  if (!player) {
    return NextResponse.json({ error: "選手が見つかりません" }, { status: 404 });
  }

  return NextResponse.json({
    player: {
      id: player.id,
      name: player.name,
      baseGrade: player.baseGrade,
      currentGrade: calculateCurrentGrade(player.baseGrade, player.baseYear),
      pin: player.pin,
      positions: player.positions.map((p) => p.position),
    },
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const playerId = Number(id);
  if (!Number.isInteger(playerId)) {
    return NextResponse.json({ error: "選手が見つかりません" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "リクエストボディが不正です" }, { status: 400 });
  }

  const { name, baseGrade, positions } = body as {
    name?: unknown;
    baseGrade?: unknown;
    positions?: unknown;
  };

  if (typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "名前を入力してください" }, { status: 400 });
  }

  const baseGradeNumber = typeof baseGrade === "number" ? baseGrade : Number(baseGrade);
  if (!Number.isInteger(baseGradeNumber)) {
    return NextResponse.json({ error: "学年を正しく入力してください" }, { status: 400 });
  }

  if (
    !Array.isArray(positions) ||
    positions.length === 0 ||
    !positions.every((p): p is string => typeof p === "string" && VALID_POSITIONS.has(p))
  ) {
    return NextResponse.json({ error: "ポジションを1つ以上選択してください" }, { status: 400 });
  }

  const existing = await prisma.player.findUnique({ where: { id: playerId } });
  if (!existing) {
    return NextResponse.json({ error: "選手が見つかりません" }, { status: 404 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.player.update({
      where: { id: playerId },
      // The edited grade is always treated as "current grade as of now",
      // so baseYear is reset to keep future fiscal-year auto-advancement correct.
      data: { name: name.trim(), baseGrade: baseGradeNumber, baseYear: getCurrentFiscalYear() },
    });
    await tx.playerPosition.deleteMany({ where: { playerId } });
    await tx.playerPosition.createMany({
      data: positions.map((position) => ({ playerId, position: position as Position })),
    });
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const playerId = Number(id);
  if (!Number.isInteger(playerId)) {
    return NextResponse.json({ error: "選手が見つかりません" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const password = (body as { password?: unknown } | null)?.password;
  if (typeof password !== "string" || password !== process.env.SETTINGS_PASSWORD) {
    return NextResponse.json({ error: "パスワードが違います" }, { status: 401 });
  }

  const existing = await prisma.player.findUnique({ where: { id: playerId } });
  if (!existing) {
    return NextResponse.json({ error: "選手が見つかりません" }, { status: 404 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.absence.deleteMany({ where: { playerId } });
    await tx.playerPosition.deleteMany({ where: { playerId } });
    await tx.player.delete({ where: { id: playerId } });
  });

  return NextResponse.json({ ok: true });
}
