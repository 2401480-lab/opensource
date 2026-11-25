import { getOrCreateInvite, regenerateInvite } from '@/lib/membership'
import {
  createTRPCRouter,
  groupOwnerProcedure,
  groupProcedure,
} from '@/trpc/init'

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
})
