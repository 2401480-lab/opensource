'use client'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Currency } from '@/lib/currency'
import { formatCurrency } from '@/lib/utils'
import { useLocale, useTranslations } from 'next-intl'
import Link from 'next/link'

type Props = {
  groupId: string
  currency?: Currency
  bySource?: {
    fund: { total: number; count: number }
    split: { total: number; count: number }
  }
  fund?: { collected: number; collectedCount: number; balance: number } | null
  myPaid?: number
  myShare?: number
}

/**
 * Where the group's money went in the period, in plain terms: what the shared
 * fund (회비) took in and paid, and what one member paid first and then split
 * with the others. Groups without a fund only see the second part.
 */
export function MoneyFlow({
  groupId,
  currency,
  bySource,
  fund,
  myPaid,
  myShare,
}: Props) {
  const t = useTranslations('Stats.MoneyFlow')
  const locale = useLocale()

  if (!currency || !bySource || fund === undefined)
    return (
      <Card className="mb-4">
        <CardContent className="pt-6">
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    )

  const money = (amount: number) => formatCurrency(currency, amount, locale)
  const total = bySource.fund.total + bySource.split.total
  const fundPercent =
    total > 0 ? Math.round((bySource.fund.total / total) * 100) : 0
  const difference =
    myPaid !== undefined && myShare !== undefined ? myPaid - myShare : undefined

  return (
    <Card className="mb-4" data-testid="money-flow">
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>
          {fund ? t('descriptionFund') : t('descriptionNoFund')}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {fund && (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-semibold">
              {t('totalLine', {
                total: money(total),
                fund: money(bySource.fund.total),
                split: money(bySource.split.total),
              })}
            </p>
            <div className="flex h-3 overflow-hidden rounded-full bg-muted">
              <div
                className="bg-primary"
                style={{ width: `${fundPercent}%` }}
              />
              <div
                className="bg-primary/40"
                style={{ width: `${total > 0 ? 100 - fundPercent : 0}%` }}
              />
            </div>
            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-primary" />
                {t('legendFund')}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-primary/40" />
                {t('legendSplit')}
              </span>
            </div>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {fund && (
            <section
              className="rounded-lg border p-4 flex flex-col gap-2 text-sm"
              data-testid="money-flow-fund"
            >
              <h3 className="font-semibold">{t('fundTitle')}</h3>
              <p className="text-xs text-muted-foreground">
                {t('fundDescription')}
              </p>
              <Row
                label={t('collected', { count: fund.collectedCount })}
                value={`+${money(fund.collected)}`}
              />
              <Row
                label={t('fundSpent', { count: bySource.fund.count })}
                value={`−${money(bySource.fund.total)}`}
              />
              <Row
                label={t('balance')}
                value={money(fund.balance)}
                strong
                border
              />
              <Button variant="link" className="self-start h-auto p-0" asChild>
                <Link href={`/groups/${groupId}/fund`}>{t('fundLink')}</Link>
              </Button>
            </section>
          )}

          <section
            className="rounded-lg border p-4 flex flex-col gap-2 text-sm"
            data-testid="money-flow-split"
          >
            <h3 className="font-semibold">{t('splitTitle')}</h3>
            <p className="text-xs text-muted-foreground">
              {t('splitDescription')}
            </p>
            <Row
              label={t('splitTotal', { count: bySource.split.count })}
              value={money(bySource.split.total)}
            />
            {difference !== undefined && (
              <>
                <Row label={t('myPaid')} value={money(myPaid!)} />
                <Row label={t('myShare')} value={`−${money(myShare!)}`} />
                <Row
                  label={difference >= 0 ? t('toReceive') : t('toSend')}
                  value={money(Math.abs(difference))}
                  strong
                  border
                />
                <p className="text-xs text-muted-foreground">
                  {t('beforeTransfers')}
                </p>
              </>
            )}
            <Button variant="link" className="self-start h-auto p-0" asChild>
              <Link href={`/groups/${groupId}/my-balance`}>
                {t('detailLink')}
              </Link>
            </Button>
          </section>
        </div>
      </CardContent>
    </Card>
  )
}

function Row({
  label,
  value,
  strong,
  border,
}: {
  label: string
  value: string
  strong?: boolean
  border?: boolean
}) {
  return (
    <div
      className={
        'flex justify-between gap-3' + (border ? ' border-t pt-2' : '')
      }
    >
      <span className={strong ? 'font-semibold' : undefined}>{label}</span>
      <span
        className={
          'tabular-nums whitespace-nowrap' + (strong ? ' font-semibold' : '')
        }
      >
        {value}
      </span>
    </div>
  )
}
