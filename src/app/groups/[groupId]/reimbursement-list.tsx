import { Button } from '@/components/ui/button'
import { Participant } from '@/generated/prisma/browser'
import { Reimbursement } from '@/lib/balances'
import { Currency } from '@/lib/currency'
import { cn, formatCurrency } from '@/lib/utils'
import { ArrowRight } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import Link from 'next/link'
import { SettlementStatusBadge } from './settlements/settlement-status'

type PendingSettlement = {
  id: string
  fromParticipantId: string
  toParticipantId: string
}

type Props = {
  reimbursements: Reimbursement[]
  /** Settlement requests waiting for the recipient's confirmation. */
  pendingSettlements?: PendingSettlement[]
  participants: Pick<Participant, 'id' | 'name'>[]
  currency: Currency
  groupId: string
  myParticipantId?: string
}

/**
 * The fewest transfers that settle the group: "Minsu → Danbi 16,667".
 * Only the member who has to send a transfer is offered to record it.
 */
export function ReimbursementList({
  reimbursements,
  participants,
  currency,
  groupId,
  myParticipantId,
  pendingSettlements = [],
}: Props) {
  const locale = useLocale()
  const t = useTranslations('Settlements.Suggested')
  if (reimbursements.length === 0) {
    return <p className="text-sm">{t('none')}</p>
  }

  const nameOf = (id: string) =>
    participants.find((p) => p.id === id)?.name ?? ''
  const ordered = [...reimbursements].sort(
    (a, b) =>
      Number(b.from === myParticipantId || b.to === myParticipantId) -
      Number(a.from === myParticipantId || a.to === myParticipantId),
  )

  return (
    <ul className="flex flex-col divide-y text-sm">
      {ordered.map((reimbursement) => {
        const iSend = reimbursement.from === myParticipantId
        const iReceive = reimbursement.to === myParticipantId
        const pending = pendingSettlements.find(
          (s) =>
            s.fromParticipantId === reimbursement.from &&
            s.toParticipantId === reimbursement.to,
        )
        const detailHref = pending
          ? `/groups/${groupId}/settlements/${pending.id}`
          : undefined
        return (
          <li
            className={cn(
              'py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between',
              (iSend || iReceive) && 'bg-accent/50 -mx-3 px-3 rounded-md',
            )}
            key={`${reimbursement.from}-${reimbursement.to}`}
            data-testid="reimbursement-row"
            data-from={nameOf(reimbursement.from)}
            data-to={nameOf(reimbursement.to)}
          >
            <div className="flex items-center gap-2 flex-wrap">
              <strong>{nameOf(reimbursement.from)}</strong>
              <ArrowRight
                className="w-4 h-4 text-muted-foreground"
                aria-label={t('to')}
              />
              <strong>{nameOf(reimbursement.to)}</strong>
              <span className="font-semibold tabular-nums">
                {formatCurrency(currency, reimbursement.amount, locale)}
              </span>
              <SettlementStatusBadge
                status={pending ? 'PENDING' : 'UNSETTLED'}
              />
            </div>
            {iSend && !pending ? (
              <Button size="sm" asChild>
                <Link
                  href={`/groups/${groupId}/settlements/new?to=${reimbursement.to}&amount=${reimbursement.amount}`}
                >
                  {t('recordTransfer')}
                </Link>
              </Button>
            ) : iSend && detailHref ? (
              <Button size="sm" variant="outline" asChild>
                <Link href={detailHref}>{t('viewRequest')}</Link>
              </Button>
            ) : iReceive && detailHref ? (
              <Button size="sm" asChild>
                <Link href={detailHref}>{t('confirmReceipt')}</Link>
              </Button>
            ) : iReceive ? (
              <span className="text-xs text-muted-foreground">
                {t('waitingForSender', { name: nameOf(reimbursement.from) })}
              </span>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}
