'use client'

import { GroupTabs } from '@/app/groups/[groupId]/group-tabs'
import { ShareButton } from '@/app/groups/[groupId]/share-button'
import { Skeleton } from '@/components/ui/skeleton'
import { ChevronRight } from 'lucide-react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useCurrentGroup } from './current-group-context'
import { useGroupNav } from './group-nav'

export const GroupHeader = () => {
  const t = useTranslations('GroupNav')
  const { isLoading, groupId, group } = useCurrentGroup()
  const { activeItem, active } = useGroupNav(groupId)

  return (
    <div className="flex flex-col justify-between gap-3">
      {/* Where you are, on wide screens: My groups › Group › Page */}
      <nav
        aria-label={t('breadcrumb')}
        className="hidden lg:flex items-center gap-1.5 text-sm text-muted-foreground"
      >
        <Link href="/groups" className="hover:text-foreground">
          {t('myGroups')}
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link href={`/groups/${groupId}`} className="hover:text-foreground">
          {group?.name ?? '…'}
        </Link>
        {activeItem && active !== 'overview' && (
          <>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="font-medium text-foreground">
              {activeItem.label}
            </span>
          </>
        )}
      </nav>

      <div className="flex items-start justify-between gap-2">
        <h1 className="font-bold text-2xl">
          <Link href={`/groups/${groupId}`}>
            {isLoading ? (
              <Skeleton className="mt-1.5 mb-1.5 h-5 w-32" />
            ) : (
              <div className="flex">{group.name}</div>
            )}
          </Link>
        </h1>
        {group && (
          <div className="hidden lg:block">
            <ShareButton group={group} />
          </div>
        )}
      </div>

      <div className="flex gap-2 justify-between items-start lg:hidden">
        <GroupTabs groupId={groupId} />
        {group && <ShareButton group={group} />}
      </div>
    </div>
  )
}
