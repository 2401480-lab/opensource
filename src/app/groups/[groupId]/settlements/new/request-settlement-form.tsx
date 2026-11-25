'use client'

import { ExpenseDocumentsInput } from '@/components/expense-documents-input'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/use-toast'
import { ExpenseFormValues } from '@/lib/schemas'
import {
  amountAsDecimal,
  amountAsMinorUnits,
  formatCurrency,
  getCurrencyFromGroup,
} from '@/lib/utils'
import { trpc } from '@/trpc/client'
import { Info, Loader2 } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useCurrentGroup } from '../../current-group-context'

function today() {
  const now = new Date()
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
    .toISOString()
    .slice(0, 10)
}

/**
 * "I sent the money": the sender (always the signed-in member) records a
 * transfer and asks the recipient to confirm it. A separate screen from adding
 * an expense: nothing here is about who shares a cost.
 */
export function RequestSettlementForm({
  defaultTo,
  defaultAmount,
  enableDocuments,
}: {
  defaultTo?: string
  defaultAmount?: number
  enableDocuments: boolean
}) {
  const t = useTranslations('Settlements.Request')
  const tErrors = useTranslations('Settlements.Errors')
  const locale = useLocale()
  const router = useRouter()
  const { toast } = useToast()
  const utils = trpc.useUtils()
  const { groupId, group } = useCurrentGroup()
  const { data: groupData } = trpc.groups.get.useQuery({ groupId })
  const { data: balances } = trpc.groups.balances.list.useQuery({ groupId })
  const { data: settlements } = trpc.groups.settlements.list.useQuery({
    groupId,
  })
  const { mutateAsync, isPending } =
    trpc.groups.settlements.request.useMutation()

  const me = groupData?.me
  const [to, setTo] = useState<string | undefined>(defaultTo)
  const [amount, setAmount] = useState<string | null>(null)
  const [paidAt, setPaidAt] = useState(today())
  const [note, setNote] = useState('')
  const [documents, setDocuments] = useState<ExpenseFormValues['documents']>([])

  if (!group || !me || !balances || !settlements)
    return <Loader2 className="w-5 h-5 m-4 animate-spin" aria-hidden />

  const currency = getCurrencyFromGroup(group)
  const money = (value: number) => formatCurrency(currency, value, locale)
  const nameOf = (id: string) =>
    group.participants.find((p) => p.id === id)?.name ?? ''
  const pendingTo = new Set(
    settlements.settlements
      .filter(
        (s) =>
          s.status === 'PENDING' && s.fromParticipantId === me.participantId,
      )
      .map((s) => s.toParticipantId),
  )
  const options = balances.reimbursements.filter(
    (r) => r.from === me.participantId && !pendingTo.has(r.to),
  )
  const selected = options.find((r) => r.to === to) ?? options[0]
  const owed = selected?.amount ?? 0
  const amountValue =
    amount ??
    String(
      amountAsDecimal(
        selected && selected.to === defaultTo && defaultAmount
          ? Math.min(defaultAmount, owed)
          : owed,
        currency,
      ),
    )
  const amountMinor = amountAsMinorUnits(Number(amountValue) || 0, currency)
  const amountError =
    amountMinor <= 0
      ? t('amountTooLow')
      : amountMinor > owed
        ? t('amountTooHigh', { amount: money(owed) })
        : null

  if (options.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm">
            {pendingTo.size > 0 ? t('allPending') : t('nothingToSend')}
          </p>
          <Button variant="secondary" asChild className="self-start">
            <Link href={`/groups/${groupId}/settlements`}>{t('back')}</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <form
        onSubmit={async (event) => {
          event.preventDefault()
          if (!selected || amountError) return
          try {
            const { settlementId } = await mutateAsync({
              groupId,
              toParticipantId: selected.to,
              amount: amountMinor,
              paidAt: new Date(paidAt),
              note: note || undefined,
              documents,
            })
            await utils.groups.settlements.invalidate()
            await utils.groups.activities.invalidate()
            router.push(`/groups/${groupId}/settlements/${settlementId}`)
          } catch (error) {
            const code =
              error && typeof error === 'object' && 'message' in error
                ? String(error.message)
                : ''
            toast({
              description: tErrors.has(code)
                ? tErrors(code)
                : tErrors('generic'),
              variant: 'destructive',
            })
          }
        }}
      >
        <CardContent className="flex flex-col gap-5">
          <div className="text-sm">
            <span className="text-muted-foreground">{t('from')}</span>{' '}
            <strong>{me.participantName}</strong> ({t('me')})
          </div>

          <div className="flex flex-col gap-2">
            <Label>{t('to')}</Label>
            <RadioGroup
              value={selected?.to}
              onValueChange={(value) => {
                setTo(value)
                setAmount(null)
              }}
            >
              {options.map((option) => (
                <div key={option.to} className="flex items-center gap-2">
                  <RadioGroupItem value={option.to} id={`to-${option.to}`} />
                  <Label htmlFor={`to-${option.to}`} className="font-normal">
                    <strong>{nameOf(option.to)}</strong>{' '}
                    <span className="text-muted-foreground">
                      {t('owed', { amount: money(option.amount) })}
                    </span>
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="amount">{t('amount')}</Label>
              <div className="flex items-baseline gap-2">
                <span>{group.currency}</span>
                <Input
                  id="amount"
                  className="text-base max-w-[160px]"
                  inputMode="decimal"
                  value={amountValue}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <p
                className={
                  amountError
                    ? 'text-xs text-destructive'
                    : 'text-xs text-muted-foreground'
                }
              >
                {amountError ?? t('amountHint')}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="paidAt">{t('paidAt')}</Label>
              <Input
                id="paidAt"
                type="date"
                value={paidAt}
                max={today()}
                onChange={(e) => setPaidAt(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="note">{t('note')}</Label>
            <Textarea
              id="note"
              className="text-base"
              rows={2}
              maxLength={500}
              placeholder={t('notePlaceholder')}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          {enableDocuments && (
            <div className="flex flex-col gap-2">
              <Label>{t('proof')}</Label>
              <ExpenseDocumentsInput
                documents={documents}
                updateDocuments={setDocuments}
              />
            </div>
          )}

          <p className="flex gap-2 text-sm rounded-md border p-3 bg-muted/50">
            <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>
              {t('disclaimer', { name: selected ? nameOf(selected.to) : '' })}
            </span>
          </p>
        </CardContent>
        <CardFooter className="flex gap-2">
          <Button type="submit" disabled={isPending || !!amountError}>
            {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {t('submit')}
          </Button>
          <Button variant="ghost" asChild>
            <Link href={`/groups/${groupId}/settlements`}>{t('cancel')}</Link>
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
