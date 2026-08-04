-- The contact inbox becomes a helpdesk: read state, priority, assignment,
-- duplicate detection and a note timeline in place of one overwritable string.

CREATE TYPE "ContactPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

ALTER TABLE "contact_messages"
  ADD COLUMN "firstReadAt"  TIMESTAMP(3),
  ADD COLUMN "priority"     "ContactPriority" NOT NULL DEFAULT 'NORMAL',
  ADD COLUMN "assignedToId" TEXT,
  ADD COLUMN "messageHash"  TEXT,
  ADD COLUMN "isSpam"       BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "isTestData"   BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "contact_messages"
  ADD CONSTRAINT "contact_messages_assignedToId_fkey"
  FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "contact_messages_messageHash_idx" ON "contact_messages"("messageHash");
CREATE INDEX "contact_messages_assignedToId_status_idx" ON "contact_messages"("assignedToId", "status");

CREATE TABLE "contact_notes" (
  "id"        TEXT NOT NULL,
  "messageId" TEXT NOT NULL,
  "authorId"  TEXT,
  "body"      TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "contact_notes_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "contact_notes_messageId_createdAt_idx" ON "contact_notes"("messageId", "createdAt");
ALTER TABLE "contact_notes"
  ADD CONSTRAINT "contact_notes_messageId_fkey"
  FOREIGN KEY ("messageId") REFERENCES "contact_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contact_notes"
  ADD CONSTRAINT "contact_notes_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Historic handler notes become the first entry of each timeline.
INSERT INTO "contact_notes" ("id", "messageId", "authorId", "body", "createdAt")
SELECT 'cn_' || "id", "id", "handledById", "handlerNote", COALESCE("handledAt", "updatedAt")
FROM "contact_messages"
WHERE "handlerNote" IS NOT NULL AND length(trim("handlerNote")) > 0;

-- Anything already triaged has, by definition, been read.
UPDATE "contact_messages" SET "firstReadAt" = COALESCE("handledAt", "updatedAt")
WHERE "status" <> 'NEW';

-- Same normalised-body hash rule as testimonies; pgcrypto already enabled.
UPDATE "contact_messages"
SET "messageHash" = encode(digest(trim(regexp_replace(lower("message"), '\s+', ' ', 'g')), 'sha256'), 'hex');
