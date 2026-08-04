-- The volunteer's permanent MMP number.
--
-- A volunteer registers once and returns each edition to mark availability, so
-- this number identifies the *person* and never changes. It is the number a
-- volunteer quotes; `volunteer_applications.registrationId` stays an internal
-- per-edition reference.

ALTER TABLE "users" ADD COLUMN "mmpCode" TEXT;
CREATE UNIQUE INDEX "users_mmpCode_key" ON "users"("mmpCode");

-- One global running sequence, matching five years of legacy behaviour.
--
-- The legacy codes run MMP2200013 → MMP2214058 with only 73 gaps, and every
-- year draws from the same range — the "22" was specified as a year prefix but
-- never implemented, so it is treated here as nothing more than where the
-- counter happens to sit. 2214059 continues it.
--
-- The value is formatted as a plain 7-digit zero-padded integer, so when it
-- eventually reaches 2300000 the format is still MMP####### and no downstream
-- code has to change.
CREATE SEQUENCE IF NOT EXISTS mmp_code_seq START WITH 2214059 INCREMENT BY 1;

-- Backfill existing accounts.
--
-- Ordered by creation so the numbers follow the order people actually joined,
-- rather than whatever order the table happens to return.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT "id" FROM "users" WHERE "mmpCode" IS NULL ORDER BY "createdAt", "id" LOOP
    UPDATE "users"
    SET "mmpCode" = 'MMP' || LPAD(nextval('mmp_code_seq')::text, 7, '0')
    WHERE "id" = r."id";
  END LOOP;
END $$;

-- Announcement lifecycle backfill.
--
-- Belongs with the migration that added `status`, but that one had already been
-- applied — and editing an applied migration invalidates its checksum and asks
-- every environment to reset. It runs here instead, and is idempotent: it only
-- touches rows still sitting at the DRAFT default.
UPDATE "announcements"
SET "status" = 'PUBLISHED'
WHERE "status" = 'DRAFT' AND "publishedAt" IS NOT NULL AND "publishedAt" <= now();

UPDATE "announcements"
SET "status" = 'SCHEDULED', "scheduledFor" = "publishedAt"
WHERE "status" = 'DRAFT' AND "publishedAt" IS NOT NULL AND "publishedAt" > now();
