import { getTranslations } from 'next-intl/server'
import { FundSettings } from './fund-settings'

export async function generateMetadata() {
  const t = await getTranslations('FundSettings')
  return { title: t('title') }
}

export default function GroupFundSettingsPage() {
  return <FundSettings />
}
