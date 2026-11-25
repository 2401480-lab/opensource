import {
  cancelEmailInvite,
  getOrCreateInvite,
  regenerateInvite,
  sendEmailInvite,
} from '@/lib/membership'
import {
  createTRPCRouter,
  groupOwnerProcedure,
  groupProcedure,
} from '@/trpc/init'
import { toTRPCError } from '@/trpc/routers/membership'
import { z } from 'zod'

export const groupInvitesRouter = createTRPCRouter({
  /** The group's current invite token (any member can share it). */
  get: groupProcedure.query(async ({ ctx, input: { groupId } }) => {
    const token = await getOrCreateInvite(groupId, ctx.user.id)
    return { token }
  }),
  /** Revokes the current link and issues a new one (owner only). */
  regenerate: groupOwnerProcedure.mutation(
    async ({ ctx, input: { groupId } }) => {
      const token = await regenerateInvite(groupId, ctx.user.id)
      return { token }
    },
  ),
  /** Invites a participant who has not joined yet, by email (any member). */
  sendEmail: groupProcedure
    .input(
      z.object({
        participantId: z.string().min(1).max(64),
        email: z.string().trim().toLowerCase().max(254).email(),
      }),
    )
    .mutation(async ({ ctx, input: { groupId, participantId, email } }) => {
      try {
        await sendEmailInvite({
          groupId,
          inviter: ctx.user,
          participantId,
          email,
        })
      } catch (error) {
        toTRPCError(error)
      }
    }),
  /** Withdraws a pending email invite (any member). */
  cancelEmail: groupProcedure
    .input(z.object({ inviteId: z.string().min(1).max(64) }))
    .mutation(async ({ input: { groupId, inviteId } }) => {
      try {
        await cancelEmailInvite(groupId, inviteId)
      } catch (error) {
        toTRPCError(error)
      }
    }),
})
