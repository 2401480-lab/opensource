'use client'

import {
  forgetGroups,
  getRecentGroups,
  RecentGroups,
} from '@/app/groups/recent-groups-helpers'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { MAX_GROUPS_PER_QUERY } from '@/lib/group-query-limits'
import { trpc } from '@/trpc/client'
import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useEffect, useState } from 'react'

/**
 * Lists the groups this browser remembers from before accounts existed, so the
 * user can link each of them to their account (by opening it and saying which
 * participant they are).
 */
export function ImportGroups() {
  const t = useTranslations('MyGroups.import')
  const [groups, setGroups] = useState<RecentGroups | null>(null)
  useEffect(() => setGroups(getRecentGroups()), [])

  const groupIds = (groups ?? [])
    .map((g) => g.id)
    .slice(0, MAX_GROUPS_PER_QUERY)
  const { data } = trpc.membership.accessList.useQuery(
    { groupIds },
    { enabled: groups !== null && groupIds.length > 0 },
  )

  const labels = {
    member: t('statusMember'),
    unclaimed: t('statusUnclaimed'),
    forbidden: t('statusForbidden'),
    'not-found': t('statusNotFound'),
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {groups === null ? null : groups.length === 0 ? (
          <p className="text-sm">{t('none')}</p>
        ) : (
          <ul className="flex flex-col divide-y">
            {groups.slice(0, MAX_GROUPS_PER_QUERY).map((group) => {
              const status = data?.statuses.find(
                (s) => s.groupId === group.id,
              )?.status
              return (
                <li
                  key={group.id}
                  className="py-2 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="truncate">{group.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {status ? (
                        labels[status]
                      ) : (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      )}
                    </div>
                  </div>
                  {(status === 'unclaimed' || status === 'member') && (
                    <Button size="sm" variant="secondary" asChild>
                      <Link href={`/groups/${group.id}`}>{t('open')}</Link>
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        {groups && groups.length > 0 && (
          <div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                forgetGroups(groups.map((g) => g.id))
                setGroups([])
              }}
            >
              {t('forget')}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
