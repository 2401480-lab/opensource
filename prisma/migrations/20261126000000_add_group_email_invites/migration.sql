-- CreateEnum
CREATE TYPE "EmailInviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELED');

-- CreateTable
CREATE TABLE "GroupEmailInvite" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "invitedByUserId" TEXT NOT NULL,
    "status" "EmailInviteStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "GroupEmailInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GroupEmailInvite_email_status_idx" ON "GroupEmailInvite"("email", "status");

-- CreateIndex
CREATE INDEX "GroupEmailInvite_groupId_status_idx" ON "GroupEmailInvite"("groupId", "status");

-- CreateIndex
CREATE INDEX "GroupEmailInvite_participantId_idx" ON "GroupEmailInvite"("participantId");

-- AddForeignKey
ALTER TABLE "GroupEmailInvite" ADD CONSTRAINT "GroupEmailInvite_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupEmailInvite" ADD CONSTRAINT "GroupEmailInvite_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupEmailInvite" ADD CONSTRAINT "GroupEmailInvite_invitedByUserId_fkey" FOREIGN KEY ("invitedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

