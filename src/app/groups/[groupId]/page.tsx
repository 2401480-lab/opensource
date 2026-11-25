import { getTranslations } from 'next-intl/server'
import { GroupOverview } from './group-overview'

export async function generateMetadata() {
  const t = await getTranslations('GroupNav')
  return { title: t('overview') }
}

/** The group's first screen: what the signed-in member has to do. */
export default function GroupPage() {
  return <GroupOverview />
}
