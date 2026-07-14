import type { prisma } from "@/lib/prisma";

type TxClient = Pick<typeof prisma, "player">;

export async function generateUniquePin(tx: TxClient): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const pin = String(Math.floor(Math.random() * 10000)).padStart(4, "0");
    const existing = await tx.player.findUnique({ where: { pin } });
    if (!existing) return pin;
  }
  throw new Error("空いている登録番号を生成できませんでした");
}
