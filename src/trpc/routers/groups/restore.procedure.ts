import { restoreGroup } from '@/lib/api'
import { groupOwnerProcedure } from '@/trpc/init'
import { z } from 'zod'

export const restoreGroupProcedure = groupOwnerProcedure
  .input(
    z.object({
      groupId: z.string().min(1),
    }),
  )
  .mutation(async ({ ctx, input: { groupId } }) => {
    await restoreGroup(groupId, ctx.actor)
  })
