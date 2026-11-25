import { CreateExpenseForm } from '@/app/groups/[groupId]/expenses/create-expense-form'
import { getRuntimeFeatureFlags } from '@/lib/featureFlags'
import { getTranslations } from 'next-intl/server'
import { redirect } from 'next/navigation'

export async function generateMetadata() {
  const t = await getTranslations('ExpenseForm')

  return {
    title: t('Expense.create'),
  }
}

export default async function ExpensePage({
  params,
  searchParams,
}: {
  params: Promise<{ groupId: string }>
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const { groupId } = await params
  // Old "Mark as paid" links: transfers are now recorded as settlement
  // requests, on their own page.
  const { reimbursement, to, amount } = await searchParams
  if (reimbursement) {
    const query = new URLSearchParams()
    if (to) query.set('to', to)
    if (amount) query.set('amount', amount)
    redirect(`/groups/${groupId}/settlements/new?${query}`)
  }
  return (
    <CreateExpenseForm
      groupId={groupId}
      runtimeFeatureFlags={await getRuntimeFeatureFlags()}
    />
  )
}
