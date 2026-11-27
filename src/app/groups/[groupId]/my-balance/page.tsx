import { getTranslations } from 'next-intl/server'
import { MyBalance } from './my-balance'

export async function generateMetadata() {
  const t = await getTranslations('MyBalance')
  return { title: t('title') }
}

export default function MyBalancePage() {
  return <MyBalance />
}
