-- CreateTable
CREATE TABLE "RealtimeAbsenceTarget" (
    "id" SERIAL NOT NULL,
    "lineId" TEXT NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RealtimeAbsenceTarget_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RealtimeAbsenceTarget_lineId_key" ON "RealtimeAbsenceTarget"("lineId");
