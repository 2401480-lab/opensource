import { getTranslations } from 'next-intl/server'
import { Members } from './members'

export async function generateMetadata() {
  const t = await getTranslations('GroupNav')
  return { title: t('members') }
}

export default function MembersPage() {
  return <Members />
}
