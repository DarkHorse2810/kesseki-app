-- CreateTable
CREATE TABLE "WeekdaySchedule" (
    "weekday" INTEGER NOT NULL,
    "time" TEXT,

    CONSTRAINT "WeekdaySchedule_pkey" PRIMARY KEY ("weekday")
);

-- CreateTable
CREATE TABLE "DateOverride" (
    "date" TIMESTAMP(3) NOT NULL,
    "time" TEXT,

    CONSTRAINT "DateOverride_pkey" PRIMARY KEY ("date")
);

-- CreateTable
CREATE TABLE "NotificationLog" (
    "date" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("date")
);

-- Seed default weekday send time (07:00 JST every day).
INSERT INTO "WeekdaySchedule" ("weekday", "time") VALUES
    (0, '07:00'),
    (1, '07:00'),
    (2, '07:00'),
    (3, '07:00'),
    (4, '07:00'),
    (5, '07:00'),
    (6, '07:00');
