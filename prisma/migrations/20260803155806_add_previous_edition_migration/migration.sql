-- CreateEnum
CREATE TYPE "MigrationBatchStatus" AS ENUM ('DRAFT', 'VALIDATED', 'QUEUED', 'IMPORTING', 'COMPLETED', 'COMPLETED_WITH_WARNINGS', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MigrationRowAction" AS ENUM ('CREATE', 'MATCH_EXISTING', 'SKIP_DUPLICATE', 'SKIP_INVALID');

-- CreateEnum
CREATE TYPE "MigrationRowStatus" AS ENUM ('PENDING', 'VALID', 'WARNING', 'INVALID', 'IMPORTED', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('NOT_QUEUED', 'QUEUED', 'SENT', 'DELIVERED', 'BOUNCED', 'FAILED', 'SUPPRESSED');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "isPreviousEditionUser" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "migrationSource" TEXT,
ADD COLUMN     "mustReviewProfile" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "profileReviewedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "migration_batches" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sourceEdition" TEXT NOT NULL,
    "sourceYear" INTEGER,
    "sourceNote" TEXT,
    "originalFilename" TEXT NOT NULL,
    "fileChecksum" TEXT NOT NULL,
    "columnMapping" JSONB NOT NULL,
    "sendInvitations" BOOLEAN NOT NULL DEFAULT false,
    "status" "MigrationBatchStatus" NOT NULL DEFAULT 'DRAFT',
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "validRows" INTEGER NOT NULL DEFAULT 0,
    "warningRows" INTEGER NOT NULL DEFAULT 0,
    "invalidRows" INTEGER NOT NULL DEFAULT 0,
    "createdRows" INTEGER NOT NULL DEFAULT 0,
    "matchedRows" INTEGER NOT NULL DEFAULT 0,
    "skippedRows" INTEGER NOT NULL DEFAULT 0,
    "failedRows" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "migration_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "migrated_user_records" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "sourceData" JSONB NOT NULL,
    "normalisedEmail" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "phone" TEXT,
    "previousRegistrationId" TEXT,
    "previousDepartment" TEXT,
    "action" "MigrationRowAction" NOT NULL DEFAULT 'CREATE',
    "status" "MigrationRowStatus" NOT NULL DEFAULT 'PENDING',
    "validationMessages" JSONB,
    "matchedUserId" TEXT,
    "invitationStatus" "InvitationStatus" NOT NULL DEFAULT 'NOT_QUEUED',
    "invitedAt" TIMESTAMP(3),
    "invitationError" TEXT,
    "invitationSentKey" TEXT,
    "activatedAt" TIMESTAMP(3),
    "profileReviewedAt" TIMESTAMP(3),
    "excludedFromInvites" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "migrated_user_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "previous_edition_participations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "edition" TEXT NOT NULL,
    "year" INTEGER,
    "previousDepartment" TEXT,
    "previousRegistrationId" TEXT,
    "metadata" JSONB,
    "batchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "previous_edition_participations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_jobs" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "offset" INTEGER NOT NULL DEFAULT 0,
    "size" INTEGER NOT NULL DEFAULT 100,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "lastError" TEXT,
    "claimedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "import_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "migration_batches_reference_key" ON "migration_batches"("reference");

-- CreateIndex
CREATE INDEX "migration_batches_status_createdAt_idx" ON "migration_batches"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "migration_batches_fileChecksum_sourceEdition_key" ON "migration_batches"("fileChecksum", "sourceEdition");

-- CreateIndex
CREATE UNIQUE INDEX "migrated_user_records_invitationSentKey_key" ON "migrated_user_records"("invitationSentKey");

-- CreateIndex
CREATE INDEX "migrated_user_records_normalisedEmail_idx" ON "migrated_user_records"("normalisedEmail");

-- CreateIndex
CREATE INDEX "migrated_user_records_batchId_status_idx" ON "migrated_user_records"("batchId", "status");

-- CreateIndex
CREATE INDEX "migrated_user_records_invitationStatus_idx" ON "migrated_user_records"("invitationStatus");

-- CreateIndex
CREATE UNIQUE INDEX "migrated_user_records_batchId_rowNumber_key" ON "migrated_user_records"("batchId", "rowNumber");

-- CreateIndex
CREATE INDEX "previous_edition_participations_edition_idx" ON "previous_edition_participations"("edition");

-- CreateIndex
CREATE UNIQUE INDEX "previous_edition_participations_userId_edition_key" ON "previous_edition_participations"("userId", "edition");

-- CreateIndex
CREATE INDEX "import_jobs_status_createdAt_idx" ON "import_jobs"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "import_jobs_batchId_kind_offset_key" ON "import_jobs"("batchId", "kind", "offset");

-- AddForeignKey
ALTER TABLE "migration_batches" ADD CONSTRAINT "migration_batches_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "migrated_user_records" ADD CONSTRAINT "migrated_user_records_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "migration_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "migrated_user_records" ADD CONSTRAINT "migrated_user_records_matchedUserId_fkey" FOREIGN KEY ("matchedUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "previous_edition_participations" ADD CONSTRAINT "previous_edition_participations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "previous_edition_participations" ADD CONSTRAINT "previous_edition_participations_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "migration_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "migration_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
