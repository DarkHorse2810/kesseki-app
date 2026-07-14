-- AlterTable
ALTER TABLE "Player" ADD COLUMN "pin" TEXT;

-- Backfill existing rows with a random unique 4-digit pin
DO $$
DECLARE
  r RECORD;
  new_pin TEXT;
BEGIN
  FOR r IN SELECT id FROM "Player" WHERE "pin" IS NULL LOOP
    LOOP
      new_pin := lpad(floor(random() * 10000)::text, 4, '0');
      EXIT WHEN NOT EXISTS (SELECT 1 FROM "Player" WHERE "pin" = new_pin);
    END LOOP;
    UPDATE "Player" SET "pin" = new_pin WHERE id = r.id;
  END LOOP;
END $$;

-- AlterTable
ALTER TABLE "Player" ALTER COLUMN "pin" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Player_pin_key" ON "Player"("pin");
