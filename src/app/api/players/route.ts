import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateCurrentGrade, getCurrentFiscalYear } from "@/lib/grade";
import { generateUniquePin } from "@/lib/pin";
import { Position } from "@/generated/prisma/enums";

const VALID_POSITIONS = new Set<string>(Object.values(Position));

export async function GET() {
  const players = await prisma.player.findMany({
    omit: { pin: true },
    include: { positions: true },
  });

  const result = players
    .map((player) => ({
      id: player.id,
      name: player.name,
      currentGrade: calculateCurrentGrade(player.baseGrade, player.baseYear),
      positions: player.positions.map((p) => p.position),
    }))
    .sort((a, b) => a.currentGrade - b.currentGrade);

  return NextResponse.json({ players: result });
}

export async function POST(request: Request) {
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
    return NextResponse.json(
      { error: "ポジションを1つ以上選択してください" },
      { status: 400 },
    );
  }

  const baseYear = getCurrentFiscalYear();

  const player = await prisma.$transaction(async (tx) => {
    const pin = await generateUniquePin(tx);

    const createdPlayer = await tx.player.create({
      data: {
        name: name.trim(),
        baseGrade: baseGradeNumber,
        baseYear,
        pin,
      },
    });

    await tx.playerPosition.createMany({
      data: positions.map((position) => ({
        playerId: createdPlayer.id,
        position: position as Position,
      })),
    });

    return createdPlayer;
  });

  return NextResponse.json({ player }, { status: 201 });
}
