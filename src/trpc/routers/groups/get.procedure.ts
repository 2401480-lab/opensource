import { getGroup } from '@/lib/api'
import { groupProcedure } from '@/trpc/init'

/** Adds whether each participant is linked to an account (i.e. is a member). */
export function publicParticipants<T extends { userId: string | null }>(
  participants: T[],
) {
  return participants.map((participant) => ({
    ...participant,
    isLinked: participant.userId !== null,
  }))
}

export const getGroupProcedure = groupProcedure.query(
  async ({ ctx, input: { groupId } }) => {
    const group = await getGroup(groupId)
    return {
      group: group && {
        ...group,
        participants: publicParticipants(group.participants),
      },
      /** The signed-in user's participant in this group. */
      me: ctx.membership,
    }
  },
)
