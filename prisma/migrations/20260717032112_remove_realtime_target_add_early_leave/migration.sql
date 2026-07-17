/*
  Warnings:

  - You are about to drop the `RealtimeAbsenceTarget` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterTable
ALTER TABLE "DateOverride" ADD COLUMN     "earlyLeaveSend" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "earlyLeaveTime" TEXT;

-- DropTable
DROP TABLE "RealtimeAbsenceTarget";
