'use client'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { cn, formatCurrency, getCurrencyFromGroup } from '@/lib/utils'
import { trpc } from '@/trpc/client'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import Link from 'next/link'
import { useState } from 'react'
import { useCurrentGroup } from '../current-group-context'

type State = 'REST' | 'PAID' | 'PENDING' | 'EXEMPT' | 'UNPAID'

const stateStyle: Record<State, string> = {
  PAID: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
  PENDING: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
  UNPAID: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200',
  EXEMPT: 'bg-muted text-muted-foreground',
  REST: 'bg-muted text-muted-foreground',
}

export function monthLabel(month: string, locale: string) {
  const [year, m] = month.split('-').map(Number)
  return new Date(Date.UTC(year, m - 1, 1)).toLocaleDateString(locale, {
    year: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  })
}

/** 회비: the account balance, who paid this month, and the fund's history. */
export function FundPage() {
  const t = useTranslations('Fund')
  const locale = useLocale()
  const { groupId, group } = useCurrentGroup()
  const [month, setMonth] = useState<string | undefined>()
  const [filter, setFilter] = useState<'all' | 'payment' | 'expense'>('all')
  const { data: groupData } = trpc.groups.get.useQuery({ groupId })
  const { data } = trpc.groups.fund.get.useQuery({ groupId, month })
  const utils = trpc.useUtils()
  const [error, setError] = useState<string | null>(null)
  const onSuccess = async () => {
    setError(null)
    await utils.groups.fund.invalidate()
  }
  const onError = (e: { message: string }) =>
    setError(
      ['REST_MONTH', 'ALREADY_PAID', 'ALREADY_REQUESTED', 'EXEMPT'].includes(
        e.message,
      )
        ? t(`errors.${e.message}`)
        : t('errors.generic'),
    )
  const request = trpc.groups.fund.requestPayment.useMutation({
    onSuccess,
    onError,
  })
  const cancel = trpc.groups.fund.cancelRequest.useMutation({
    onSuccess,
    onError,
  })

  if (!group || !data || !groupData?.me)
    return (
      <Card>
        <CardContent className="pt-6">
          <Skeleton className="h-40 w-full" />
        </CardContent>
      </Card>
    )

  const me = groupData.me
  const isAdmin = me.role === 'OWNER'
  const currency = getCurrencyFromGroup(group)
  const money = (amount: number) => formatCurrency(currency, amount, locale)
  const label = monthLabel(data.month, locale)
  const index = data.months.indexOf(data.month)
  const myRow = data.rows.find((r) => r.participantId === me.participantId)
  const billed = data.rows.filter((r) => r.state !== 'EXEMPT').length

  if (!data.settings.enabled)
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
          <CardDescription>{t('disabled')}</CardDescription>
        </CardHeader>
        {isAdmin && (
          <CardContent>
            <Button asChild>
              <Link href={`/groups/${groupId}/fund/settings`}>
                {t('openSettings')}
              </Link>
            </Button>
          </CardContent>
        )}
      </Card>
    )

  const history = data.history.filter(
    (h) => filter === 'all' || h.kind === filter,
  )

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-2xl font-bold">{t('title')}</h2>
        <div className="flex flex-wrap gap-2">
          {isAdmin && (
            <>
              <Button variant="outline" asChild>
                <Link href={`/groups/${groupId}/fund/settings`}>
                  {t('settingsButton')}
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href={`/groups/${groupId}/expenses/create?source=fund`}>
                  {t('spendButton')}
                </Link>
              </Button>
            </>
          )}
          {myRow?.state === 'UNPAID' && (
            <Button
              disabled={request.isPending}
              onClick={() => request.mutate({ groupId, month: data.month })}
            >
              {t('iPaid', { month: label })}
            </Button>
          )}
          {myRow?.state === 'PENDING' && (
            <Button
              variant="outline"
              disabled={cancel.isPending}
              onClick={() => cancel.mutate({ groupId, month: data.month })}
            >
              {t('cancelRequest')}
            </Button>
          )}
        </div>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-lg bg-primary text-primary-foreground p-4 flex flex-col gap-1">
          <span className="text-sm">{t('balance')}</span>
          <strong className="text-xl tabular-nums [overflow-wrap:anywhere]" data-testid="fund-balance">
            {money(data.totals.balance)}
          </strong>
          <span className="text-xs opacity-80">{t('balanceHint')}</span>
        </div>
        <div className="rounded-lg border bg-card p-4 flex flex-col gap-1">
          <span className="text-sm text-muted-foreground">
            {t('monthCollected', { month: label })}
          </span>
          <strong
            className="text-lg tabular-nums [overflow-wrap:anywhere] text-emerald-700 dark:text-emerald-400"
            data-testid="fund-month-collected"
          >
            +{money(data.totals.monthCollected)}
          </strong>
          <span className="text-xs text-muted-foreground">
            {data.isRestMonth
              ? t('restMonthShort')
              : t('paidCount', { count: data.totals.monthPaidCount })}
          </span>
        </div>
        <div className="rounded-lg border bg-card p-4 flex flex-col gap-1">
          <span className="text-sm text-muted-foreground">
            {t('monthSpent', { month: label })}
          </span>
          <strong
            className="text-lg tabular-nums [overflow-wrap:anywhere] text-red-700 dark:text-red-400"
            data-testid="fund-month-spent"
          >
            −{money(data.totals.monthSpent)}
          </strong>
          <span className="text-xs text-muted-foreground">
            {t('spentCount', { count: data.totals.monthSpentCount })}
          </span>
        </div>
        <div className="rounded-lg border bg-card p-4 flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">
            {t('cumulative', { month: label })}
          </span>
          <div className="flex justify-between gap-2">
            <span>{t('collected')}</span>
            <strong className="tabular-nums">
              {money(data.totals.cumulativeCollected)}
            </strong>
          </div>
          <div className="flex justify-between gap-2">
            <span>{t('spent')}</span>
            <strong className="tabular-nums">
              {money(data.totals.cumulativeSpent)}
            </strong>
          </div>
          {data.settings.openingBalance !== 0 && (
            <span className="text-xs text-muted-foreground">
              {t('openingBalance', {
                amount: money(data.settings.openingBalance),
              })}
            </span>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-4 items-start">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base">{t('statusTitle')}</CardTitle>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  aria-label={t('previousMonth')}
                  disabled={index >= data.months.length - 1}
                  onClick={() => setMonth(data.months[index + 1])}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span
                  className="min-w-24 text-center text-sm font-semibold"
                  data-testid="fund-month"
                >
                  {label}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  aria-label={t('nextMonth')}
                  disabled={index <= 0}
                  onClick={() => setMonth(data.months[index - 1])}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <CardDescription>
              {data.isRestMonth
                ? t('restMonthLine')
                : t('feeLine', {
                    amount: money(data.settings.amount),
                    day: data.settings.dueDay,
                    paid: data.totals.monthPaidCount,
                    total: billed,
                  })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.isRestMonth ? (
              <div className="rounded-lg bg-muted p-4 text-center text-sm flex flex-col gap-1">
                <strong>{t('restMonthTitle')}</strong>
                <span className="text-muted-foreground">
                  {t('restMonthDescription')}
                </span>
              </div>
            ) : (
              <ul className="flex flex-col divide-y text-sm">
                {data.rows.map((row) => (
                  <MemberRow
                    key={row.participantId}
                    row={row}
                    isMe={row.participantId === me.participantId}
                    isAdmin={isAdmin}
                    groupId={groupId}
                    month={data.month}
                    money={money}
                    defaultAmount={data.settings.amount}
                    onDone={onSuccess}
                    onError={onError}
                  />
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs text-muted-foreground">
              {isAdmin ? t('adminHelp') : t('memberHelp')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base">
                {t('historyTitle', { month: label })}
              </CardTitle>
              <div
                role="group"
                aria-label={t('historyFilter')}
                className="flex gap-1 rounded-md bg-muted p-1"
              >
                {(['all', 'payment', 'expense'] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    aria-pressed={filter === f}
                    onClick={() => setFilter(f)}
                    className={cn(
                      'rounded px-3 py-1 text-xs',
                      filter === f
                        ? 'bg-background font-semibold shadow-sm'
                        : 'text-muted-foreground',
                    )}
                  >
                    {t(`filter.${f}`)}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {t('historyEmpty')}
              </p>
            ) : (
              <ul className="flex flex-col divide-y text-sm">
                {history.map((h) => (
                  <li
                    key={`${h.kind}-${h.id}`}
                    className="flex items-center justify-between gap-3 py-2"
                    data-testid="fund-history-item"
                  >
                    <div className="flex flex-col min-w-0">
                      <span className="truncate">
                        {h.kind === 'payment'
                          ? t('paymentTitle', { name: h.who, month: label })
                          : h.title}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(h.date).toLocaleDateString(locale, {
                          month: 'numeric',
                          day: 'numeric',
                          timeZone: h.kind === 'expense' ? 'UTC' : undefined,
                        })}
                        {h.kind === 'expense' &&
                          ` · ${t('recordedBy', { name: h.who })}`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={cn(
                          'rounded px-1.5 py-0.5 text-xs',
                          h.kind === 'payment'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
                            : 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200',
                        )}
                      >
                        {h.kind === 'payment'
                          ? t('filter.payment')
                          : t('filter.expense')}
                      </span>
                      <span
                        className={cn(
                          'font-medium tabular-nums',
                          h.kind === 'payment'
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-red-700 dark:text-red-400',
                        )}
                      >
                        {h.kind === 'payment' ? '+' : '−'}
                        {money(h.amount)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}

function MemberRow({
  row,
  isMe,
  isAdmin,
  groupId,
  month,
  money,
  defaultAmount,
  onDone,
  onError,
}: {
  row: {
    participantId: string
    name: string
    expected: number
    memberAmountReason: string | null
    state: State
    payment: { id: string; note: string | null } | null
  }
  isMe: boolean
  isAdmin: boolean
  groupId: string
  month: string
  money: (amount: number) => string
  defaultAmount: number
  onDone: () => Promise<void>
  onError: (e: { message: string }) => void
}) {
  const t = useTranslations('Fund')
  const [exempting, setExempting] = useState(false)
  const [reason, setReason] = useState('')
  const respond = trpc.groups.fund.respond.useMutation({
    onSuccess: onDone,
    onError,
  })
  const setByAdmin = trpc.groups.fund.setByAdmin.useMutation({
    onSuccess: async () => {
      setExempting(false)
      setReason('')
      await onDone()
    },
    onError,
  })
  const busy = respond.isPending || setByAdmin.isPending
  const admin = (action: 'PAID' | 'EXEMPT' | 'CLEAR_EXEMPT') =>
    setByAdmin.mutate({
      groupId,
      participantId: row.participantId,
      month,
      action,
      note: action === 'EXEMPT' ? reason : undefined,
    })

  return (
    <li className="py-2 flex flex-col gap-2" data-testid="fund-member">
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col min-w-0">
          <span className="font-medium">
            {row.name}
            {isMe && (
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                {t('me')}
              </span>
            )}
          </span>
          {(row.expected !== defaultAmount ||
            (row.state === 'EXEMPT' && row.payment?.note)) && (
            <span className="text-xs text-muted-foreground">
              {row.state === 'EXEMPT'
                ? row.payment?.note
                : `${money(row.expected)}${row.memberAmountReason ? ` (${row.memberAmountReason})` : ''}`}
            </span>
          )}
        </div>
        <span
          className={cn(
            'rounded-full px-2.5 py-0.5 text-xs font-semibold',
            stateStyle[row.state],
          )}
          data-testid="fund-member-state"
        >
          {t(`state.${row.state}`)}
        </span>
      </div>

      {isAdmin && row.state !== 'PAID' && (
        <div className="flex flex-wrap gap-2">
          {row.state === 'PENDING' && row.payment && (
            <>
              <Button
                size="sm"
                disabled={busy}
                onClick={() =>
                  respond.mutate({
                    groupId,
                    paymentId: row.payment!.id,
                    accept: true,
                  })
                }
              >
                {t('confirm')}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() =>
                  respond.mutate({
                    groupId,
                    paymentId: row.payment!.id,
                    accept: false,
                  })
                }
              >
                {t('reject')}
              </Button>
            </>
          )}
          {row.state === 'UNPAID' && !exempting && (
            <>
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => admin('PAID')}
              >
                {t('recordPaid')}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => setExempting(true)}
              >
                {t('exempt')}
              </Button>
            </>
          )}
          {row.state === 'EXEMPT' && (
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => admin('CLEAR_EXEMPT')}
            >
              {t('clearExempt')}
            </Button>
          )}
          {exempting && (
            <form
              className="flex w-full gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                admin('EXEMPT')
              }}
            >
              <Input
                className="h-8 text-sm"
                value={reason}
                autoFocus
                maxLength={200}
                onChange={(e) => setReason(e.target.value)}
                placeholder={t('exemptReason')}
                aria-label={t('exemptReasonLabel', { name: row.name })}
              />
              <Button size="sm" type="submit" disabled={busy}>
                {t('exemptSave')}
              </Button>
              <Button
                size="sm"
                type="button"
                variant="ghost"
                onClick={() => setExempting(false)}
              >
                {t('cancel')}
              </Button>
            </form>
          )}
        </div>
      )}
    </li>
  )
}
