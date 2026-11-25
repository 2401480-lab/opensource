import { prisma } from '@/lib/prisma'
import {
  getSettlement,
  getSuggestedAmount,
  listSettlements,
  requestSettlement,
  respondToSettlement,
  SettlementError,
} from '@/lib/settlements'
import { createTRPCRouter, groupProcedure } from '@/trpc/init'
import { TRPCError } from '@trpc/server'
import { z } from 'zod'

function toTRPCError(error: unknown): never {
  if (error instanceof SettlementError) {
    const code = (
      {
        NOT_FOUND: 'NOT_FOUND',
        NOT_SENDER: 'FORBIDDEN',
        NOT_RECIPIENT: 'FORBIDDEN',
        NOT_PENDING: 'CONFLICT',
        ALREADY_PENDING: 'CONFLICT',
        SELF_TRANSFER: 'BAD_REQUEST',
        INVALID_AMOUNT: 'BAD_REQUEST',
        NOTHING_TO_SETTLE: 'BAD_REQUEST',
        AMOUNT_TOO_HIGH: 'BAD_REQUEST',
      } as const
    )[error.code]
    throw new TRPCError({ code, message: error.code })
  }
  throw error
}

const documentsSchema = z
  .array(
    z.object({
      url: z.string().url().max(2000),
      width: z.number().int().min(1),
      height: z.number().int().min(1),
    }),
  )
  .max(10)
  .default([])

/**
 * Settling up. Every procedure acts as the signed-in member (`ctx.actor`):
 * a member asks for confirmation of a transfer they sent; only its recipient
 * confirms or rejects it; only its sender cancels it.
 */
export const groupSettlementsRouter = createTRPCRouter({
  list: groupProcedure.query(async ({ input: { groupId } }) => {
    const [settlements, legacyTransfers] = await Promise.all([
      listSettlements(groupId),
      // Transfers recorded before settlement requests existed (or with the
      // old form): shown as history, they were never confirmed.
      prisma.expense.findMany({
        where: { groupId, isReimbursement: true, settlement: { is: null } },
        select: {
          id: true,
          amount: true,
          expenseDate: true,
          paidById: true,
          paidFor: { select: { participantId: true } },
        },
        orderBy: [{ expenseDate: 'desc' }, { createdAt: 'desc' }],
      }),
    ])
    return { settlements, legacyTransfers }
  }),

  get: groupProcedure
    .input(z.object({ settlementId: z.string().min(1).max(64) }))
    .query(async ({ input: { groupId, settlementId } }) => {
      const settlement = await getSettlement(groupId, settlementId)
      if (!settlement) throw new TRPCError({ code: 'NOT_FOUND' })
      // What the sender owes the recipient now, to warn when expenses changed
      // since the request.
      const currentlyOwed = await getSuggestedAmount(
        groupId,
        settlement.fromParticipantId,
        settlement.toParticipantId,
      )
      return { settlement, currentlyOwed }
    }),

  request: groupProcedure
    .input(
      z.object({
        toParticipantId: z.string().min(1).max(64),
        amount: z.number().int().positive(),
        paidAt: z.coerce.date(),
        note: z.string().max(500).optional(),
        documents: documentsSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const settlement = await requestSettlement({
          groupId: input.groupId,
          actor: ctx.actor,
          toParticipantId: input.toParticipantId,
          amount: input.amount,
          paidAt: input.paidAt,
          note: input.note,
          documents: input.documents,
        })
        return { settlementId: settlement.id }
      } catch (error) {
        toTRPCError(error)
      }
    }),

  respond: groupProcedure
    .input(
      z.object({
        settlementId: z.string().min(1).max(64),
        action: z.enum(['confirm', 'reject', 'cancel']),
        reason: z.string().max(500).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const settlement = await respondToSettlement({
          groupId: input.groupId,
          settlementId: input.settlementId,
          actor: ctx.actor,
          action: input.action,
          reason: input.reason,
        })
        return { status: settlement.status }
      } catch (error) {
        toTRPCError(error)
      }
    }),
})
