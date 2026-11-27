import { setParticipantRole } from '@/lib/membership'
import { createTRPCRouter, groupOwnerProcedure } from '@/trpc/init'
import { toTRPCError } from '@/trpc/routers/membership'
import { z } from 'zod'

export const groupMembersRouter = createTRPCRouter({
  /** Makes a member 관리자 (OWNER) or 구성원 (MEMBER). Owners only. */
  setRole: groupOwnerProcedure
    .input(
      z.object({
        participantId: z.string().min(1).max(64),
        role: z.enum(['OWNER', 'MEMBER']),
      }),
    )
    .mutation(async ({ ctx, input: { groupId, participantId, role } }) => {
      try {
        await setParticipantRole({
          groupId,
          actorUserId: ctx.user.id,
          participantId,
          role,
        })
      } catch (error) {
        toTRPCError(error)
      }
    }),
})
