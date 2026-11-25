import { getTranslations } from 'next-intl/server'
import { SettlementsPage } from './settlements-page'

export async function generateMetadata() {
  const t = await getTranslations('Settlements')
  return { title: t('title') }
}

export default function GroupSettlementsPage() {
  return <SettlementsPage />
}
