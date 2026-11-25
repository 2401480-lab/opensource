import { MyGroupList } from '@/app/groups/my-group-list'
import { TrackPage } from '@/lib/analytics/track-page'
import { getTranslations } from 'next-intl/server'

export async function generateMetadata() {
  const t = await getTranslations('MyGroups')

  return {
    title: t('title'),
  }
}

export default async function GroupsPage() {
  return (
    <>
      <TrackPage path="/groups" />
      <MyGroupList />
    </>
  )
}
