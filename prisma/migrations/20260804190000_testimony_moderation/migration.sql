-- Testimony moderation: assignment, duplicate detection, spam/test tagging,
-- featuring, and a note timeline in place of one overwritable string.
--
-- Also removes departments.capacity: there is no fixed volunteer limit per
-- department, nothing may enforce one, and a column nothing reads traps the
-- next reader into thinking something does.

ALTER TABLE "testimony_submissions"
  ADD COLUMN "assignedToId" TEXT,
  ADD COLUMN "bodyHash"     TEXT,
  ADD COLUMN "isSpam"       BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "isTestData"   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "featuredAt"   TIMESTAMP(3);

ALTER TABLE "testimony_submissions"
  ADD CONSTRAINT "testimony_submissions_assignedToId_fkey"
  FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "testimony_submissions_bodyHash_idx" ON "testimony_submissions"("bodyHash");
CREATE INDEX "testimony_submissions_assignedToId_status_idx" ON "testimony_submissions"("assignedToId", "status");

CREATE TABLE "testimony_notes" (
  "id"          TEXT NOT NULL,
  "testimonyId" TEXT NOT NULL,
  "authorId"    TEXT,
  "body"        TEXT NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "testimony_notes_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "testimony_notes_testimonyId_createdAt_idx" ON "testimony_notes"("testimonyId", "createdAt");
ALTER TABLE "testimony_notes"
  ADD CONSTRAINT "testimony_notes_testimonyId_fkey"
  FOREIGN KEY ("testimonyId") REFERENCES "testimony_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "testimony_notes"
  ADD CONSTRAINT "testimony_notes_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Every historic review note becomes the first entry of its timeline, credited
-- to whoever reviewed and stamped with when. The old column stays readable.
INSERT INTO "testimony_notes" ("id", "testimonyId", "authorId", "body", "createdAt")
SELECT 'tn_' || "id", "id", "reviewedById", "reviewNote", COALESCE("reviewedAt", "updatedAt")
FROM "testimony_submissions"
WHERE "reviewNote" IS NOT NULL AND length(trim("reviewNote")) > 0;

-- Duplicate detection: SHA-256 of the normalised body (trimmed, lower-cased,
-- whitespace collapsed). The application computes the identical hash on write;
-- see src/lib/testimonies/hash.ts, which mirrors this expression.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
UPDATE "testimony_submissions"
SET "bodyHash" = encode(digest(trim(regexp_replace(lower("body"), '\s+', ' ', 'g')), 'sha256'), 'hex');

-- Phase 0 remnant.
ALTER TABLE "departments" DROP COLUMN "capacity";
