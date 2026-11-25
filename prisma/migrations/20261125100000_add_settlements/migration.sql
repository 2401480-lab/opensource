-- Settlement requests (sender records a transfer, recipient confirms or rejects).
-- Additive only: existing reimbursement expenses are left as they are.

-- CreateEnum
CREATE TYPE "SettlementStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED', 'CANCELED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ActivityType" ADD VALUE 'REQUEST_SETTLEMENT';
ALTER TYPE "ActivityType" ADD VALUE 'CONFIRM_SETTLEMENT';
ALTER TYPE "ActivityType" ADD VALUE 'REJECT_SETTLEMENT';
ALTER TYPE "ActivityType" ADD VALUE 'CANCEL_SETTLEMENT';

-- AlterTable
ALTER TABLE "Activity" ADD COLUMN     "settlementId" TEXT;

-- CreateTable
CREATE TABLE "Settlement" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "fromParticipantId" TEXT NOT NULL,
    "toParticipantId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "paidAt" DATE NOT NULL,
    "note" TEXT,
    "status" "SettlementStatus" NOT NULL DEFAULT 'PENDING',
    "requestedByUserId" TEXT NOT NULL,
    "respondedByUserId" TEXT,
    "respondedAt" TIMESTAMP(3),
    "rejectReason" TEXT,
    "expenseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Settlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SettlementDocument" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "settlementId" TEXT NOT NULL,

    CONSTRAINT "SettlementDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Settlement_expenseId_key" ON "Settlement"("expenseId");

-- CreateIndex
CREATE INDEX "Settlement_groupId_status_idx" ON "Settlement"("groupId", "status");

-- AddForeignKey
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_fromParticipantId_fkey" FOREIGN KEY ("fromParticipantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_toParticipantId_fkey" FOREIGN KEY ("toParticipantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SettlementDocument" ADD CONSTRAINT "SettlementDocument_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "Settlement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

