'use client'

import { Money } from '@/components/money'
import { getBalances } from '@/lib/balances'
import { Currency } from '@/lib/currency'
import { useActiveUser } from '@/lib/hooks'
import { useTranslations } from 'next-intl'

type Props = {
  groupId: string
  currency: Currency
  expense: Parameters<typeof getBalances>[0][number]
}

/**
 * The signed-in member's share of one expense ("My share: 33,333"). It used to
 * show a per-expense balance (paid - share), which users read as money left
 * over; what someone owes overall is shown on the settlements page instead.
 */
export function ActiveUserBalance({ groupId, currency, expense }: Props) {
  const t = useTranslations('ExpenseCard')
  const activeUserId = useActiveUser(groupId)
  if (!activeUserId) return null

  const share = getBalances([expense])[activeUserId]?.paidFor ?? 0
  if (share === 0)
    return (
      <div className="text-xs text-muted-foreground">{t('notInvolved')}</div>
    )
  return (
    <div className="text-xs text-muted-foreground">
      {t('yourShare')} <Money currency={currency} amount={share} bold />
    </div>
  )
}
