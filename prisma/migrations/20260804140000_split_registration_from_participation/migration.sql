-- Split the one-time volunteer application from per-edition participation.
--
-- A volunteer applies once and is approved once; each edition they return only
-- to say they are available. Until now the platform created a whole new
-- application every edition, which meant a returning volunteer re-entered their
-- name, address, occupation, church and motivation in order to answer "yes, I
-- am free in March".
--
-- What stays on the application: who they are, why they want to serve, who to
-- call in an emergency, and whether they have been accepted.
-- What moves to the participation: department, availability, department
-- answers, consents and shifts — everything decided anew each time.

CREATE TYPE "ParticipationStatus" AS ENUM (
  'SIGNED_UP', 'ASSIGNED', 'CHECKED_IN', 'COMPLETED', 'WITHDRAWN'
);

CREATE TABLE "edition_participations" (
  "id"                    TEXT NOT NULL,
  "applicationId"         TEXT NOT NULL,
  "edition"               TEXT NOT NULL,
  "year"                  INTEGER,
  "departmentId"          TEXT,
  "status"                "ParticipationStatus" NOT NULL DEFAULT 'SIGNED_UP',
  "availableOvernight"    BOOLEAN,
  "consentAccurate"       BOOLEAN NOT NULL DEFAULT false,
  "consentTerms"          BOOLEAN NOT NULL DEFAULT false,
  "consentDataProcessing" BOOLEAN NOT NULL DEFAULT false,
  "consentCommunication"  BOOLEAN NOT NULL DEFAULT false,
  "consentedAt"           TIMESTAMP(3),
  "confirmedAt"           TIMESTAMP(3),
  "withdrawnAt"           TIMESTAMP(3),
  "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"             TIMESTAMP(3) NOT NULL,
  CONSTRAINT "edition_participations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "edition_participations_applicationId_edition_key"
  ON "edition_participations"("applicationId", "edition");
CREATE INDEX "edition_participations_edition_status_idx"
  ON "edition_participations"("edition", "status");
CREATE INDEX "edition_participations_departmentId_edition_idx"
  ON "edition_participations"("departmentId", "edition");

ALTER TABLE "edition_participations"
  ADD CONSTRAINT "edition_participations_applicationId_fkey"
  FOREIGN KEY ("applicationId") REFERENCES "volunteer_applications"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "edition_participations"
  ADD CONSTRAINT "edition_participations_departmentId_fkey"
  FOREIGN KEY ("departmentId") REFERENCES "departments"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Carry every existing application into a 2027 participation.
--
-- Existing rows were all created for the current edition, so each becomes one
-- participation. The department, consents and overnight answer move across
-- verbatim; nothing a volunteer entered is lost or reinterpreted.
--
-- The three "serving" statuses were never approval states — they described how
-- far through an edition somebody was — so they move to the participation and
-- the application is left at APPROVED, which is the standing that earned them.
INSERT INTO "edition_participations" (
  "id", "applicationId", "edition", "year", "departmentId", "status",
  "availableOvernight", "consentAccurate", "consentTerms",
  "consentDataProcessing", "consentCommunication", "consentedAt",
  "confirmedAt", "createdAt", "updatedAt"
)
SELECT
  'ep_' || a."id",
  a."id",
  '2027',
  2027,
  a."departmentId",
  CASE a."status"
    WHEN 'ASSIGNED'   THEN 'ASSIGNED'::"ParticipationStatus"
    WHEN 'CHECKED_IN' THEN 'CHECKED_IN'::"ParticipationStatus"
    WHEN 'COMPLETED'  THEN 'COMPLETED'::"ParticipationStatus"
    ELSE 'SIGNED_UP'::"ParticipationStatus"
  END,
  a."availableOvernight",
  a."consentAccurate", a."consentTerms",
  a."consentDataProcessing", a."consentCommunication", a."consentedAt",
  a."submittedAt",
  a."createdAt", now()
FROM "volunteer_applications" a;

-- An application is now a standing, not a stage of one edition.
UPDATE "volunteer_applications"
SET "status" = 'APPROVED'
WHERE "status" IN ('ASSIGNED', 'CHECKED_IN', 'COMPLETED');

-- ---------------------------------------------------------------------------
-- Repoint the children that belong to an edition.
--
-- Each is rewritten in place through the deterministic 'ep_' || id mapping
-- above, so no row is orphaned and none has to be recreated.

ALTER TABLE "application_answers" ADD COLUMN "participationId" TEXT;
UPDATE "application_answers" SET "participationId" = 'ep_' || "applicationId";
ALTER TABLE "application_answers" ALTER COLUMN "participationId" SET NOT NULL;
ALTER TABLE "application_answers" DROP CONSTRAINT "application_answers_applicationId_fkey";
DROP INDEX "application_answers_applicationId_questionId_key";
ALTER TABLE "application_answers" DROP COLUMN "applicationId";
CREATE UNIQUE INDEX "application_answers_participationId_questionId_key"
  ON "application_answers"("participationId", "questionId");
ALTER TABLE "application_answers"
  ADD CONSTRAINT "application_answers_participationId_fkey"
  FOREIGN KEY ("participationId") REFERENCES "edition_participations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "volunteer_availability" ADD COLUMN "participationId" TEXT;
UPDATE "volunteer_availability" SET "participationId" = 'ep_' || "applicationId";
ALTER TABLE "volunteer_availability" ALTER COLUMN "participationId" SET NOT NULL;
ALTER TABLE "volunteer_availability" DROP CONSTRAINT "volunteer_availability_applicationId_fkey";
DROP INDEX "volunteer_availability_applicationId_date_period_key";
ALTER TABLE "volunteer_availability" DROP COLUMN "applicationId";
CREATE UNIQUE INDEX "volunteer_availability_participationId_date_period_key"
  ON "volunteer_availability"("participationId", "date", "period");
ALTER TABLE "volunteer_availability"
  ADD CONSTRAINT "volunteer_availability_participationId_fkey"
  FOREIGN KEY ("participationId") REFERENCES "edition_participations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "shift_assignments" ADD COLUMN "participationId" TEXT;
UPDATE "shift_assignments" SET "participationId" = 'ep_' || "applicationId";
ALTER TABLE "shift_assignments" ALTER COLUMN "participationId" SET NOT NULL;
ALTER TABLE "shift_assignments" DROP CONSTRAINT "shift_assignments_applicationId_fkey";
DROP INDEX "shift_assignments_shiftId_applicationId_key";
ALTER TABLE "shift_assignments" DROP COLUMN "applicationId";
CREATE UNIQUE INDEX "shift_assignments_shiftId_participationId_key"
  ON "shift_assignments"("shiftId", "participationId");
ALTER TABLE "shift_assignments"
  ADD CONSTRAINT "shift_assignments_participationId_fkey"
  FOREIGN KEY ("participationId") REFERENCES "edition_participations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Retire the columns that have moved.
DROP INDEX IF EXISTS "volunteer_applications_departmentId_status_idx";
ALTER TABLE "volunteer_applications"
  DROP CONSTRAINT "volunteer_applications_departmentId_fkey",
  DROP COLUMN "departmentId",
  DROP COLUMN "availableOvernight",
  DROP COLUMN "consentAccurate",
  DROP COLUMN "consentTerms",
  DROP COLUMN "consentDataProcessing",
  DROP COLUMN "consentCommunication",
  DROP COLUMN "consentedAt";

-- One application per person — the constraint that makes "register once" true
-- rather than merely intended. Verified beforehand: no user holds two.
CREATE UNIQUE INDEX "volunteer_applications_userId_key" ON "volunteer_applications"("userId");
