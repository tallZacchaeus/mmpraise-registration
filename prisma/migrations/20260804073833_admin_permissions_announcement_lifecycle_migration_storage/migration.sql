-- CreateEnum
CREATE TYPE "RoleChange" AS ENUM ('GRANTED', 'REVOKED', 'SUSPENDED', 'RESTORED', 'PERMISSION_GRANTED', 'PERMISSION_REVOKED');

-- CreateEnum
CREATE TYPE "AnnouncementStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'PUBLISHED', 'EXPIRED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AnnouncementPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- AlterTable
ALTER TABLE "announcements" ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "emailSubject" TEXT,
ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "priority" "AnnouncementPriority" NOT NULL DEFAULT 'NORMAL',
ADD COLUMN     "scheduledFor" TIMESTAMP(3),
ADD COLUMN     "sendEmail" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "showAsBanner" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "showOnDashboard" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "status" "AnnouncementStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "updatedById" TEXT;

-- AlterTable
ALTER TABLE "migration_batches" ADD COLUMN     "fileDeletedAt" TIMESTAMP(3),
ADD COLUMN     "fileSizeBytes" INTEGER,
ADD COLUMN     "storageKey" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "adminDisabledAt" TIMESTAMP(3),
ADD COLUMN     "adminNote" TEXT,
ADD COLUMN     "adminSuspendedUntil" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "admin_permission_grants" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "permission" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL DEFAULT true,
    "reason" TEXT,
    "grantedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_permission_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_assignment_history" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "change" "RoleChange" NOT NULL,
    "subject" TEXT NOT NULL,
    "reason" TEXT,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_assignment_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announcement_revisions" (
    "id" TEXT NOT NULL,
    "announcementId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "editedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "announcement_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announcement_deliveries" (
    "id" TEXT NOT NULL,
    "announcementId" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'email',
    "isTest" BOOLEAN NOT NULL DEFAULT false,
    "recipients" INTEGER NOT NULL DEFAULT 0,
    "succeeded" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "failures" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "triggeredById" TEXT,

    CONSTRAINT "announcement_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "admin_permission_grants_permission_idx" ON "admin_permission_grants"("permission");

-- CreateIndex
CREATE UNIQUE INDEX "admin_permission_grants_userId_permission_key" ON "admin_permission_grants"("userId", "permission");

-- CreateIndex
CREATE INDEX "role_assignment_history_userId_createdAt_idx" ON "role_assignment_history"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "announcement_revisions_announcementId_version_key" ON "announcement_revisions"("announcementId", "version");

-- CreateIndex
CREATE INDEX "announcement_deliveries_announcementId_startedAt_idx" ON "announcement_deliveries"("announcementId", "startedAt");

-- CreateIndex
CREATE INDEX "announcements_status_scheduledFor_idx" ON "announcements"("status", "scheduledFor");

-- AddForeignKey
ALTER TABLE "admin_permission_grants" ADD CONSTRAINT "admin_permission_grants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_permission_grants" ADD CONSTRAINT "admin_permission_grants_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_assignment_history" ADD CONSTRAINT "role_assignment_history_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_assignment_history" ADD CONSTRAINT "role_assignment_history_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcement_revisions" ADD CONSTRAINT "announcement_revisions_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "announcements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcement_deliveries" ADD CONSTRAINT "announcement_deliveries_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "announcements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
