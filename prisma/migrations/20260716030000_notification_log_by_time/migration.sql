-- DropConstraint
ALTER TABLE "NotificationLog" DROP CONSTRAINT "NotificationLog_pkey";

-- AddColumn
ALTER TABLE "NotificationLog" ADD COLUMN "time" TEXT NOT NULL DEFAULT '';

-- AlterColumn
ALTER TABLE "NotificationLog" ALTER COLUMN "time" DROP DEFAULT;

-- AddPrimaryKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("date", "time");
