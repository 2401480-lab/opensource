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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { LedgerItem, LedgerPerson } from '@/lib/my-ledger'
import { formatCurrency, getCurrencyFromGroup } from '@/lib/utils'
import { trpc } from '@/trpc/client'
import { useLocale, useTranslations } from 'next-intl'
import Link from 'next/link'
import { useCurrentGroup } from '../current-group-context'

type Direction = 'send' | 'receive'

/**
 * "내 정산 상세": per person, which expenses and transfers make up what the
 * signed-in member has to send or receive.
 */
export function MyBalance() {
  const t = useTranslations('MyBalance')
  const locale = useLocale()
  const { groupId, group } = useCurrentGroup()
  const { data } = trpc.groups.balances.mine.useQuery({ groupId })
  const { data: settlementsData } = trpc.groups.settlements.list.useQuery({
    groupId,
  })

  if (!group || !data || !settlementsData)
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-40 w-full" />
        </CardContent>
      </Card>
    )

  const currency = getCurrencyFromGroup(group)
  const money = (amount: number) => formatCurrency(currency, amount, locale)
  const nameOf = (id: string) =>
    group.participants.find((p) => p.id === id)?.name ?? t('someone')
  const me = data.participantId
  const { ledger, toSend, toReceive } = data
  const totalToSend = toSend.reduce((sum, r) => sum + r.amount, 0)
  const totalToReceive = toReceive.reduce((sum, r) => sum + r.amount, 0)
  const pending = settlementsData.settlements.filter(
    (s) => s.status === 'PENDING',
  )

  const sendPeople = ledger.people.filter((p) => p.net < 0)
  const receivePeople = ledger.people.filter((p) => p.net > 0)
  const settledPeople = ledger.people.filter((p) => p.net === 0)

  // The suggested transfers can route money through other people to need
  // fewer transfers; say so when they differ from the per-person amounts.
  const sameAs = (
    people: LedgerPerson[],
    transfers: { amount: number; other: string }[],
  ) =>
    people.length === transfers.length &&
    people.every((p) =>
      transfers.some(
        (r) => r.other === p.participantId && r.amount === Math.abs(p.net),
      ),
    )
  const sendTransfers = toSend.map((r) => ({ amount: r.amount, other: r.to }))
  const receiveTransfers = toReceive.map((r) => ({
    amount: r.amount,
    other: r.from,
  }))

  const tabs: {
    id: Direction
    total: number
    people: LedgerPerson[]
    transfers: { amount: number; other: string }[]
  }[] = [
    {
      id: 'send',
      total: totalToSend,
      people: sendPeople,
      transfers: sendTransfers,
    },
    {
      id: 'receive',
      total: totalToReceive,
      people: receivePeople,
      transfers: receiveTransfers,
    },
  ]

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
          <CardDescription>{t('description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <dl
            className="rounded-lg bg-muted/50 p-3 text-sm grid grid-cols-[1fr_auto] gap-x-4 gap-y-1"
            data-testid="my-balance-formula"
          >
            <dt>{t('paid')}</dt>
            <dd className="text-right tabular-nums">{money(ledger.paid)}</dd>
            <dt>{t('share')}</dt>
            <dd className="text-right tabular-nums">−{money(ledger.share)}</dd>
            {ledger.sent !== 0 && (
              <>
                <dt>{t('sent')}</dt>
                <dd className="text-right tabular-nums">
                  +{money(ledger.sent)}
                </dd>
              </>
            )}
            {ledger.received !== 0 && (
              <>
                <dt>{t('received')}</dt>
                <dd className="text-right tabular-nums">
                  −{money(ledger.received)}
                </dd>
              </>
            )}
            <dt className="font-semibold border-t pt-1">
              {ledger.net >= 0 ? t('netReceive') : t('netSend')}
            </dt>
            <dd className="text-right font-semibold tabular-nums border-t pt-1">
              {money(Math.abs(ledger.net))}
            </dd>
          </dl>
        </CardContent>
      </Card>

      <Tabs
        defaultValue={
          totalToSend > 0 || totalToReceive === 0 ? 'send' : 'receive'
        }
      >
        <TabsList className="grid grid-cols-2 h-auto">
          {tabs.map((tab) => (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              className="flex flex-col gap-0.5 py-2"
            >
              <span>{tab.id === 'send' ? t('toSend') : t('toReceive')}</span>
              <span
                className="font-bold tabular-nums"
                data-testid={`my-balance-${tab.id}-total`}
              >
                {money(tab.total)}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>

        {tabs.map((tab) => (
          <TabsContent
            key={tab.id}
            value={tab.id}
            className="flex flex-col gap-3"
          >
            {!sameAs(tab.people, tab.transfers) && (
              <div
                className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950 p-3 text-sm flex flex-col gap-1"
                data-testid="my-balance-simplified"
              >
                <p className="font-medium">{t('simplifiedTitle')}</p>
                {tab.transfers.length === 0 && (
                  <p>
                    {tab.id === 'send'
                      ? t('simplifiedNoneToSend')
                      : t('simplifiedNoneToReceive')}
                  </p>
                )}
                <ul>
                  {tab.transfers.map((r) => (
                    <li key={r.other}>
                      {tab.id === 'send'
                        ? t('sendTo', {
                            name: nameOf(r.other),
                            amount: money(r.amount),
                          })
                        : t('receiveFrom', {
                            name: nameOf(r.other),
                            amount: money(r.amount),
                          })}
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-muted-foreground">
                  {t('simplifiedDescription')}
                </p>
              </div>
            )}
            {tab.people.length === 0 ? (
              <p className="text-sm text-muted-foreground px-1 py-4">
                {tab.id === 'send' ? t('noneToSend') : t('noneToReceive')}
              </p>
            ) : (
              tab.people.map((person) => (
                <PersonCard
                  key={person.participantId}
                  person={person}
                  direction={tab.id}
                  me={me}
                  groupId={groupId}
                  nameOf={nameOf}
                  money={money}
                  suggested={
                    tab.transfers.find((r) => r.other === person.participantId)
                      ?.amount
                  }
                  pendingId={
                    pending.find((s) =>
                      tab.id === 'send'
                        ? s.fromParticipantId === me &&
                          s.toParticipantId === person.participantId
                        : s.toParticipantId === me &&
                          s.fromParticipantId === person.participantId,
                    )?.id
                  }
                />
              ))
            )}
          </TabsContent>
        ))}
      </Tabs>

      {settledPeople.length > 0 && (
        <details className="rounded-lg border bg-card p-4 text-sm">
          <summary className="cursor-pointer font-medium">
            {t('settledPeople', { count: settledPeople.length })}
          </summary>
          <div className="mt-3 flex flex-col gap-3">
            {settledPeople.map((person) => (
              <div key={person.participantId}>
                <p className="font-medium">{nameOf(person.participantId)}</p>
                <ItemList
                  items={[...person.expenses, ...person.transfers]}
                  other={nameOf(person.participantId)}
                  direction="receive"
                  me={me}
                  nameOf={nameOf}
                  money={money}
                />
              </div>
            ))}
          </div>
        </details>
      )}
    </>
  )
}

function PersonCard({
  person,
  direction,
  me,
  groupId,
  nameOf,
  money,
  suggested,
  pendingId,
}: {
  person: LedgerPerson
  direction: Direction
  me: string
  groupId: string
  nameOf: (id: string) => string
  money: (amount: number) => string
  /** Amount of the suggested transfer with this person, if any. */
  suggested?: number
  /** A transfer request with this person waiting for confirmation. */
  pendingId?: string
}) {
  const t = useTranslations('MyBalance')
  const name = nameOf(person.participantId)
  const amount = money(Math.abs(person.net))

  return (
    <Card data-testid="my-balance-person">
      <CardHeader className="flex flex-row items-baseline justify-between gap-2 space-y-0 pb-3">
        <CardTitle className="text-base">
          {direction === 'send'
            ? t('personTo', { name })
            : t('personFrom', { name })}
        </CardTitle>
        <span
          className={
            direction === 'send'
              ? 'font-bold tabular-nums text-destructive'
              : 'font-bold tabular-nums text-primary'
          }
        >
          {amount}
        </span>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <ItemList
          items={person.expenses}
          other={name}
          direction={direction}
          me={me}
          nameOf={nameOf}
          money={money}
        />
        {person.transfers.length > 0 && (
          <div className="flex flex-col gap-1">
            <p className="text-xs font-medium text-muted-foreground">
              {t('alreadyExchanged')}
            </p>
            <ItemList
              items={person.transfers}
              other={name}
              direction={direction}
              me={me}
              nameOf={nameOf}
              money={money}
            />
          </div>
        )}

        {pendingId ? (
          <Button asChild size="sm" className="self-start">
            <Link href={`/groups/${groupId}/settlements/${pendingId}`}>
              {direction === 'send' ? t('viewRequest') : t('confirmReceipt')}
            </Link>
          </Button>
        ) : direction === 'send' && suggested !== undefined ? (
          <Button asChild size="sm" className="self-start">
            <Link
              href={`/groups/${groupId}/settlements/new?to=${person.participantId}&amount=${suggested}`}
            >
              {t('recordTransfer', { name, amount: money(suggested) })}
            </Link>
          </Button>
        ) : direction === 'receive' ? (
          <p className="text-xs text-muted-foreground">
            {t('waitingForSender', { name })}
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}

/**
 * Expenses or transfers with one person. Amounts are signed from the point of
 * view of the tab: on "to send", + adds to what I send; on "to receive", +
 * adds to what I receive.
 */
function ItemList({
  items,
  other,
  direction,
  me,
  nameOf,
  money,
}: {
  items: LedgerItem[]
  /** Name of the other person. */
  other: string
  direction: Direction
  me: string
  nameOf: (id: string) => string
  money: (amount: number) => string
}) {
  const t = useTranslations('MyBalance')
  const locale = useLocale()
  const day = (date: Date) =>
    new Date(date).toLocaleDateString(locale, {
      month: 'numeric',
      day: 'numeric',
      timeZone: 'UTC',
    })

  return (
    <ul className="flex flex-col divide-y text-sm border-t">
      {items.map((item) => {
        const value = direction === 'send' ? -item.effect : item.effect
        const isTransfer = item.myShare === 0 && item.theirShare === 0
        const payer = item.paidById === me ? t('me') : nameOf(item.paidById)
        return (
          <li
            key={item.expenseId}
            className="flex justify-between gap-3 py-2"
            data-testid="my-balance-item"
          >
            <div className="flex flex-col min-w-0">
              <span className="truncate">
                {isTransfer
                  ? t('transfer')
                  : item.paidById === me
                    ? t('theirShareOf', { title: item.title, name: other })
                    : t('myShareOf', { title: item.title })}
              </span>
              <span className="text-xs text-muted-foreground">
                {isTransfer
                  ? t('transferMeta', {
                      date: day(item.date),
                      payer,
                      amount: money(item.amount),
                    })
                  : t('expenseMeta', {
                      date: day(item.date),
                      payer,
                      amount: money(item.amount),
                      count: item.splitCount,
                    })}
              </span>
            </div>
            <span className="font-medium tabular-nums whitespace-nowrap">
              {value > 0 ? '+' : '−'}
              {money(Math.abs(value))}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
