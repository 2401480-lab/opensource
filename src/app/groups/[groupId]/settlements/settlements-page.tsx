'use client'

import { BalancesList } from '@/app/groups/[groupId]/balances-list'
import { ReimbursementList } from '@/app/groups/[groupId]/reimbursement-list'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { TrackPage } from '@/lib/analytics/track-page'
import { getCurrencyFromGroup } from '@/lib/utils'
import { trpc } from '@/trpc/client'
import { useTranslations } from 'next-intl'
import { useEffect } from 'react'
import { useCurrentGroup } from '../current-group-context'
import { MySettlementCard } from '../my-settlement-card'
import { TransferHistory } from './transfer-history'

/**
 * Settlements: answers "who sends how much to whom, in the end?". Three
 * distinct parts, each with a one-line explanation: the suggested transfers,
 * each member's net result, and the transfers already recorded.
 */
export function SettlementsPage() {
  const utils = trpc.useUtils()
  const { groupId, group } = useCurrentGroup()
  const { data: groupData } = trpc.groups.get.useQuery({ groupId })
  const { data, isLoading } = trpc.groups.balances.list.useQuery({ groupId })
  const { data: settlements } = trpc.groups.settlements.list.useQuery({
    groupId,
  })
  const t = useTranslations('Settlements')

  useEffect(() => {
    // Until we use tRPC more widely and can invalidate the cache on expense
    // update, it's easier and safer to invalidate the cache on page load.
    utils.groups.balances.invalidate()
    utils.groups.settlements.invalidate()
  }, [utils])

  const loading = isLoading || !data || !group
  const myParticipantId = groupData?.me.participantId

  return (
    <>
      <TrackPage path={`/groups/${groupId}/settlements`} />
      <MySettlementCard />

      <Card>
        <CardHeader>
          <CardTitle>{t('Suggested.title')}</CardTitle>
          <CardDescription>{t('Suggested.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-16 w-full" />
          ) : (
            <ReimbursementList
              reimbursements={data.reimbursements}
              participants={group.participants}
              currency={getCurrencyFromGroup(group)}
              groupId={groupId}
              myParticipantId={myParticipantId}
              pendingSettlements={settlements?.settlements.filter(
                (s) => s.status === 'PENDING',
              )}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('Results.title')}</CardTitle>
          <CardDescription>{t('Results.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <BalancesList
              balances={data.balances}
              breakdown={data.breakdown}
              participants={group.participants}
              currency={getCurrencyFromGroup(group)}
              myParticipantId={myParticipantId}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('History.title')}</CardTitle>
          <CardDescription>{t('History.description')}</CardDescription>
        </CardHeader>
        <CardContent className="p-0 pb-4">
          <TransferHistory />
        </CardContent>
      </Card>
    </>
  )
}
