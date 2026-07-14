import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "リクエストボディが不正です" }, { status: 400 });
  }

  const { pin } = body as { pin?: unknown };
  if (typeof pin !== "string" || !/^\d{4}$/.test(pin)) {
    return NextResponse.json({ error: "登録番号は4桁の数字で入力してください" }, { status: 400 });
  }

  const player = await prisma.player.findUnique({ where: { pin } });
  if (!player) {
    return NextResponse.json({ error: "登録番号が見つかりません" }, { status: 404 });
  }

  return NextResponse.json({ player: { id: player.id, name: player.name } });
}
