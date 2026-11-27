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
import { formatCurrency, getCurrencyFromGroup } from '@/lib/utils'
import { trpc } from '@/trpc/client'
import { useLocale, useTranslations } from 'next-intl'
import Link from 'next/link'
import { useCurrentGroup } from './current-group-context'

/**
 * "Minsu's settlement": what the signed-in member has to send or receive,
 * to whom, in plain sentences. Shown first on the group home and on the
 * settlements page.
 */
export function MySettlementCard({
  showSettlementsLink = false,
}: {
  showSettlementsLink?: boolean
}) {
  const t = useTranslations('Settlements.Mine')
  const locale = useLocale()
  const { groupId, group } = useCurrentGroup()
  const { data: groupData } = trpc.groups.get.useQuery({ groupId })
  const { data } = trpc.groups.balances.list.useQuery({ groupId })
  const { data: settlementsData } = trpc.groups.settlements.list.useQuery({
    groupId,
  })
  const me = groupData?.me

  if (!group || !me || !data || !settlementsData) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    )
  }

  const currency = getCurrencyFromGroup(group)
  const money = (amount: number) => formatCurrency(currency, amount, locale)
  const nameOf = (id: string) =>
    group.participants.find((p) => p.id === id)?.name ?? ''
  const toSend = data.reimbursements.filter((r) => r.from === me.participantId)
  const toReceive = data.reimbursements.filter((r) => r.to === me.participantId)
  const totalToSend = toSend.reduce((sum, r) => sum + r.amount, 0)
  const totalToReceive = toReceive.reduce((sum, r) => sum + r.amount, 0)
  const settled = toSend.length === 0 && toReceive.length === 0
  const pending = settlementsData.settlements.filter(
    (s) => s.status === 'PENDING',
  )
  // Requests other members sent me, which only I can confirm.
  const toConfirm = pending.filter(
    (s) => s.toParticipantId === me.participantId,
  )
  const myPending = pending.filter(
    (s) => s.fromParticipantId === me.participantId,
  )
  const pendingWith = (other: string, iSend: boolean) =>
    pending.find((s) =>
      iSend
        ? s.fromParticipantId === me.participantId &&
          s.toParticipantId === other
        : s.toParticipantId === me.participantId &&
          s.fromParticipantId === other,
    )
  const status = settled
    ? 'statusSettled'
    : toConfirm.length > 0 || myPending.length > 0
      ? 'statusWaiting'
      : 'statusPending'

  return (
    <Card data-testid="my-settlement">
      <CardHeader>
        <CardTitle>{t('title', { name: me.participantName })}</CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <dl className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border p-3">
            <dt className="text-sm text-muted-foreground">{t('toSend')}</dt>
            <dd
              className="text-xl font-bold tabular-nums"
              data-testid="my-to-send"
            >
              {money(totalToSend)}
            </dd>
          </div>
          <div className="rounded-lg border p-3">
            <dt className="text-sm text-muted-foreground">{t('toReceive')}</dt>
            <dd
              className="text-xl font-bold tabular-nums"
              data-testid="my-to-receive"
            >
              {money(totalToReceive)}
            </dd>
          </div>
        </dl>

        {settled ? (
          <p className="text-sm font-medium">{t('settled')}</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {toSend.map((r) => (
              <li key={`send-${r.to}`} className="font-medium">
                {t('sendTo', { name: nameOf(r.to), amount: money(r.amount) })}
                {pendingWith(r.to, true) && (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    {t('sentWaiting')}
                  </span>
                )}
              </li>
            ))}
            {toReceive.map((r) => (
              <li key={`receive-${r.from}`} className="font-medium">
                {t('receiveFrom', {
                  name: nameOf(r.from),
                  amount: money(r.amount),
                })}
                {pendingWith(r.from, false) && (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    {t('toConfirmInline')}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}

        <p className="text-sm">
          <span className="text-muted-foreground">{t('status')}</span>{' '}
          <span className="font-semibold" data-testid="my-status">
            {t(status)}
          </span>
        </p>

        {toConfirm.length > 0 && (
          <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950 p-3 flex flex-col gap-2">
            <p className="text-sm font-medium">
              {t('toConfirm', { count: toConfirm.length })}
            </p>
            {toConfirm.map((s) => (
              <Button key={s.id} size="sm" asChild className="self-start">
                <Link href={`/groups/${groupId}/settlements/${s.id}`}>
                  {t('confirmFrom', {
                    name: nameOf(s.fromParticipantId),
                    amount: money(s.amount),
                  })}
                </Link>
              </Button>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {showSettlementsLink && !settled && (
            <Button asChild>
              <Link href={`/groups/${groupId}/settlements`}>
                {t('goSettle')}
              </Link>
            </Button>
          )}
          <Button asChild variant="outline">
            <Link href={`/groups/${groupId}/my-balance`}>
              {t('detailLink')}
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
