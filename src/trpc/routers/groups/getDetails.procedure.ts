import { getGroup, getGroupExpensesParticipants } from '@/lib/api'
import { prisma } from '@/lib/prisma'
import { groupProcedure } from '@/trpc/init'
import { TRPCError } from '@trpc/server'
import { publicParticipants } from './get.procedure'

export const getGroupDetailsProcedure = groupProcedure.query(
  async ({ input: { groupId } }) => {
    const group = await getGroup(groupId)
    if (!group) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Group not found.',
      })
    }

    const participantsWithExpenses = await getGroupExpensesParticipants(groupId)
    // Members (linked to an account) cannot be removed from the list either.
    const inSettlements = await prisma.settlement.findMany({
      where: { groupId },
      select: { fromParticipantId: true, toParticipantId: true },
    })
    const linkedParticipants = group.participants
      .filter((p) => p.userId !== null)
      .map((p) => p.id)
    return {
      group: { ...group, participants: publicParticipants(group.participants) },
      participantsWithExpenses: Array.from(
        new Set([
          ...participantsWithExpenses,
          ...linkedParticipants,
          ...inSettlements.flatMap((s) => [
            s.fromParticipantId,
            s.toParticipantId,
          ]),
        ]),
      ),
    }
  },
)
