import { getGroup } from '@/lib/api'
import { getPendingInviteEmails } from '@/lib/membership'
import { groupProcedure } from '@/trpc/init'

/**
 * Adds whether each participant is linked to an account (i.e. is a member),
 * and the pending email invite of those who are not (members only see this).
 */
export function publicParticipants<
  T extends { id: string; userId: string | null },
>(
  participants: T[],
  pendingInvites: Awaited<ReturnType<typeof getPendingInviteEmails>>,
) {
  return participants.map((participant) => {
    const invite = pendingInvites.get(participant.id)
    return {
      ...participant,
      isLinked: participant.userId !== null,
      invite: invite ? { id: invite.id, email: invite.email } : null,
    }
  })
}

export const getGroupProcedure = groupProcedure.query(
  async ({ ctx, input: { groupId } }) => {
    const group = await getGroup(groupId)
    return {
      group: group && {
        ...group,
        participants: publicParticipants(
          group.participants,
          await getPendingInviteEmails(groupId),
        ),
      },
      /** The signed-in user's participant in this group. */
      me: ctx.membership,
    }
  },
)
