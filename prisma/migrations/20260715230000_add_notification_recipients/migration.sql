-- CreateTable
CREATE TABLE "NotificationRecipient" (
    "id" SERIAL NOT NULL,
    "lineUserId" TEXT NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NotificationRecipient_lineUserId_key" ON "NotificationRecipient"("lineUserId");

-- Carry over the single recipient that was previously configured via the
-- LINE_TARGET_USER_ID environment variable, so existing delivery keeps working.
INSERT INTO "NotificationRecipient" ("lineUserId", "label")
VALUES ('U56df9e0a7aa6cb034830d83f51572e81', '最初の登録者')
ON CONFLICT ("lineUserId") DO NOTHING;
