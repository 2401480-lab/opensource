import 'server-only'
import { ActivityType, Prisma } from '@/generated/prisma/client'
import { Actor, getGroupExpenses } from '@/lib/api'
import { getBalances, getSuggestedReimbursements } from '@/lib/balances'
import { prisma } from '@/lib/prisma'
import { randomId } from '@/lib/random'
import {
  checkRequest,
  checkTransition,
  SettlementAction,
  SettlementRuleError,
} from '@/lib/settlement-rules'
import { getTranslations } from 'next-intl/server'

export class SettlementError extends Error {
  constructor(public readonly code: SettlementRuleError | 'NOT_FOUND') {
    super(code)
  }
}

/** Category of transfer records ("Payment"). */
const PAYMENT_CATEGORY_ID = 1

/** What `from` currently owes `to` according to the suggested settlement. */
async function suggestedAmount(groupId: string, from: string, to: string) {
  const balances = getBalances(await getGroupExpenses(groupId))
  return (
    getSuggestedReimbursements(balances).find(
      (r) => r.from === from && r.to === to,
    )?.amount ?? 0
  )
}

/** Locks the group row: settlement changes of a group happen one at a time. */
async function lockGroup(tx: Prisma.TransactionClient, groupId: string) {
  await tx.$queryRaw`SELECT "id" FROM "Group" WHERE "id" = ${groupId} FOR UPDATE`
}

async function logSettlementActivity(
  tx: Prisma.TransactionClient,
  groupId: string,
  activityType: ActivityType,
  actor: Actor,
  settlement: {
    id: string
    amount: number
    fromParticipantId: string
    toParticipantId: string
  },
) {
  await tx.activity.create({
    data: {
      id: randomId(),
      groupId,
      activityType,
      participantId: actor.participantId,
      actorUserId: actor.userId,
      settlementId: settlement.id,
      // Read by the activity list to write "Minsu asked Danbi to confirm 20,000".
      data: JSON.stringify({
        amount: settlement.amount,
        from: settlement.fromParticipantId,
        to: settlement.toParticipantId,
      }),
    },
  })
}

/**
 * The signed-in member says they sent `amount` to `toParticipantId`. Only
 * ever on their own behalf: the sender is the actor, never client input.
 */
export async function requestSettlement({
  groupId,
  actor,
  toParticipantId,
  amount,
  paidAt,
  note,
  documents,
}: {
  groupId: string
  actor: Actor
  toParticipantId: string
  amount: number
  paidAt: Date
  note?: string
  documents: { url: string; width: number; height: number }[]
}) {
  const recipient = await prisma.participant.findFirst({
    where: { id: toParticipantId, groupId },
    select: { id: true },
  })
  if (!recipient) throw new SettlementError('NOT_FOUND')

  const owed = await suggestedAmount(
    groupId,
    actor.participantId,
    toParticipantId,
  )

  return prisma.$transaction(async (tx) => {
    await lockGroup(tx, groupId)
    const hasPendingRequest =
      (await tx.settlement.count({
        where: {
          groupId,
          fromParticipantId: actor.participantId,
          toParticipantId,
          status: 'PENDING',
        },
      })) > 0
    const check = checkRequest({
      fromParticipantId: actor.participantId,
      toParticipantId,
      amount,
      suggestedAmount: owed,
      hasPendingRequest,
    })
    if (!check.ok) throw new SettlementError(check.error)

    const settlement = await tx.settlement.create({
      data: {
        id: randomId(),
        groupId,
        fromParticipantId: actor.participantId,
        toParticipantId,
        amount,
        paidAt,
        note: note?.trim() || null,
        requestedByUserId: actor.userId,
        documents: {
          createMany: {
            data: documents.map((doc) => ({ id: randomId(), ...doc })),
          },
        },
      },
    })
    await logSettlementActivity(
      tx,
      groupId,
      ActivityType.REQUEST_SETTLEMENT,
      actor,
      settlement,
    )
    return settlement
  })
}

/**
 * Confirm (recipient), reject (recipient) or cancel (sender) a pending
 * settlement. Confirming records the transfer, which is what changes the
 * balances.
 */
export async function respondToSettlement({
  groupId,
  settlementId,
  actor,
  action,
  reason,
}: {
  groupId: string
  settlementId: string
  actor: Actor
  action: SettlementAction
  reason?: string
}) {
  // Title of the transfer record, in the language of whoever confirms.
  const transferTitle = (await getTranslations('Settlements'))('transferTitle')

  return prisma.$transaction(async (tx) => {
    await lockGroup(tx, groupId)
    const settlement = await tx.settlement.findFirst({
      where: { id: settlementId, groupId },
    })
    if (!settlement) throw new SettlementError('NOT_FOUND')

    const check = checkTransition(settlement, action, actor.participantId)
    if (!check.ok) throw new SettlementError(check.error)

    let expenseId: string | undefined
    if (check.status === 'CONFIRMED') {
      expenseId = randomId()
      await tx.expense.create({
        data: {
          id: expenseId,
          groupId,
          expenseDate: settlement.paidAt,
          title: transferTitle,
          categoryId: PAYMENT_CATEGORY_ID,
          amount: settlement.amount,
          paidById: settlement.fromParticipantId,
          paidFor: {
            create: [{ participantId: settlement.toParticipantId, shares: 1 }],
          },
          splitMode: 'EVENLY',
          isReimbursement: true,
          notes: settlement.note,
        },
      })
    }

    const updated = await tx.settlement.update({
      where: { id: settlement.id },
      data: {
        status: check.status,
        respondedByUserId: actor.userId,
        respondedAt: new Date(),
        rejectReason: action === 'reject' ? reason?.trim() || null : null,
        expenseId,
      },
    })
    await logSettlementActivity(
      tx,
      groupId,
      {
        confirm: ActivityType.CONFIRM_SETTLEMENT,
        reject: ActivityType.REJECT_SETTLEMENT,
        cancel: ActivityType.CANCEL_SETTLEMENT,
      }[action],
      actor,
      settlement,
    )
    return updated
  })
}

export async function listSettlements(groupId: string) {
  return prisma.settlement.findMany({
    where: { groupId },
    orderBy: [{ createdAt: 'desc' }],
    include: { documents: true },
  })
}

export async function getSettlement(groupId: string, settlementId: string) {
  return prisma.settlement.findFirst({
    where: { id: settlementId, groupId },
    include: { documents: true },
  })
}

export { suggestedAmount as getSuggestedAmount }
