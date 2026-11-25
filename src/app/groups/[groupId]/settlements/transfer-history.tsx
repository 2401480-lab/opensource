'use client'

import { Skeleton } from '@/components/ui/skeleton'
import {
  formatCurrency,
  formatDateOnly,
  getCurrencyFromGroup,
} from '@/lib/utils'
import { trpc } from '@/trpc/client'
import { ArrowRight, ChevronRight } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import Link from 'next/link'
import { useCurrentGroup } from '../current-group-context'
import { DisplayStatus, SettlementStatusBadge } from './settlement-status'

type Row = {
  key: string
  href: string
  from: string
  to: string
  amount: number
  date: Date
  status: DisplayStatus
}

/**
 * Every transfer between members: settlement requests with their status
 * (waiting for confirmation, settled, rejected, canceled), and transfers
 * recorded with the old form before confirmations existed.
 */
export function TransferHistory() {
  const t = useTranslations('Settlements.History')
  const locale = useLocale()
  const { groupId, group } = useCurrentGroup()
  const { data } = trpc.groups.settlements.list.useQuery({ groupId })

  if (!data || !group)
    return (
      <div className="px-6">
        <Skeleton className="h-10 w-full" />
      </div>
    )

  const currency = getCurrencyFromGroup(group)
  const nameOf = (id: string) =>
    group.participants.find((p) => p.id === id)?.name ?? ''
  const rows: Row[] = [
    ...data.settlements.map((s) => ({
      key: s.id,
      href: `/groups/${groupId}/settlements/${s.id}`,
      from: nameOf(s.fromParticipantId),
      to: nameOf(s.toParticipantId),
      amount: s.amount,
      date: s.paidAt,
      status: s.status as DisplayStatus,
    })),
    ...data.legacyTransfers.map((e) => ({
      key: e.id,
      href: `/groups/${groupId}/expenses/${e.id}/edit`,
      from: nameOf(e.paidById),
      to: e.paidFor.map((p) => nameOf(p.participantId)).join(', '),
      amount: e.amount,
      date: e.expenseDate,
      status: 'LEGACY' as const,
    })),
  ]
  if (rows.length === 0)
    return <p className="px-6 text-sm text-muted-foreground">{t('none')}</p>

  return (
    <ul className="flex flex-col">
      {rows.map((row) => (
        <li key={row.key} data-testid="transfer-row">
          <Link
            href={row.href}
            className="flex items-center justify-between gap-2 px-6 py-3 text-sm hover:bg-accent"
          >
            <span className="flex items-center gap-2 flex-wrap">
              <strong>{row.from}</strong>
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
              <strong>{row.to}</strong>
              <span className="tabular-nums">
                {formatCurrency(currency, row.amount, locale)}
              </span>
              <SettlementStatusBadge status={row.status} />
            </span>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              {formatDateOnly(row.date, locale, { dateStyle: 'medium' })}
              <ChevronRight className="w-4 h-4" />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
