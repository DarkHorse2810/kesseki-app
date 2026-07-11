import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { calculateCurrentGrade } from "../src/lib/grade";

async function main() {
  const player = await prisma.player.create({
    data: {
      name: "山田太郎",
      baseGrade: 1,
      baseYear: 2025,
      positions: {
        create: [{ position: "PITCHER" }, { position: "OUTFIELDER" }],
      },
    },
    include: { positions: true },
  });
  console.log("created player:", player);

  const absence = await prisma.absence.create({
    data: {
      playerId: player.id,
      date: new Date("2026-07-01"),
      reason: "発熱のため欠席",
    },
  });
  console.log("created absence:", absence);

  const found = await prisma.player.findUnique({
    where: { id: player.id },
    include: { positions: true, absences: true },
  });
  console.log("found player with relations:", found);

  const currentGrade = calculateCurrentGrade(
    player.baseGrade,
    player.baseYear,
    new Date("2026-07-11"),
  );
  console.log("calculated current grade (as of 2026-07-11):", currentGrade);

  await prisma.absence.delete({ where: { id: absence.id } });
  await prisma.playerPosition.deleteMany({ where: { playerId: player.id } });
  await prisma.player.delete({ where: { id: player.id } });
  console.log("cleaned up");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
