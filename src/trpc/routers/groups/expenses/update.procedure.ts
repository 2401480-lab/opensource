import { getExpense, updateExpense } from '@/lib/api'
import { prisma } from '@/lib/prisma'
import { expenseFormSchema } from '@/lib/schemas'
import { groupProcedure } from '@/trpc/init'
import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { assertFundExpenseAllowed } from './fund-guard'

export const updateGroupExpenseProcedure = groupProcedure
  .input(
    z.object({
      expenseId: z.string().min(1),
      groupId: z.string().min(1),
      expenseFormValues: expenseFormSchema,
    }),
  )
  .mutation(
    async ({ ctx, input: { expenseId, groupId, expenseFormValues } }) => {
      const existing = await getExpense(groupId, expenseId)
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND' })
      // A confirmed settlement's transfer record is a fact both members
      // agreed on: it cannot be edited as an expense.
      if (await prisma.settlement.findUnique({ where: { expenseId } }))
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'This transfer was confirmed and cannot be edited.',
        })
      // An expense cannot be turned into a transfer, nor the other way round.
      if (expenseFormValues.isReimbursement !== existing.isReimbursement)
        throw new TRPCError({ code: 'BAD_REQUEST' })
      if (
        expenseFormValues.paymentSource === 'FUND' &&
        expenseFormValues.isReimbursement
      )
        throw new TRPCError({ code: 'BAD_REQUEST' })
      await assertFundExpenseAllowed({
        groupId,
        membership: ctx.membership,
        before: existing.paymentSource,
        after: expenseFormValues.paymentSource,
      })
      const expense = await updateExpense(
        groupId,
        expenseId,
        expenseFormValues,
        ctx.actor,
      )
      return { expenseId: expense.id }
    },
  )
