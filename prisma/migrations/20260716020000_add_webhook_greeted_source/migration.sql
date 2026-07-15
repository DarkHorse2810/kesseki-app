-- CreateTable
CREATE TABLE "WebhookGreetedSource" (
    "id" TEXT NOT NULL,
    "greetedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookGreetedSource_pkey" PRIMARY KEY ("id")
);
