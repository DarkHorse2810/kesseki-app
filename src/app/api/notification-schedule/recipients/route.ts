import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const LINE_USER_ID_PATTERN = /^U[0-9a-f]{32}$/i;

export async function GET() {
  const recipients = await prisma.notificationRecipient.findMany({
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ recipients });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "リクエストボディが不正です" }, { status: 400 });
  }

  const { password, lineUserId, label } = body as {
    password?: unknown;
    lineUserId?: unknown;
    label?: unknown;
  };

  if (typeof password !== "string" || password !== process.env.SETTINGS_PASSWORD) {
    return NextResponse.json({ error: "パスワードが違います" }, { status: 401 });
  }

  const trimmedId = typeof lineUserId === "string" ? lineUserId.trim() : "";
  if (!LINE_USER_ID_PATTERN.test(trimmedId)) {
    return NextResponse.json(
      { error: "LINE User IDの形式が正しくありません(Uで始まる33文字)" },
      { status: 400 },
    );
  }

  const trimmedLabel = typeof label === "string" && label.trim().length > 0 ? label.trim() : null;

  const existing = await prisma.notificationRecipient.findUnique({
    where: { lineUserId: trimmedId },
  });
  if (existing) {
    return NextResponse.json({ error: "すでに登録済みのUser IDです" }, { status: 400 });
  }

  const recipient = await prisma.notificationRecipient.create({
    data: { lineUserId: trimmedId, label: trimmedLabel },
  });

  return NextResponse.json({ recipient }, { status: 201 });
}
