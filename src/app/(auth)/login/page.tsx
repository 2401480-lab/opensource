import { getCurrentUser } from '@/lib/auth'
import { safeNextPath } from '@/lib/safe-next-path'
import { getTranslations } from 'next-intl/server'
import { redirect } from 'next/navigation'
import { AuthShell } from '../auth-shell'
import { LoginForm } from './login-form'

export async function generateMetadata() {
  const t = await getTranslations('Auth')
  return { title: t('loginTitle') }
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const next = safeNextPath((await searchParams).next)
  if (await getCurrentUser()) redirect(next)
  return (
    <AuthShell>
      <LoginForm next={next} />
    </AuthShell>
  )
}
