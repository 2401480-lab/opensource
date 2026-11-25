import { updateGroup } from '@/lib/api'
import { checkInviteEmails, syncEmailInvites } from '@/lib/membership'
import { groupFormSchema } from '@/lib/schemas'
import { groupProcedure } from '@/trpc/init'
import { toTRPCError } from '@/trpc/routers/membership'
import { z } from 'zod'

export const updateGroupProcedure = groupProcedure
  .input(
    z.object({
      groupId: z.string().min(1),
      groupFormValues: groupFormSchema,
    }),
  )
  .mutation(async ({ ctx, input: { groupId, groupFormValues } }) => {
    try {
      await checkInviteEmails({
        groupId,
        inviterEmail: ctx.user.email,
        emails: groupFormValues.participants
          .map((participant) => participant.email)
          .filter((email): email is string => !!email),
      })
    } catch (error) {
      toTRPCError(error)
    }
    const group = await updateGroup(groupId, groupFormValues, ctx.actor)
    // Every row is synced: an emptied email field cancels that invite.
    await syncEmailInvites(
      groupId,
      ctx.user.id,
      groupFormValues.participants.map((participant, index) => ({
        participantId: group.formParticipantIds[index],
        email: participant.email,
      })),
    )
  })
