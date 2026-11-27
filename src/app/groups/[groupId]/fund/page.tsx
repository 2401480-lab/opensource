import { getTranslations } from 'next-intl/server'
import { FundPage } from './fund-page'

export async function generateMetadata() {
  const t = await getTranslations('Fund')
  return { title: t('title') }
}

export default function GroupFundPage() {
  return <FundPage />
}
