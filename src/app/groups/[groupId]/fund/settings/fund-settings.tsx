'use client'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { addMonths } from '@/lib/fund-rules'
import {
  amountAsDecimal,
  amountAsMinorUnits,
  cn,
  formatCurrency,
  getCurrencyFromGroup,
} from '@/lib/utils'
import { trpc } from '@/trpc/client'
import { useLocale, useTranslations } from 'next-intl'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useCurrentGroup } from '../../current-group-context'

type MemberAmount = { participantId: string; amount: string; reason: string }

/** 회비 설정 (admins): turn the fund on or off, fee, due day, exceptions. */
export function FundSettings() {
  const t = useTranslations('FundSettings')
  const locale = useLocale()
  const router = useRouter()
  const { groupId, group } = useCurrentGroup()
  const { data: groupData } = trpc.groups.get.useQuery({ groupId })
  const { data } = trpc.groups.fund.get.useQuery({ groupId })
  const utils = trpc.useUtils()
  const save = trpc.groups.fund.updateSettings.useMutation({
    onSuccess: async () => {
      await utils.groups.invalidate()
      router.push(`/groups/${groupId}/fund`)
    },
  })

  const [enabled, setEnabled] = useState(false)
  const [amount, setAmount] = useState('0')
  const [dueDay, setDueDay] = useState('10')
  const [startMonth, setStartMonth] = useState('')
  const [opening, setOpening] = useState('0')
  const [restMonths, setRestMonths] = useState<string[]>([])
  const [restYear, setRestYear] = useState(0)
  const [memberAmounts, setMemberAmounts] = useState<MemberAmount[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!data || !group || loaded) return
    const currency = getCurrencyFromGroup(group)
    const s = data.settings
    setEnabled(s.enabled)
    setAmount(String(amountAsDecimal(s.amount, currency)))
    setDueDay(String(s.dueDay))
    setStartMonth(s.startMonth ?? data.currentMonth)
    setOpening(String(amountAsDecimal(s.openingBalance, currency)))
    setRestMonths(s.restMonths)
    setRestYear(Number(data.currentMonth.slice(0, 4)))
    setMemberAmounts(
      s.memberAmounts.map((m) => ({
        participantId: m.participantId,
        amount: String(amountAsDecimal(m.amount, currency)),
        reason: m.reason ?? '',
      })),
    )
    setLoaded(true)
  }, [data, group, loaded])

  if (!group || !data || !groupData?.me || !loaded)
    return (
      <Card>
        <CardContent className="pt-6">
          <Skeleton className="h-60 w-full" />
        </CardContent>
      </Card>
    )

  if (groupData.me.role !== 'OWNER')
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
          <CardDescription>{t('adminOnly')}</CardDescription>
        </CardHeader>
      </Card>
    )

  const currency = getCurrencyFromGroup(group)
  const members = data.rows
  const toMinor = (value: string) =>
    amountAsMinorUnits(Number(value.replace(/,/g, '')) || 0, currency)
  const monthOptions = Array.from({ length: 25 }, (_, i) =>
    addMonths(data.currentMonth, i - 12),
  )
  const yearlyTotal =
    (12 - restMonths.filter((m) => m.startsWith(`${restYear}-`)).length) *
    toMinor(amount)

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        save.mutate({
          groupId,
          enabled,
          amount: toMinor(amount),
          dueDay: Math.min(28, Math.max(1, Number(dueDay) || 1)),
          startMonth,
          openingBalance: toMinor(opening),
          restMonths,
          memberAmounts: memberAmounts
            .filter((m) => m.participantId)
            .map((m) => ({
              participantId: m.participantId,
              amount: toMinor(m.amount),
              reason: m.reason,
            })),
        })
      }}
    >
      <Card>
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
          <CardDescription>{t('description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-3">
            <Checkbox
              id="fund-enabled"
              checked={enabled}
              onCheckedChange={(v) => setEnabled(v === true)}
            />
            <div className="flex flex-col gap-1">
              <Label htmlFor="fund-enabled" className="font-semibold">
                {t('enabled')}
              </Label>
              <span className="text-sm text-muted-foreground">
                {enabled ? t('enabledOn') : t('enabledOff')}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {enabled && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('feeTitle')}</CardTitle>
              <CardDescription>{t('feeDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="grid sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="fund-amount">
                  {t('amount', { currency: currency.symbol })}
                </Label>
                <Input
                  id="fund-amount"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="fund-due">{t('dueDay')}</Label>
                <Input
                  id="fund-due"
                  type="number"
                  min={1}
                  max={28}
                  value={dueDay}
                  onChange={(e) => setDueDay(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>{t('startMonth')}</Label>
                <Select value={startMonth} onValueChange={setStartMonth}>
                  <SelectTrigger aria-label={t('startMonth')}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {monthOptions.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="fund-opening">
                  {t('openingBalance', { currency: currency.symbol })}
                </Label>
                <Input
                  id="fund-opening"
                  inputMode="decimal"
                  value={opening}
                  onChange={(e) => setOpening(e.target.value)}
                />
                <span className="text-xs text-muted-foreground">
                  {t('openingBalanceHint')}
                </span>
              </div>
              <p className="sm:col-span-2 text-xs text-muted-foreground">
                {t('cycleNote')}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {t('memberAmountsTitle')}
              </CardTitle>
              <CardDescription>{t('memberAmountsDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {memberAmounts.map((m, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[1fr_7rem] sm:grid-cols-[10rem_8rem_1fr_auto] gap-2 items-center"
                  data-testid="fund-member-amount"
                >
                  <Select
                    value={m.participantId}
                    onValueChange={(participantId) =>
                      setMemberAmounts((list) =>
                        list.map((x, j) =>
                          j === i ? { ...x, participantId } : x,
                        ),
                      )
                    }
                  >
                    <SelectTrigger aria-label={t('memberName')}>
                      <SelectValue placeholder={t('memberName')} />
                    </SelectTrigger>
                    <SelectContent>
                      {members.map((p) => (
                        <SelectItem
                          key={p.participantId}
                          value={p.participantId}
                          disabled={memberAmounts.some(
                            (x, j) =>
                              j !== i && x.participantId === p.participantId,
                          )}
                        >
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    inputMode="decimal"
                    aria-label={t('memberAmount')}
                    value={m.amount}
                    onChange={(e) =>
                      setMemberAmounts((list) =>
                        list.map((x, j) =>
                          j === i ? { ...x, amount: e.target.value } : x,
                        ),
                      )
                    }
                  />
                  <Input
                    className="col-span-2 sm:col-span-1"
                    aria-label={t('memberReason')}
                    placeholder={t('memberReason')}
                    maxLength={100}
                    value={m.reason}
                    onChange={(e) =>
                      setMemberAmounts((list) =>
                        list.map((x, j) =>
                          j === i ? { ...x, reason: e.target.value } : x,
                        ),
                      )
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="col-span-2 sm:col-span-1 justify-self-start"
                    onClick={() =>
                      setMemberAmounts((list) => list.filter((_, j) => j !== i))
                    }
                  >
                    {t('remove')}
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="self-start"
                disabled={memberAmounts.length >= members.length}
                onClick={() =>
                  setMemberAmounts((list) => [
                    ...list,
                    { participantId: '', amount: amount, reason: '' },
                  ])
                }
              >
                {t('addMember')}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-base">{t('restTitle')}</CardTitle>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-label={t('previousYear')}
                    onClick={() => setRestYear((y) => y - 1)}
                  >
                    ‹
                  </Button>
                  <span className="min-w-16 text-center text-sm font-semibold">
                    {restYear}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-label={t('nextYear')}
                    onClick={() => setRestYear((y) => y + 1)}
                  >
                    ›
                  </Button>
                </div>
              </div>
              <CardDescription>{t('restDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                {Array.from({ length: 12 }, (_, i) => {
                  const month = `${restYear}-${String(i + 1).padStart(2, '0')}`
                  const on = restMonths.includes(month)
                  return (
                    <button
                      key={month}
                      type="button"
                      aria-pressed={on}
                      onClick={() =>
                        setRestMonths((list) =>
                          on
                            ? list.filter((m) => m !== month)
                            : [...list, month].sort(),
                        )
                      }
                      className={cn(
                        'h-10 rounded-md border text-sm',
                        on
                          ? 'border-primary bg-primary/10 font-semibold text-primary'
                          : 'bg-background',
                      )}
                    >
                      {new Date(Date.UTC(2000, i, 1)).toLocaleDateString(
                        locale,
                        { month: 'short', timeZone: 'UTC' },
                      )}
                    </button>
                  )
                })}
              </div>
              <p className="text-sm text-muted-foreground">
                {t('yearlyTotal', {
                  year: restYear,
                  amount: formatCurrency(currency, yearlyTotal, locale),
                })}
              </p>
            </CardContent>
          </Card>
          <p className="text-sm text-muted-foreground px-1">
            {t('exemptNote')}
          </p>
        </>
      )}

      {save.error && (
        <p role="alert" className="text-sm text-destructive">
          {t('saveError')}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" asChild>
          <Link href={`/groups/${groupId}/fund`}>{t('cancel')}</Link>
        </Button>
        <Button type="submit" disabled={save.isPending}>
          {t('save')}
        </Button>
      </div>
    </form>
  )
}
