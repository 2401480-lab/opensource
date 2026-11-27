-- 회비 (shared fund): additive only. New tables and defaulted columns; no existing data changes.
-- CreateEnum
CREATE TYPE "PaymentSource" AS ENUM ('PERSONAL', 'FUND');

-- CreateEnum
CREATE TYPE "FundPaymentStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED', 'EXEMPT');

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "paymentSource" "PaymentSource" NOT NULL DEFAULT 'PERSONAL';

-- AlterTable
ALTER TABLE "Group" ADD COLUMN     "fundAmount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "fundDueDay" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "fundEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "fundOpeningBalance" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "fundStartMonth" TEXT;

-- CreateTable
CREATE TABLE "FundMemberAmount" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FundMemberAmount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FundRestMonth" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "month" TEXT NOT NULL,

    CONSTRAINT "FundRestMonth_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FundPayment" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" "FundPaymentStatus" NOT NULL,
    "note" TEXT,
    "requestedByUserId" TEXT,
    "respondedByUserId" TEXT,
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FundPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FundMemberAmount_participantId_key" ON "FundMemberAmount"("participantId");

-- CreateIndex
CREATE INDEX "FundMemberAmount_groupId_idx" ON "FundMemberAmount"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "FundRestMonth_groupId_month_key" ON "FundRestMonth"("groupId", "month");

-- CreateIndex
CREATE INDEX "FundPayment_groupId_month_idx" ON "FundPayment"("groupId", "month");

-- CreateIndex
CREATE UNIQUE INDEX "FundPayment_participantId_month_key" ON "FundPayment"("participantId", "month");

-- AddForeignKey
ALTER TABLE "FundMemberAmount" ADD CONSTRAINT "FundMemberAmount_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FundMemberAmount" ADD CONSTRAINT "FundMemberAmount_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FundRestMonth" ADD CONSTRAINT "FundRestMonth_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FundPayment" ADD CONSTRAINT "FundPayment_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FundPayment" ADD CONSTRAINT "FundPayment_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

