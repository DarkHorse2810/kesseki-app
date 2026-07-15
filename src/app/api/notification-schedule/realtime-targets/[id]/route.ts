import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const targetId = Number(id);
  if (!Number.isInteger(targetId)) {
    return NextResponse.json({ error: "見つかりません" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const password = (body as { password?: unknown } | null)?.password;
  if (typeof password !== "string" || password !== process.env.SETTINGS_PASSWORD) {
    return NextResponse.json({ error: "パスワードが違います" }, { status: 401 });
  }

  await prisma.realtimeAbsenceTarget.delete({ where: { id: targetId } }).catch(() => {});

  return NextResponse.json({ ok: true });
}
