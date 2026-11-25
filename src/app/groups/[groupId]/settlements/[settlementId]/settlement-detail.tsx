'use client'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/use-toast'
import {
  formatCurrency,
  formatDate,
  formatDateOnly,
  getCurrencyFromGroup,
} from '@/lib/utils'
import { trpc } from '@/trpc/client'
import { AlertTriangle, ArrowRight, Info, Loader2 } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import Link from 'next/link'
import { useState } from 'react'
import { useCurrentGroup } from '../../current-group-context'
import { SettlementStatusBadge } from '../settlement-status'

export function SettlementDetail({ settlementId }: { settlementId: string }) {
  const t = useTranslations('Settlements.Detail')
  const tErrors = useTranslations('Settlements.Errors')
  const locale = useLocale()
  const { toast } = useToast()
  const utils = trpc.useUtils()
  const { groupId, group } = useCurrentGroup()
  const { data: groupData } = trpc.groups.get.useQuery({ groupId })
  const { data, isError } = trpc.groups.settlements.get.useQuery(
    { groupId, settlementId },
    { retry: false },
  )
  const respond = trpc.groups.settlements.respond.useMutation()
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')

  if (isError)
    return (
      <Card>
        <CardContent className="pt-6">{t('notFound')}</CardContent>
      </Card>
    )
  if (!data || !group || !groupData)
    return <Loader2 className="w-5 h-5 m-4 animate-spin" aria-hidden />

  const { settlement, currentlyOwed } = data
  const me = groupData.me.participantId
  const currency = getCurrencyFromGroup(group)
  const money = (value: number) => formatCurrency(currency, value, locale)
  const nameOf = (id: string) =>
    group.participants.find((p) => p.id === id)?.name ?? ''
  const from = nameOf(settlement.fromParticipantId)
  const to = nameOf(settlement.toParticipantId)
  const isSender = me === settlement.fromParticipantId
  const isRecipient = me === settlement.toParticipantId
  const pending = settlement.status === 'PENDING'
  const recipientLinked = group.participants.find(
    (p) => p.id === settlement.toParticipantId,
  )?.isLinked

  const act = async (action: 'confirm' | 'reject' | 'cancel') => {
    try {
      await respond.mutateAsync({
        groupId,
        settlementId,
        action,
        reason: action === 'reject' ? reason : undefined,
      })
      setRejecting(false)
      await Promise.all([
        utils.groups.settlements.invalidate(),
        utils.groups.balances.invalidate(),
        utils.groups.activities.invalidate(),
        utils.groups.expenses.invalidate(),
        utils.groups.stats.invalidate(),
        utils.groups.list.invalidate(),
      ])
    } catch (error) {
      const code =
        error && typeof error === 'object' && 'message' in error
          ? String(error.message)
          : ''
      toast({
        description: tErrors.has(code) ? tErrors(code) : tErrors('generic'),
        variant: 'destructive',
      })
    }
  }

  return (
    <Card data-testid="settlement-detail">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle>{t('title')}</CardTitle>
          <SettlementStatusBadge status={settlement.status} />
        </div>
        <CardDescription>
          {t(`explain.${settlement.status}`, { from, to })}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center gap-3 text-lg flex-wrap">
          <strong>{from}</strong>
          <ArrowRight className="w-5 h-5 text-muted-foreground" />
          <strong>{to}</strong>
          <span className="font-bold tabular-nums">
            {money(settlement.amount)}
          </span>
        </div>

        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-muted-foreground">{t('paidAt')}</dt>
          <dd>
            {formatDateOnly(settlement.paidAt, locale, { dateStyle: 'medium' })}
          </dd>
          <dt className="text-muted-foreground">{t('requestedAt')}</dt>
          <dd>
            {formatDate(settlement.createdAt, locale, {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
          </dd>
          {settlement.respondedAt && (
            <>
              <dt className="text-muted-foreground">{t('respondedAt')}</dt>
              <dd>
                {formatDate(settlement.respondedAt, locale, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </dd>
            </>
          )}
          {settlement.note && (
            <>
              <dt className="text-muted-foreground">{t('note')}</dt>
              <dd className="whitespace-pre-wrap">{settlement.note}</dd>
            </>
          )}
          {settlement.rejectReason && (
            <>
              <dt className="text-muted-foreground">{t('rejectReason')}</dt>
              <dd className="whitespace-pre-wrap">{settlement.rejectReason}</dd>
            </>
          )}
        </dl>

        {settlement.documents.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {settlement.documents.map((doc) => (
              <a key={doc.id} href={doc.url} target="_blank" rel="noopener">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={doc.url}
                  alt={t('proof')}
                  className="h-24 w-24 object-cover rounded border"
                />
              </a>
            ))}
          </div>
        )}

        {pending && currentlyOwed !== settlement.amount && (
          <p className="flex gap-2 text-sm rounded-md border border-amber-300 p-3 bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-100">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>
              {t('amountChanged', { from, to, amount: money(currentlyOwed) })}
            </span>
          </p>
        )}

        {pending && isRecipient && (
          <p className="flex gap-2 text-sm rounded-md border p-3 bg-muted/50">
            <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>
              {t('checkYourAccount', {
                from,
                amount: money(settlement.amount),
              })}
            </span>
          </p>
        )}
        {pending && isSender && !recipientLinked && (
          <p className="text-sm text-muted-foreground">
            {t('recipientNotJoined', { to })}
          </p>
        )}

        {rejecting && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="reason">{t('reasonLabel')}</Label>
            <Textarea
              id="reason"
              className="text-base"
              rows={2}
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        )}
      </CardContent>
      <CardFooter className="flex flex-wrap gap-2">
        {pending && isRecipient && !rejecting && (
          <>
            <Button onClick={() => act('confirm')} disabled={respond.isPending}>
              {t('confirm', { amount: money(settlement.amount) })}
            </Button>
            <Button
              variant="outline"
              onClick={() => setRejecting(true)}
              disabled={respond.isPending}
            >
              {t('reject')}
            </Button>
          </>
        )}
        {pending && isRecipient && rejecting && (
          <>
            <Button
              variant="destructive"
              onClick={() => act('reject')}
              disabled={respond.isPending}
            >
              {t('rejectSubmit')}
            </Button>
            <Button variant="ghost" onClick={() => setRejecting(false)}>
              {t('back')}
            </Button>
          </>
        )}
        {pending && isSender && (
          <Button
            variant="outline"
            onClick={() => act('cancel')}
            disabled={respond.isPending}
          >
            {t('cancelRequest')}
          </Button>
        )}
        <Button variant="ghost" asChild>
          <Link href={`/groups/${groupId}/settlements`}>
            {t('toSettlements')}
          </Link>
        </Button>
      </CardFooter>
    </Card>
  )
}
