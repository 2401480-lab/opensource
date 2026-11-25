import { updateGroup } from '@/lib/api'
import { groupFormSchema } from '@/lib/schemas'
import { groupProcedure } from '@/trpc/init'
import { z } from 'zod'

export const updateGroupProcedure = groupProcedure
  .input(
    z.object({
      groupId: z.string().min(1),
      groupFormValues: groupFormSchema,
    }),
  )
  .mutation(async ({ ctx, input: { groupId, groupFormValues } }) => {
    await updateGroup(groupId, groupFormValues, ctx.actor)
  })
