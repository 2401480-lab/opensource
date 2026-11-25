'use client'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Currency } from '@/lib/currency'
import { cn, formatCurrency, getCurrencyFromGroup } from '@/lib/utils'
import { AppRouterOutput } from '@/trpc/routers/_app'
import { useLocale, useTranslations } from 'next-intl'

type CurrencyBalance = {
  currency: Currency
  amount: number
}

type MyGroups = AppRouterOutput['groups']['list']['groups']

/** The signed-in user's net balance over all their groups, per currency. */
export function GlobalBalanceCard({ groups }: { groups: MyGroups }) {
  const locale = useLocale()
  const t = useTranslations('Groups.GlobalBalance')

  // Not useful with a single group: its own card already shows it.
  if (groups.length < 2) return null

  // Amounts from different currencies cannot be summed, so we aggregate them
  // into one bucket per currency.
  const byCurrency = new Map<string, CurrencyBalance>()
  for (const balance of groups) {
    const currency = getCurrencyFromGroup(balance)
    const key = currency.code || `custom:${currency.symbol}`
    const existing = byCurrency.get(key)
    if (existing) {
      existing.amount += balance.balance
    } else {
      byCurrency.set(key, { currency, amount: balance.balance })
    }
  }

  const currencyBalances = [...byCurrency.values()]
  const isSettledUp = currencyBalances.every(({ amount }) => amount === 0)

  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent>
        {isSettledUp ? (
          <p className="text-muted-foreground text-sm">{t('settledUp')}</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {currencyBalances.map(({ currency, amount }) => {
              if (amount === 0) return null
              const formatted = formatCurrency(
                currency,
                Math.abs(amount),
                locale,
              )
              return (
                <li
                  key={currency.code || currency.symbol}
                  className="flex justify-between items-baseline gap-2 text-sm"
                >
                  <span className="text-muted-foreground">
                    {amount > 0 ? t('owedToYou') : t('youOwe')}
                  </span>
                  <span
                    className={cn(
                      'font-semibold tabular-nums',
                      amount > 0 ? 'text-green-600' : 'text-red-600',
                    )}
                  >
                    {formatted}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
