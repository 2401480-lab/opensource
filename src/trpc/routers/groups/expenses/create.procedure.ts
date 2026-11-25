import { createExpense } from '@/lib/api'
import { expenseFormSchema } from '@/lib/schemas'
import { groupProcedure } from '@/trpc/init'
import { TRPCError } from '@trpc/server'
import { z } from 'zod'

export const createGroupExpenseProcedure = groupProcedure
  .input(
    z.object({
      groupId: z.string().min(1),
      expenseFormValues: expenseFormSchema,
      // Minted by the form with `randomId()` (a 21-character nanoid) so the
      // split it previews is the one the saved expense gets. Optional so
      // other callers keep getting a server-minted id.
      expenseId: z
        .string()
        .regex(/^[A-Za-z0-9_-]{21}$/)
        .optional(),
    }),
  )
  .mutation(
    async ({ ctx, input: { groupId, expenseFormValues, expenseId } }) => {
      // Transfers between members go through the settle-up flow (request,
      // then the recipient confirms), never straight into an expense.
      if (expenseFormValues.isReimbursement)
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Record transfers from the Settle up page.',
        })
      const expense = await createExpense(
        expenseFormValues,
        groupId,
        ctx.actor,
        expenseId,
      )
      return { expenseId: expense.id }
    },
  )
