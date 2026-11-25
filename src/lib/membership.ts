import 'server-only'
import { ActivityType, Prisma } from '@/generated/prisma/client'
import { logActivity } from '@/lib/api'
import { getCurrentUser } from '@/lib/auth'
import { getBalances, getSuggestedReimbursements } from '@/lib/balances'
import { prisma } from '@/lib/prisma'
import { randomId } from '@/lib/random'

/**
 * Group membership: which account is which participant of a group.
 *
 * A user is a member of a group when one of its participants is linked to
 * their account (`Participant.userId`). Links are only ever made by the user
 * explicitly picking a participant (or adding a new one) -- never by matching
 * names.
 */

export type Membership = {
  participantId: string
  participantName: string
  role: 'OWNER' | 'MEMBER'
}

export class MembershipError extends Error {
  constructor(
    public readonly code:
      | 'GROUP_NOT_FOUND'
      | 'INVITE_INVALID'
      | 'GROUP_ALREADY_CLAIMED'
      | 'PARTICIPANT_TAKEN'
      | 'PARTICIPANT_NOT_FOUND'
      | 'DUPLICATE_NAME'
      | 'NOT_OWNER',
    message?: string,
  ) {
    super(message ?? code)
  }
}

export async function getMembership(
  groupId: string,
  userId: string,
): Promise<Membership | null> {
  const participant = await prisma.participant.findUnique({
    where: { groupId_userId: { groupId, userId } },
    select: { id: true, name: true, role: true },
  })
  if (!participant) return null
  return {
    participantId: participant.id,
    participantName: participant.name,
    role: participant.role,
  }
}

export type GroupAccess =
  | { status: 'not-found' }
  | { status: 'member'; membership: Membership }
  /** Created before accounts existed and nobody has claimed it yet. */
  | { status: 'unclaimed' }
  /** Has members, and this user is not one of them: needs an invite link. */
  | { status: 'forbidden' }

export async function getGroupAccess(
  groupId: string,
  userId: string,
): Promise<GroupAccess> {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { id: true },
  })
  if (!group) return { status: 'not-found' }

  const membership = await getMembership(groupId, userId)
  if (membership) return { status: 'member', membership }

  const linkedCount = await prisma.participant.count({
    where: { groupId, userId: { not: null } },
  })
  return linkedCount === 0 ? { status: 'unclaimed' } : { status: 'forbidden' }
}

/** Who the user is in the group: an existing (unlinked) participant, or a new one. */
export type ParticipantChoice = { participantId: string } | { newName: string }

/** Group name and the participants still free to be picked. */
export async function getJoinableGroup(groupId: string) {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: {
      id: true,
      name: true,
      participants: {
        select: { id: true, name: true, userId: true },
        orderBy: { name: 'asc' },
      },
    },
  })
  if (!group) return null
  return {
    id: group.id,
    name: group.name,
    unlinkedParticipants: group.participants
      .filter((p) => p.userId === null)
      .map(({ id, name }) => ({ id, name })),
  }
}

/**
 * Links the user to a participant of the group (or creates one), inside a
 * transaction that locks the group row so concurrent joins/claims are
 * serialized. Returns the existing membership if the user already is a member.
 */
async function linkUser({
  groupId,
  userId,
  choice,
  role,
  precondition,
}: {
  groupId: string
  userId: string
  choice: ParticipantChoice
  role: 'OWNER' | 'MEMBER'
  precondition?: (tx: Prisma.TransactionClient) => Promise<void>
}): Promise<{ membership: Membership; joined: boolean }> {
  return prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "Group" WHERE "id" = ${groupId} FOR UPDATE`
    if (locked.length === 0) throw new MembershipError('GROUP_NOT_FOUND')

    const existing = await tx.participant.findUnique({
      where: { groupId_userId: { groupId, userId } },
      select: { id: true, name: true, role: true },
    })
    if (existing)
      return {
        membership: {
          participantId: existing.id,
          participantName: existing.name,
          role: existing.role,
        },
        joined: false,
      }

    await precondition?.(tx)

    let participant: { id: string; name: string }
    if ('participantId' in choice) {
      const target = await tx.participant.findFirst({
        where: { id: choice.participantId, groupId },
        select: { id: true, name: true, userId: true },
      })
      if (!target) throw new MembershipError('PARTICIPANT_NOT_FOUND')
      if (target.userId !== null) throw new MembershipError('PARTICIPANT_TAKEN')
      await tx.participant.update({
        where: { id: target.id },
        data: { userId, role },
      })
      participant = target
    } else {
      const name = choice.newName.trim()
      const sameName = await tx.participant.findFirst({
        where: { groupId, name },
        select: { id: true },
      })
      if (sameName) throw new MembershipError('DUPLICATE_NAME')
      participant = await tx.participant.create({
        data: { id: randomId(), groupId, name, userId, role },
        select: { id: true, name: true },
      })
    }

    return {
      membership: {
        participantId: participant.id,
        participantName: participant.name,
        role,
      },
      joined: true,
    }
  })
}

/**
 * Claims a group created before accounts existed. Only possible while no
 * participant of the group is linked to an account; the first claimer becomes
 * the owner. After that, joining requires an invite link.
 */
export async function claimUnclaimedGroup(
  groupId: string,
  userId: string,
  choice: ParticipantChoice,
) {
  const result = await linkUser({
    groupId,
    userId,
    choice,
    role: 'OWNER',
    precondition: async (tx) => {
      const linked = await tx.participant.count({
        where: { groupId, userId: { not: null } },
      })
      if (linked > 0) throw new MembershipError('GROUP_ALREADY_CLAIMED')
    },
  })
  if (result.joined)
    await logActivity(groupId, ActivityType.JOIN_GROUP, {
      participantId: result.membership.participantId,
      actorUserId: userId,
    })
  return result.membership
}

// ── Invites ──

/** The group's current invite link, created on first use. */
export async function getOrCreateInvite(groupId: string, userId: string) {
  const existing = await prisma.groupInvite.findFirst({
    where: { groupId, revokedAt: null },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  })
  if (existing) return existing.id
  const invite = await prisma.groupInvite.create({
    data: { id: randomId(), groupId, createdByUserId: userId },
    select: { id: true },
  })
  return invite.id
}

/** Revokes every active invite of the group and issues a new one. */
export async function regenerateInvite(groupId: string, userId: string) {
  return prisma.$transaction(async (tx) => {
    await tx.groupInvite.updateMany({
      where: { groupId, revokedAt: null },
      data: { revokedAt: new Date() },
    })
    const invite = await tx.groupInvite.create({
      data: { id: randomId(), groupId, createdByUserId: userId },
      select: { id: true },
    })
    return invite.id
  })
}

async function getActiveInvite(token: string) {
  const invite = await prisma.groupInvite.findUnique({
    where: { id: token },
    select: { groupId: true, revokedAt: true },
  })
  if (!invite || invite.revokedAt) return null
  return invite
}

export async function getInviteDetails(token: string, userId: string) {
  const invite = await getActiveInvite(token)
  if (!invite) return null
  const group = await getJoinableGroup(invite.groupId)
  if (!group) return null
  const membership = await getMembership(invite.groupId, userId)
  return { group, membership }
}

export async function joinGroupWithInvite(
  token: string,
  userId: string,
  choice: ParticipantChoice,
) {
  const invite = await getActiveInvite(token)
  if (!invite) throw new MembershipError('INVITE_INVALID')
  const result = await linkUser({
    groupId: invite.groupId,
    userId,
    choice,
    role: 'MEMBER',
  })
  if (result.joined)
    await logActivity(invite.groupId, ActivityType.JOIN_GROUP, {
      participantId: result.membership.participantId,
      actorUserId: userId,
    })
  return { groupId: invite.groupId, membership: result.membership }
}

// ── My groups ──

export type MyGroupSummary = {
  id: string
  name: string
  currency: string
  currencyCode: string | null
  createdAt: string
  deleteAt: string | null
  participantCount: number
  role: 'OWNER' | 'MEMBER'
  participantId: string
  participantName: string
  /** Net balance: positive = to receive, negative = to send. */
  balance: number
  /** Suggested transfers involving the user, in the group currency. */
  toSend: { to: string; amount: number }[]
  toReceive: { from: string; amount: number }[]
}

/** The groups the user is a member of, with their own settlement status. */
export async function listMyGroups(userId: string): Promise<MyGroupSummary[]> {
  const memberships = await prisma.participant.findMany({
    where: { userId },
    select: {
      id: true,
      name: true,
      role: true,
      group: {
        select: {
          id: true,
          name: true,
          currency: true,
          currencyCode: true,
          createdAt: true,
          deleteAt: true,
          participants: { select: { id: true, name: true } },
          expenses: {
            select: {
              id: true,
              amount: true,
              splitMode: true,
              paidBy: { select: { id: true } },
              paidFor: {
                select: { shares: true, participant: { select: { id: true } } },
              },
            },
          },
        },
      },
    },
    orderBy: { group: { createdAt: 'desc' } },
  })

  return memberships.map(({ id: participantId, name, role, group }) => {
    // getBalances only reads these fields of each expense.
    const balances = getBalances(
      group.expenses as unknown as Parameters<typeof getBalances>[0],
    )
    const reimbursements = getSuggestedReimbursements(balances)
    const nameOf = (id: string) =>
      group.participants.find((p) => p.id === id)?.name ?? ''
    return {
      id: group.id,
      name: group.name,
      currency: group.currency,
      currencyCode: group.currencyCode,
      createdAt: group.createdAt.toISOString(),
      deleteAt: group.deleteAt?.toISOString() ?? null,
      participantCount: group.participants.length,
      role,
      participantId,
      participantName: name,
      balance: balances[participantId]?.total ?? 0,
      toSend: reimbursements
        .filter((r) => r.from === participantId)
        .map((r) => ({ to: nameOf(r.to), amount: r.amount })),
      toReceive: reimbursements
        .filter((r) => r.to === participantId)
        .map((r) => ({ from: nameOf(r.from), amount: r.amount })),
    }
  })
}

/**
 * For route handlers: the signed-in user's membership of the group, or the
 * Response to return (401 without a session, 404 for non-members so as not to
 * reveal that the group exists).
 */
export async function requireGroupMemberForRoute(
  groupId: string,
): Promise<{ membership: Membership } | { response: Response }> {
  const user = await getCurrentUser()
  if (!user)
    return {
      response: Response.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  const membership = await getMembership(groupId, user.id)
  if (!membership)
    return { response: Response.json({ error: 'Not found' }, { status: 404 }) }
  return { membership }
}
