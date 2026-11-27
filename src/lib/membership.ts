import 'server-only'
import { ActivityType, Prisma } from '@/generated/prisma/client'
import { logActivity } from '@/lib/api'
import { getCurrentUser } from '@/lib/auth'
import { getBalances, getSuggestedReimbursements } from '@/lib/balances'
import { prisma } from '@/lib/prisma'
import { randomId } from '@/lib/random'
import { checkRoleChange } from '@/lib/role-rules'

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
      | 'NOT_OWNER'
      | 'INVITE_NOT_FOR_YOU'
      | 'EMAIL_ALREADY_MEMBER'
      | 'NOT_A_MEMBER'
      | 'LAST_OWNER',
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

// ── Email invites (shown in the app, no mail is sent) ──

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

/**
 * Refuses emails that belong to someone who is already a member of the group
 * (or, for a new group, to its creator). Run before saving the group form so a
 * bad email does not leave a half-saved form.
 */
export async function checkInviteEmails({
  groupId,
  inviterEmail,
  emails,
}: {
  groupId: string | null
  inviterEmail: string
  emails: string[]
}) {
  if (emails.length === 0) return
  const memberEmails = new Set([normalizeEmail(inviterEmail)])
  if (groupId) {
    const members = await prisma.participant.findMany({
      where: { groupId, userId: { not: null } },
      select: { user: { select: { email: true } } },
    })
    for (const { user } of members)
      if (user) memberEmails.add(normalizeEmail(user.email))
  }
  const taken = emails.map(normalizeEmail).find((e) => memberEmails.has(e))
  if (taken) throw new MembershipError('EMAIL_ALREADY_MEMBER', taken)
}

/**
 * Makes the group's pending invites match the given participant -> email
 * entries: a new email replaces the previous invite, an empty one cancels it.
 * Participants already linked to an account are ignored. An email has at most
 * one pending invite per group.
 */
export async function syncEmailInvites(
  groupId: string,
  inviterUserId: string,
  entries: { participantId: string; email: string | null | undefined }[],
) {
  if (entries.length === 0) return
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Group" WHERE "id" = ${groupId} FOR UPDATE`
    const participants = await tx.participant.findMany({
      where: { groupId, id: { in: entries.map((e) => e.participantId) } },
      select: { id: true, userId: true },
    })
    const now = new Date()
    for (const entry of entries) {
      const participant = participants.find((p) => p.id === entry.participantId)
      if (!participant || participant.userId !== null) continue
      const email = entry.email ? normalizeEmail(entry.email) : null
      const current = await tx.groupEmailInvite.findFirst({
        where: { participantId: participant.id, status: 'PENDING' },
        select: { id: true, email: true },
      })
      if (current && current.email === email) continue
      await tx.groupEmailInvite.updateMany({
        where: {
          groupId,
          status: 'PENDING',
          OR: [
            { participantId: participant.id },
            ...(email ? [{ email }] : []),
          ],
        },
        data: { status: 'CANCELED', respondedAt: now },
      })
      if (email)
        await tx.groupEmailInvite.create({
          data: {
            id: randomId(),
            groupId,
            participantId: participant.id,
            email,
            invitedByUserId: inviterUserId,
          },
        })
    }
  })
}

/** Invites one participant who has not joined yet (members page). */
export async function sendEmailInvite({
  groupId,
  inviter,
  participantId,
  email,
}: {
  groupId: string
  inviter: { id: string; email: string }
  participantId: string
  email: string
}) {
  const participant = await prisma.participant.findFirst({
    where: { id: participantId, groupId },
    select: { userId: true },
  })
  if (!participant) throw new MembershipError('PARTICIPANT_NOT_FOUND')
  if (participant.userId !== null)
    throw new MembershipError('PARTICIPANT_TAKEN')
  await checkInviteEmails({
    groupId,
    inviterEmail: inviter.email,
    emails: [email],
  })
  await syncEmailInvites(groupId, inviter.id, [{ participantId, email }])
}

export async function cancelEmailInvite(groupId: string, inviteId: string) {
  const { count } = await prisma.groupEmailInvite.updateMany({
    where: { id: inviteId, groupId, status: 'PENDING' },
    data: { status: 'CANCELED', respondedAt: new Date() },
  })
  if (count === 0) throw new MembershipError('INVITE_INVALID')
}

/** Pending invites of the group, by participant (for its members). */
export async function getPendingInviteEmails(groupId: string) {
  const invites = await prisma.groupEmailInvite.findMany({
    where: { groupId, status: 'PENDING', participant: { userId: null } },
    select: { id: true, participantId: true, email: true },
  })
  return new Map(invites.map((i) => [i.participantId, i]))
}

/** Invites waiting for the signed-in user (matched on their account email). */
export async function listReceivedInvites(user: { id: string; email: string }) {
  const invites = await prisma.groupEmailInvite.findMany({
    where: {
      email: normalizeEmail(user.email),
      status: 'PENDING',
      participant: { userId: null },
      group: {
        deleteAt: null,
        participants: { none: { userId: user.id } },
      },
    },
    select: {
      id: true,
      createdAt: true,
      group: { select: { id: true, name: true } },
      participant: { select: { name: true } },
      invitedBy: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
  return invites.map((invite) => ({
    id: invite.id,
    createdAt: invite.createdAt.toISOString(),
    groupId: invite.group.id,
    groupName: invite.group.name,
    participantName: invite.participant.name,
    invitedByName: invite.invitedBy.name,
  }))
}

async function getInviteForUser(
  inviteId: string,
  user: { id: string; email: string },
) {
  const invite = await prisma.groupEmailInvite.findUnique({
    where: { id: inviteId },
    select: { groupId: true, participantId: true, email: true, status: true },
  })
  if (!invite || invite.status !== 'PENDING')
    throw new MembershipError('INVITE_INVALID')
  if (invite.email !== normalizeEmail(user.email))
    throw new MembershipError('INVITE_NOT_FOR_YOU')
  return invite
}

/** Joins the group as the invited participant. */
export async function acceptEmailInvite(
  inviteId: string,
  user: { id: string; email: string },
) {
  const invite = await getInviteForUser(inviteId, user)
  const closeInvite = () =>
    prisma.groupEmailInvite.updateMany({
      where: { id: inviteId, status: 'PENDING' },
      data: { status: 'CANCELED', respondedAt: new Date() },
    })
  let result: Awaited<ReturnType<typeof linkUser>>
  try {
    result = await linkUser({
      groupId: invite.groupId,
      userId: user.id,
      choice: { participantId: invite.participantId },
      role: 'MEMBER',
      precondition: async (tx) => {
        const { count } = await tx.groupEmailInvite.updateMany({
          where: { id: inviteId, status: 'PENDING' },
          data: { status: 'ACCEPTED', respondedAt: new Date() },
        })
        if (count === 0) throw new MembershipError('INVITE_INVALID')
      },
    })
  } catch (error) {
    // Someone else took that participant meanwhile: the invite is void.
    if (
      error instanceof MembershipError &&
      (error.code === 'PARTICIPANT_TAKEN' ||
        error.code === 'PARTICIPANT_NOT_FOUND')
    )
      await closeInvite()
    throw error
  }
  if (result.joined)
    await logActivity(invite.groupId, ActivityType.JOIN_GROUP, {
      participantId: result.membership.participantId,
      actorUserId: user.id,
    })
  // Already a member (e.g. joined with the link): the invite is not needed.
  else await closeInvite()
  return { groupId: invite.groupId, membership: result.membership }
}

export async function declineEmailInvite(
  inviteId: string,
  user: { id: string; email: string },
) {
  await getInviteForUser(inviteId, user)
  await prisma.groupEmailInvite.updateMany({
    where: { id: inviteId, status: 'PENDING' },
    data: { status: 'DECLINED', respondedAt: new Date() },
  })
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
              paymentSource: true,
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

/**
 * Changes a member's role (관리자 OWNER / 구성원 MEMBER). Only owners may do
 * this, and the group always keeps at least one owner. Runs with the group row
 * locked so two owners demoting each other at once cannot leave it ownerless;
 * the actor's role is re-checked inside the lock.
 */
export async function setParticipantRole({
  groupId,
  actorUserId,
  participantId,
  role,
}: {
  groupId: string
  actorUserId: string
  participantId: string
  role: 'OWNER' | 'MEMBER'
}) {
  const changed = await prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "Group" WHERE "id" = ${groupId} FOR UPDATE`
    if (locked.length === 0) throw new MembershipError('GROUP_NOT_FOUND')

    const actor = await tx.participant.findUnique({
      where: { groupId_userId: { groupId, userId: actorUserId } },
      select: { id: true, role: true },
    })
    if (!actor || actor.role !== 'OWNER') throw new MembershipError('NOT_OWNER')

    const target = await tx.participant.findFirst({
      where: { id: participantId, groupId },
      select: { id: true, userId: true, role: true },
    })
    if (!target) throw new MembershipError('PARTICIPANT_NOT_FOUND')

    const ownerCount = await tx.participant.count({
      where: { groupId, role: 'OWNER', userId: { not: null } },
    })
    const error = checkRoleChange({ target, newRole: role, ownerCount })
    if (error) throw new MembershipError(error)
    if (target.role === role) return null

    await tx.participant.update({
      where: { id: target.id },
      data: { role },
    })
    return { actorId: actor.id }
  })

  if (changed)
    await logActivity(groupId, ActivityType.CHANGE_ROLE, {
      participantId: changed.actorId,
      actorUserId,
      data: JSON.stringify({ target: participantId, role }),
    })
}
