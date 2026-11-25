import { getCurrentUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { JoinGroup } from './join-group'

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const user = await getCurrentUser()
  if (!user) redirect(`/login?next=${encodeURIComponent(`/invite/${token}`)}`)
  return (
    <main className="flex-1 max-w-screen-sm w-full mx-auto px-4 py-6">
      <JoinGroup token={token} userName={user.name} />
    </main>
  )
}
