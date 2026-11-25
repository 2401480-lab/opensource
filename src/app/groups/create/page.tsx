import { CreateGroup } from '@/app/groups/create/create-group'
import { getCurrentUser } from '@/lib/auth'
import { env } from '@/lib/env'
import { getTranslations } from 'next-intl/server'
import { redirect } from 'next/navigation'

export async function generateMetadata() {
  const t = await getTranslations('Groups')

  return {
    title: t('createGroup'),
  }
}

export default async function CreateGroupPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login?next=/groups/create')
  // KRW unless the instance is configured otherwise; every currency remains
  // available in the form.
  const defaultCurrencyCode =
    env.DEFAULT_CURRENCY_CODE ?? env.NEXT_PUBLIC_DEFAULT_CURRENCY_CODE ?? 'KRW'
  return (
    <CreateGroup
      defaultCurrencyCode={defaultCurrencyCode}
      currentUserName={user.name}
    />
  )
}
