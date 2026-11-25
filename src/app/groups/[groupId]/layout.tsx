import { cached } from '@/app/cached-functions'
import { getCurrentUser } from '@/lib/auth'
import { getGroupAccess, getMembership } from '@/lib/membership'
import { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { PropsWithChildren } from 'react'
import { ClaimGroup, NoGroupAccess } from './group-access'
import { GroupLayoutClient } from './layout.client'

type Props = {
  params: Promise<{
    groupId: string
  }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { groupId } = await params
  // Do not reveal a group's name to someone who is not a member.
  const user = await getCurrentUser()
  const isMember = user && (await getMembership(groupId, user.id))
  const group = isMember ? await cached.getGroup(groupId) : null

  return {
    title: {
      default: group?.name ?? '',
      template: `%s · ${group?.name} · Spliit`,
    },
  }
}

export default async function GroupLayout({
  children,
  params,
}: PropsWithChildren<Props>) {
  const { groupId } = await params

  // Server-side gate for every page of the group (the tRPC procedures check
  // membership again on their own).
  const user = await getCurrentUser()
  if (!user) redirect(`/login?next=${encodeURIComponent(`/groups/${groupId}`)}`)

  const access = await getGroupAccess(groupId, user.id)
  switch (access.status) {
    case 'not-found':
      notFound()
    case 'unclaimed':
      return <ClaimGroup groupId={groupId} userName={user.name} />
    case 'forbidden':
      return <NoGroupAccess />
    case 'member':
      return <GroupLayoutClient groupId={groupId}>{children}</GroupLayoutClient>
  }
}
