import { getCurrentUser } from '@/lib/auth'
import { getTranslations } from 'next-intl/server'
import { redirect } from 'next/navigation'
import { AccountForm } from './account-form'

export async function generateMetadata() {
  const t = await getTranslations('Account')
  return { title: t('title') }
}

export default async function AccountPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login?next=/account')
  return (
    <main className="flex-1 max-w-screen-md w-full mx-auto px-4 py-6">
      <AccountForm user={user} />
    </main>
  )
}
