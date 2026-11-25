import { getTranslations } from 'next-intl/server'
import { SettlementDetail } from './settlement-detail'

export async function generateMetadata() {
  const t = await getTranslations('Settlements.Detail')
  return { title: t('title') }
}

export default async function SettlementPage({
  params,
}: {
  params: Promise<{ settlementId: string }>
}) {
  const { settlementId } = await params
  return <SettlementDetail settlementId={settlementId} />
}
