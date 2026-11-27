'use client'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Currency } from '@/lib/currency'
import { ParticipantSpending } from '@/lib/totals'
import { formatCurrency } from '@/lib/utils'
import { useLocale, useTranslations } from 'next-intl'

type Props = {
  participants?: ParticipantSpending[]
  currency?: Currency
}

export function ParticipantSpendingStats({ participants, currency }: Props) {
  const t = useTranslations('Stats.ByParticipant')

  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent>
        {!participants || !currency ? (
          <div className="flex flex-col gap-3">
            {[0, 1, 2].map((index) => (
              <Skeleton key={index} className="h-5 w-full" />
            ))}
          </div>
        ) : participants.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('empty')}</p>
        ) : (
          <ParticipantTable participants={participants} currency={currency} />
        )}
      </CardContent>
    </Card>
  )
}

function ParticipantTable({
  participants,
  currency,
}: {
  participants: ParticipantSpending[]
  currency: Currency
}) {
  const locale = useLocale()
  const t = useTranslations('Stats.ByParticipant')
  const sum = (pick: (p: ParticipantSpending) => number) =>
    participants.reduce((total, p) => total + pick(p), 0)

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="h-8 px-2">{t('participant')}</TableHead>
          <TableHead className="h-8 px-2 text-right">{t('paid')}</TableHead>
          <TableHead className="h-8 px-2 text-right">{t('count')}</TableHead>
          <TableHead className="h-8 px-2 text-right">{t('share')}</TableHead>
          <TableHead className="h-8 px-2 text-right">
            {t('difference')}
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {participants.map((participant) => (
          <TableRow key={participant.participantId}>
            <TableCell className="p-2 font-medium">
              {participant.name}
            </TableCell>
            <TableCell className="p-2 text-right tabular-nums">
              {formatCurrency(currency, participant.paid, locale)}
            </TableCell>
            <TableCell className="p-2 text-right tabular-nums text-muted-foreground">
              {participant.paidCount}
            </TableCell>
            <TableCell className="p-2 text-right tabular-nums text-muted-foreground">
              {formatCurrency(currency, participant.share, locale)}
            </TableCell>
            <DifferenceCell
              amount={participant.paid - participant.share}
              currency={currency}
            />
          </TableRow>
        ))}
        <TableRow className="font-semibold">
          <TableCell className="p-2">{t('total')}</TableCell>
          <TableCell className="p-2 text-right tabular-nums">
            {formatCurrency(
              currency,
              sum((p) => p.paid),
              locale,
            )}
          </TableCell>
          <TableCell className="p-2 text-right tabular-nums">
            {sum((p) => p.paidCount)}
          </TableCell>
          <TableCell className="p-2 text-right tabular-nums">
            {formatCurrency(
              currency,
              sum((p) => p.share),
              locale,
            )}
          </TableCell>
          <TableCell className="p-2" />
        </TableRow>
      </TableBody>
    </Table>
  )
}

/** Paid first − own share: + gets money back, − owes money (before transfers). */
function DifferenceCell({
  amount,
  currency,
}: {
  amount: number
  currency: Currency
}) {
  const locale = useLocale()
  const t = useTranslations('Stats.ByParticipant')
  if (amount === 0)
    return (
      <TableCell className="p-2 text-right text-muted-foreground">—</TableCell>
    )
  return (
    <TableCell
      className={
        'p-2 text-right tabular-nums whitespace-nowrap font-medium ' +
        (amount > 0
          ? 'text-emerald-700 dark:text-emerald-400'
          : 'text-red-700 dark:text-red-400')
      }
    >
      {amount > 0 ? '+' : '−'}
      {formatCurrency(currency, Math.abs(amount), locale)}{' '}
      <span className="text-xs font-normal">
        {amount > 0 ? t('getsBack') : t('owes')}
      </span>
    </TableCell>
  )
}
