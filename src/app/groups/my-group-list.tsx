'use client'

import { AddGroupByUrlButton } from '@/app/groups/add-group-by-url-button'
import { MyGroupCard } from '@/app/groups/my-group-card'
import {
  clearLegacyDeviceData,
  getArchivedGroups,
  getStarredGroups,
} from '@/app/groups/recent-groups-helpers'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { trpc } from '@/trpc/client'
import { AppRouterOutput } from '@/trpc/routers/_app'
import { Loader2, Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { GlobalBalanceCard } from './global-balance-card'
import { ReceivedInvites } from './received-invites'

type MyGroups = AppRouterOutput['groups']['list']['groups']

/**
 * Home after logging in: the groups the user is a member of (from the server,
 * so they are the same on every device), with what they have to settle.
 * Favorites and archived groups remain per-device preferences.
 */
export function MyGroupList() {
  const t = useTranslations('MyGroups')
  const tGroups = useTranslations('Groups')
  const { data, isLoading, isError, refetch } = trpc.groups.list.useQuery()

  const [prefs, setPrefs] = useState<{
    starred: string[]
    archived: string[]
  } | null>(null)
  const loadPrefs = useCallback(() => {
    setPrefs({
      starred: getStarredGroups(),
      archived: getArchivedGroups(),
    })
  }, [])
  useEffect(() => {
    clearLegacyDeviceData()
    loadPrefs()
  }, [loadPrefs])

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <h1 className="font-bold text-2xl flex-1">{t('title')}</h1>
        <div className="flex gap-2">
          <AddGroupByUrlButton />
          <Button asChild>
            <Link href="/groups/create">
              <Plus className="w-4 h-4 mr-1" />
              {t('create')}
            </Link>
          </Button>
        </div>
      </div>

      <ReceivedInvites />

      {isError ? (
        <div className="text-sm space-y-2">
          <p>{t('loadError')}</p>
          <Button variant="secondary" onClick={() => refetch()}>
            {t('retry')}
          </Button>
        </div>
      ) : isLoading || !data || !prefs ? (
        <p className="text-sm">
          <Loader2 className="w-4 m-4 mr-2 inline animate-spin" />
          {tGroups('loadingRecent')}
        </p>
      ) : data.groups.length === 0 ? (
        <EmptyState />
      ) : (
        <Groups groups={data.groups} prefs={prefs} refresh={loadPrefs} />
      )}
    </>
  )
}

function Groups({
  groups,
  prefs,
  refresh,
}: {
  groups: MyGroups
  prefs: { starred: string[]; archived: string[] }
  refresh: () => void
}) {
  const tGroups = useTranslations('Groups')
  const starred = groups.filter((g) => prefs.starred.includes(g.id))
  const archived = groups.filter(
    (g) => !prefs.starred.includes(g.id) && prefs.archived.includes(g.id),
  )
  const others = groups.filter(
    (g) => !prefs.starred.includes(g.id) && !prefs.archived.includes(g.id),
  )

  const list = (items: MyGroups) => (
    <ul className="grid gap-2 sm:grid-cols-2">
      {items.map((group) => (
        <MyGroupCard
          key={group.id}
          group={group}
          isStarred={prefs.starred.includes(group.id)}
          isArchived={prefs.archived.includes(group.id)}
          refresh={refresh}
        />
      ))}
    </ul>
  )

  return (
    <div className="flex flex-col gap-6">
      <GlobalBalanceCard groups={groups} />
      {starred.length > 0 && (
        <section>
          <h2 className="mb-2">{tGroups('starred')}</h2>
          {list(starred)}
        </section>
      )}
      {others.length > 0 && <section>{list(others)}</section>}
      {archived.length > 0 && (
        <section className="opacity-60">
          <h2 className="mb-2">{tGroups('archived')}</h2>
          {list(archived)}
        </section>
      )}
    </div>
  )
}

function EmptyState() {
  const t = useTranslations('MyGroups')
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('empty.title')}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          {t('empty.description')}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href="/groups/create">
              <Plus className="w-4 h-4 mr-1" />
              {t('create')}
            </Link>
          </Button>
          <AddGroupByUrlButton />
        </div>
      </CardContent>
    </Card>
  )
}
