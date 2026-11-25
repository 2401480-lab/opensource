import { MAX_GROUPS_PER_QUERY } from '@/lib/group-query-limits'
import {
  claimUnclaimedGroup,
  getGroupAccess,
  getInviteDetails,
  getJoinableGroup,
  joinGroupWithInvite,
  MembershipError,
} from '@/lib/membership'
import { createTRPCRouter, protectedProcedure } from '@/trpc/init'
import { TRPCError } from '@trpc/server'
import { z } from 'zod'

const choiceSchema = z.union([
  z.object({ participantId: z.string().min(1).max(64) }),
  z.object({ newName: z.string().trim().min(2).max(50) }),
])

function toTRPCError(error: unknown): never {
  if (error instanceof MembershipError) {
    const code = (
      {
        GROUP_NOT_FOUND: 'NOT_FOUND',
        INVITE_INVALID: 'NOT_FOUND',
        PARTICIPANT_NOT_FOUND: 'NOT_FOUND',
        GROUP_ALREADY_CLAIMED: 'CONFLICT',
        PARTICIPANT_TAKEN: 'CONFLICT',
        DUPLICATE_NAME: 'CONFLICT',
        NOT_OWNER: 'FORBIDDEN',
      } as const
    )[error.code]
    throw new TRPCError({ code, message: error.code })
  }
  throw error
}

/** Joining groups: invite links, and claiming groups created before accounts. */
export const membershipRouter = createTRPCRouter({
  invite: protectedProcedure
    .input(z.object({ token: z.string().min(1).max(64) }))
    .query(async ({ ctx, input: { token } }) => {
      const details = await getInviteDetails(token, ctx.user.id)
      if (!details) throw new TRPCError({ code: 'NOT_FOUND' })
      return details
    }),

  joinWithInvite: protectedProcedure
    .input(z.object({ token: z.string().min(1).max(64), choice: choiceSchema }))
    .mutation(async ({ ctx, input: { token, choice } }) => {
      try {
        return await joinGroupWithInvite(token, ctx.user.id, choice)
      } catch (error) {
        toTRPCError(error)
      }
    }),

  /** A group nobody has claimed yet (only visible to signed-in users with its URL). */
  unclaimedGroup: protectedProcedure
    .input(z.object({ groupId: z.string().min(1).max(64) }))
    .query(async ({ ctx, input: { groupId } }) => {
      const access = await getGroupAccess(groupId, ctx.user.id)
      if (access.status !== 'unclaimed') return { group: null, access }
      return { group: await getJoinableGroup(groupId), access }
    }),

  /** For groups this device remembers: is the user a member, can they claim it? */
  accessList: protectedProcedure
    .input(
      z.object({
        groupIds: z.array(z.string().min(1).max(64)).max(MAX_GROUPS_PER_QUERY),
      }),
    )
    .query(async ({ ctx, input: { groupIds } }) => {
      const statuses = await Promise.all(
        groupIds.map(async (groupId) => ({
          groupId,
          status: (await getGroupAccess(groupId, ctx.user.id)).status,
        })),
      )
      return { statuses }
    }),

  claim: protectedProcedure
    .input(
      z.object({ groupId: z.string().min(1).max(64), choice: choiceSchema }),
    )
    .mutation(async ({ ctx, input: { groupId, choice } }) => {
      try {
        const membership = await claimUnclaimedGroup(
          groupId,
          ctx.user.id,
          choice,
        )
        return { groupId, membership }
      } catch (error) {
        toTRPCError(error)
      }
    }),
})
