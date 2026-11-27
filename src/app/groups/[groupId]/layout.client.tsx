'use client'

import { DeleteGroupNotice } from '@/app/groups/[groupId]/delete-group-notice'
import { useToast } from '@/components/ui/use-toast'
import { trpc } from '@/trpc/client'
import { useTranslations } from 'next-intl'
import { PropsWithChildren, useEffect } from 'react'
import { CurrentGroupProvider } from './current-group-context'
import { GroupHeader } from './group-header'
import { GroupSideNav } from './group-side-nav'

export function GroupLayoutClient({
  groupId,
  children,
}: PropsWithChildren<{ groupId: string }>) {
  const { data, isLoading } = trpc.groups.get.useQuery({ groupId })
  const t = useTranslations('Groups.NotFound')
  const { toast } = useToast()

  useEffect(() => {
    if (data && !data.group) {
      toast({
        description: t('text'),
        variant: 'destructive',
      })
    }
  }, [data])

  const props =
    isLoading || !data?.group
      ? { isLoading: true as const, groupId, group: undefined }
      : { isLoading: false as const, groupId, group: data.group }

  // Phones: tabs under the group name. Wide screens: a sidebar with every
  // page of the group, and the page beside it.
  return (
    <CurrentGroupProvider {...props}>
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start">
        <GroupSideNav
          groupId={groupId}
          className="hidden lg:flex lg:sticky lg:top-20"
        />
        <div className="flex flex-col gap-6 min-w-0">
          <GroupHeader />
          {!isLoading && <DeleteGroupNotice />}
          {children}
        </div>
      </div>
    </CurrentGroupProvider>
  )
}
