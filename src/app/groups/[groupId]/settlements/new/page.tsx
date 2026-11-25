import { getRuntimeFeatureFlags } from '@/lib/featureFlags'
import { getTranslations } from 'next-intl/server'
import { RequestSettlementForm } from './request-settlement-form'

export const dynamic = 'force-dynamic'

export async function generateMetadata() {
  const t = await getTranslations('Settlements.Request')
  return { title: t('title') }
}

export default async function NewSettlementPage({
  searchParams,
}: {
  searchParams: Promise<{ to?: string; amount?: string }>
}) {
  const { to, amount } = await searchParams
  const { enableExpenseDocuments } = await getRuntimeFeatureFlags()
  return (
    <RequestSettlementForm
      defaultTo={to}
      defaultAmount={amount ? Number(amount) : undefined}
      enableDocuments={enableExpenseDocuments}
    />
  )
}
