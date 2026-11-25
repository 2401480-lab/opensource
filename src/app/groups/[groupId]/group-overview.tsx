'use client'

import { ExpenseCard } from '@/app/groups/[groupId]/expenses/expense-card'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { TrackPage } from '@/lib/analytics/track-page'
import { formatCurrency, getCurrencyFromGroup } from '@/lib/utils'
import { trpc } from '@/trpc/client'
import { Plus } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import Link from 'next/link'
import { useEffect } from 'react'
import { useCurrentGroup } from './current-group-context'
import { MySettlementCard } from './my-settlement-card'

export function GroupOverview() {
  const t = useTranslations('GroupOverview')
  const locale = useLocale()
  const { groupId, group } = useCurrentGroup()
  const utils = trpc.useUtils()
  const { data: stats } = trpc.groups.stats.overview.useQuery({ groupId })
  const { data: recent } = trpc.groups.expenses.list.useQuery({
    groupId,
    limit: 5,
    kind: 'expenses',
  })

  // Expenses may have changed on another page: refresh the amounts.
  useEffect(() => {
    utils.groups.balances.invalidate()
    utils.groups.stats.invalidate()
  }, [utils])

  const currency = group ? getCurrencyFromGroup(group) : undefined

  return (
    <>
      <TrackPage path={`/groups/${groupId}`} />
      <MySettlementCard showSettlementsLink />

      <Card>
        <CardHeader>
          <CardTitle>{t('summaryTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          {stats && currency ? (
            <dl className="grid grid-cols-2 gap-3">
              <div>
                <dt className="text-sm text-muted-foreground">
                  {t('groupTotal')}
                </dt>
                <dd className="text-lg font-semibold tabular-nums">
                  {formatCurrency(currency, stats.totalGroupSpendings, locale)}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">
                  {t('myShare')}
                </dt>
                <dd className="text-lg font-semibold tabular-nums">
                  {formatCurrency(
                    currency,
                    stats.totalParticipantShare ?? 0,
                    locale,
                  )}
                </dd>
              </div>
            </dl>
          ) : (
            <Skeleton className="h-12 w-full" />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
          <div className="space-y-1.5">
            <CardTitle>{t('recentTitle')}</CardTitle>
            <CardDescription>{t('recentDescription')}</CardDescription>
          </div>
          <Button asChild size="sm">
            <Link href={`/groups/${groupId}/expenses/create`}>
              <Plus className="w-4 h-4 mr-1" />
              {t('addExpense')}
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="p-0 pb-4">
          {!recent || !group || !currency ? (
            <div className="px-6">
              <Skeleton className="h-10 w-full" />
            </div>
          ) : recent.expenses.length === 0 ? (
            <p className="px-6 text-sm text-muted-foreground">
              {t('noExpenses')}
            </p>
          ) : (
            <>
              {recent.expenses.map((expense) => (
                <ExpenseCard
                  key={expense.id}
                  expense={expense}
                  currency={currency}
                  groupId={groupId}
                  participantCount={group.participants.length}
                />
              ))}
              <div className="px-6 pt-2">
                <Button variant="link" className="-mx-4" asChild>
                  <Link href={`/groups/${groupId}/expenses`}>
                    {t('allExpenses')}
                  </Link>
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </>
  )
}
