import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const absenceId = Number(id);
  if (!Number.isInteger(absenceId)) {
    return NextResponse.json({ error: "欠席記録が見つかりません" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const password = (body as { password?: unknown } | null)?.password;
  if (typeof password !== "string" || password !== process.env.SETTINGS_PASSWORD) {
    return NextResponse.json({ error: "パスワードが違います" }, { status: 401 });
  }

  const existing = await prisma.absence.findUnique({ where: { id: absenceId } });
  if (!existing) {
    return NextResponse.json({ error: "欠席記録が見つかりません" }, { status: 404 });
  }

  await prisma.absence.delete({ where: { id: absenceId } });

  return NextResponse.json({ ok: true });
}
