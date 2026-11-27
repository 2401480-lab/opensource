'use client'

import { Button } from '@/components/ui/button'
import { ActivityType, Participant } from '@/generated/prisma/browser'
import {
  cn,
  DateTimeStyle,
  formatCurrency,
  formatDate,
  getCurrencyFromGroup,
} from '@/lib/utils'
import { AppRouterOutput } from '@/trpc/routers/_app'
import { ChevronRight } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCurrentGroup } from '../current-group-context'

export type Activity =
  AppRouterOutput['groups']['activities']['list']['activities'][number]

type Props = {
  groupId: string
  activity: Activity
  participant?: Participant
  dateStyle: DateTimeStyle
}

/** For settlement activities: `{ amount, from, to }` stored in `data`. */
function parseSettlementData(data: string | null) {
  try {
    const parsed: unknown = JSON.parse(data ?? '')
    if (
      parsed &&
      typeof parsed === 'object' &&
      'amount' in parsed &&
      typeof parsed.amount === 'number'
    )
      return parsed as {
        amount: number
        from: string
        to: string
      }
  } catch {}
  return null
}

function parseRoleChangeData(data: string | null) {
  try {
    const parsed: unknown = JSON.parse(data ?? '')
    if (
      parsed &&
      typeof parsed === 'object' &&
      'target' in parsed &&
      typeof parsed.target === 'string'
    )
      return parsed as { target: string; role: 'OWNER' | 'MEMBER' }
  } catch {}
  return null
}

function useSummary(activity: Activity, participantName?: string) {
  const t = useTranslations('Activity')
  const locale = useLocale()
  const { group } = useCurrentGroup()
  const participant = participantName ?? t('someone')
  const expense = activity.data ?? ''
  const settlement = parseSettlementData(activity.data)
  const nameOf = (id?: string) =>
    group?.participants.find((p) => p.id === id)?.name ?? t('someone')

  const tr = (key: string) =>
    t.rich(key, {
      expense,
      participant,
      amount:
        settlement && group
          ? formatCurrency(
              getCurrencyFromGroup(group),
              settlement.amount,
              locale,
            )
          : '',
      from: nameOf(settlement?.from),
      to: nameOf(settlement?.to),
      em: (chunks) => <em>&ldquo;{chunks}&rdquo;</em>,
      strong: (chunks) => <strong>{chunks}</strong>,
    })

  if (activity.activityType == ActivityType.UPDATE_GROUP) {
    return <>{tr('settingsModified')}</>
  } else if (activity.activityType == ActivityType.CREATE_EXPENSE) {
    return <>{tr('expenseCreated')}</>
  } else if (activity.activityType == ActivityType.UPDATE_EXPENSE) {
    return <>{tr('expenseUpdated')}</>
  } else if (activity.activityType == ActivityType.DELETE_EXPENSE) {
    return <>{tr('expenseDeleted')}</>
  } else if (activity.activityType == ActivityType.SCHEDULE_GROUP_DELETION) {
    return <>{tr('groupDeletionScheduled')}</>
  } else if (activity.activityType == ActivityType.RESTORE_GROUP) {
    return <>{tr('groupRestored')}</>
  } else if (activity.activityType == ActivityType.JOIN_GROUP) {
    return <>{tr('groupJoined')}</>
  } else if (activity.activityType == ActivityType.CHANGE_ROLE) {
    const change = parseRoleChangeData(activity.data)
    return (
      <>
        {t.rich(
          change?.role === 'OWNER' ? 'roleChangedOwner' : 'roleChangedMember',
          {
            participant,
            target: nameOf(change?.target),
            strong: (chunks) => <strong>{chunks}</strong>,
          },
        )}
      </>
    )
  } else if (activity.activityType == ActivityType.REQUEST_SETTLEMENT) {
    return <>{tr('settlementRequested')}</>
  } else if (activity.activityType == ActivityType.CONFIRM_SETTLEMENT) {
    return <>{tr('settlementConfirmed')}</>
  } else if (activity.activityType == ActivityType.REJECT_SETTLEMENT) {
    return <>{tr('settlementRejected')}</>
  } else if (activity.activityType == ActivityType.CANCEL_SETTLEMENT) {
    return <>{tr('settlementCanceled')}</>
  }
}

export function ActivityItem({
  groupId,
  activity,
  participant,
  dateStyle,
}: Props) {
  const router = useRouter()
  const locale = useLocale()

  const href = activity.settlementId
    ? `/groups/${groupId}/settlements/${activity.settlementId}`
    : activity.expense !== undefined
      ? `/groups/${groupId}/expenses/${activity.expenseId}/edit`
      : null
  const expenseExists = href !== null
  const summary = useSummary(activity, participant?.name)

  return (
    <div
      className={cn(
        'flex justify-between sm:rounded-lg px-2 sm:pr-1 sm:pl-2 py-2 text-sm hover:bg-accent gap-1 items-stretch',
        expenseExists && 'cursor-pointer',
      )}
      onClick={() => {
        if (href) router.push(href)
      }}
    >
      <div className="flex flex-col justify-between items-start">
        {dateStyle !== undefined && (
          <div className="mt-1 text-xs/5 text-muted-foreground">
            {formatDate(activity.time, locale, { dateStyle })}
          </div>
        )}
        <div className="my-1 text-xs/5 text-muted-foreground">
          {formatDate(activity.time, locale, { timeStyle: 'short' })}
        </div>
      </div>
      <div className="flex-1">
        <div className="m-1">{summary}</div>
      </div>
      {expenseExists && (
        <Button
          size="icon"
          variant="link"
          className="self-center hidden sm:flex w-5 h-5"
          asChild
        >
          <Link href={href ?? '#'}>
            <ChevronRight className="w-4 h-4" />
          </Link>
        </Button>
      )}
    </div>
  )
}
