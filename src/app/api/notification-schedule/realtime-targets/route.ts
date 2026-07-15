import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const targets = await prisma.realtimeAbsenceTarget.findMany({ orderBy: { createdAt: "asc" } });
  return NextResponse.json({ targets });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "リクエストボディが不正です" }, { status: 400 });
  }

  const { password, lineId, label } = body as {
    password?: unknown;
    lineId?: unknown;
    label?: unknown;
  };

  if (typeof password !== "string" || password !== process.env.SETTINGS_PASSWORD) {
    return NextResponse.json({ error: "パスワードが違います" }, { status: 401 });
  }

  const trimmedId = typeof lineId === "string" ? lineId.trim() : "";
  if (trimmedId.length === 0) {
    return NextResponse.json({ error: "グループ/ルームIDを入力してください" }, { status: 400 });
  }

  const trimmedLabel = typeof label === "string" && label.trim().length > 0 ? label.trim() : null;

  const existing = await prisma.realtimeAbsenceTarget.findUnique({
    where: { lineId: trimmedId },
  });
  if (existing) {
    return NextResponse.json({ error: "すでに登録済みのIDです" }, { status: 400 });
  }

  const target = await prisma.realtimeAbsenceTarget.create({
    data: { lineId: trimmedId, label: trimmedLabel },
  });

  return NextResponse.json({ target }, { status: 201 });
}
