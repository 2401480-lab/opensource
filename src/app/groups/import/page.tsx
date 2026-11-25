import { getTranslations } from 'next-intl/server'
import { ImportGroups } from './import-groups'

export async function generateMetadata() {
  const t = await getTranslations('MyGroups.import')
  return { title: t('title') }
}

export default function ImportGroupsPage() {
  return <ImportGroups />
}
