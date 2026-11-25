import { createGroup } from '@/lib/api'
import { checkInviteEmails, syncEmailInvites } from '@/lib/membership'
import { groupFormSchema } from '@/lib/schemas'
import { protectedProcedure } from '@/trpc/init'
import { toTRPCError } from '@/trpc/routers/membership'
import { z } from 'zod'

export const createGroupProcedure = protectedProcedure
  .input(
    z.object({
      groupFormValues: groupFormSchema,
    }),
  )
  .mutation(async ({ ctx, input: { groupFormValues } }) => {
    // The first row is the creator: it is linked to their account, never invited.
    const invited = groupFormValues.participants
      .map((participant, index) => ({ email: participant.email, index }))
      .filter(({ email, index }) => index > 0 && !!email)
    try {
      await checkInviteEmails({
        groupId: null,
        inviterEmail: ctx.user.email,
        emails: invited.map(({ email }) => email!),
      })
    } catch (error) {
      toTRPCError(error)
    }
    const group = await createGroup(groupFormValues, ctx.user.id)
    await syncEmailInvites(
      group.id,
      ctx.user.id,
      invited.map(({ email, index }) => ({
        participantId: group.formParticipantIds[index],
        email,
      })),
    )
    return { groupId: group.id }
  })
