'use client'

import { Participant } from '@/generated/prisma/browser'
import { Balances } from '@/lib/balances'
import { Currency } from '@/lib/currency'
import { cn, formatCurrency } from '@/lib/utils'
import { ChevronDown } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useState } from 'react'

type Breakdown = Record<
  string,
  { paid: number; share: number; sent: number; received: number }
>

type Props = {
  balances: Balances
  breakdown?: Breakdown
  participants: Pick<Participant, 'id' | 'name'>[]
  currency: Currency
  myParticipantId?: string
}

/**
 * Each member's net result in words ("Will receive 33,333", "Will send
 * 16,667", "Settled"), with how it is computed one tap away. The bar is only
 * a secondary visual: the meaning never relies on its color or side.
 */
export function BalancesList({
  balances,
  breakdown,
  participants,
  currency,
  myParticipantId,
}: Props) {
  const locale = useLocale()
  const t = useTranslations('Settlements.Results')
  const [openId, setOpenId] = useState<string | null>(null)
  const money = (amount: number) => formatCurrency(currency, amount, locale)
  const maxBalance = Math.max(
    1,
    ...Object.values(balances).map((b) => Math.abs(b.total)),
  )

  // The signed-in member first.
  const ordered = [...participants].sort(
    (a, b) =>
      Number(b.id === myParticipantId) - Number(a.id === myParticipantId),
  )

  return (
    <ul className="flex flex-col divide-y text-sm">
      {ordered.map((participant) => {
        const balance = balances[participant.id]?.total ?? 0
        const isMe = participant.id === myParticipantId
        const detail = breakdown?.[participant.id]
        const label =
          balance > 0
            ? t('willReceive', { amount: money(balance) })
            : balance < 0
              ? t('willSend', { amount: money(-balance) })
              : t('settled')
        const isOpen = openId === participant.id
        return (
          <li
            key={participant.id}
            data-testid="balance-row"
            data-participant={participant.name}
            className={cn('py-3', isMe && 'bg-accent/50 -mx-3 px-3 rounded-md')}
          >
            <button
              type="button"
              className="w-full flex items-center justify-between gap-3 text-left"
              onClick={() => setOpenId(isOpen ? null : participant.id)}
              aria-expanded={isOpen}
              disabled={!detail}
            >
              <span className="font-medium">
                {participant.name}
                {isMe && (
                  <span className="ml-1 text-xs text-muted-foreground">
                    ({t('me')})
                  </span>
                )}
              </span>
              <span className="flex items-center gap-2">
                <span
                  data-testid="balance-label"
                  className={cn(
                    'font-semibold tabular-nums',
                    balance > 0 && 'text-green-700 dark:text-green-400',
                    balance < 0 && 'text-red-700 dark:text-red-400',
                  )}
                >
                  {label}
                </span>
                {detail && (
                  <ChevronDown
                    className={cn(
                      'w-4 h-4 text-muted-foreground transition-transform',
                      isOpen && 'rotate-180',
                    )}
                  />
                )}
              </span>
            </button>
            {balance !== 0 && (
              <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full',
                    balance > 0 ? 'bg-green-500' : 'bg-red-500',
                  )}
                  style={{
                    width: `${(Math.abs(balance) / maxBalance) * 100}%`,
                  }}
                />
              </div>
            )}
            {isOpen && detail && (
              <dl className="mt-3 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-muted-foreground">
                <dt>{t('paid')}</dt>
                <dd className="tabular-nums text-right">
                  {money(detail.paid)}
                </dd>
                <dt>{t('share')}</dt>
                <dd className="tabular-nums text-right">
                  − {money(detail.share)}
                </dd>
                {detail.sent > 0 && (
                  <>
                    <dt>{t('sent')}</dt>
                    <dd className="tabular-nums text-right">
                      + {money(detail.sent)}
                    </dd>
                  </>
                )}
                {detail.received > 0 && (
                  <>
                    <dt>{t('received')}</dt>
                    <dd className="tabular-nums text-right">
                      − {money(detail.received)}
                    </dd>
                  </>
                )}
                <dt className="font-medium text-foreground">{t('result')}</dt>
                <dd className="tabular-nums text-right font-medium text-foreground">
                  {label}
                </dd>
              </dl>
            )}
          </li>
        )
      })}
    </ul>
  )
}
