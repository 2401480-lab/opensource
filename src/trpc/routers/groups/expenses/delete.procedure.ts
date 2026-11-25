import { deleteExpense } from '@/lib/api'
import { prisma } from '@/lib/prisma'
import { groupProcedure } from '@/trpc/init'
import { TRPCError } from '@trpc/server'
import { z } from 'zod'

export const deleteGroupExpenseProcedure = groupProcedure
  .input(
    z.object({
      expenseId: z.string().min(1),
      groupId: z.string().min(1),
    }),
  )
  .mutation(async ({ ctx, input: { expenseId, groupId } }) => {
    if (await prisma.settlement.findUnique({ where: { expenseId } }))
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'This transfer was confirmed and cannot be deleted.',
      })
    await deleteExpense(groupId, expenseId, ctx.actor)
    return {}
  })
