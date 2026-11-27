'use client'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { GroupNavItem, useGroupNav } from './group-nav'

/** Desktop navigation: every page of the group in a sidebar, like a web app. */
export function GroupSideNav({
  groupId,
  className,
}: {
  groupId: string
  className?: string
}) {
  const t = useTranslations('GroupNav')
  const { primary, secondary, active, href } = useGroupNav(groupId)

  const item = ({ value, label, Icon }: GroupNavItem) => (
    <Link
      key={value}
      href={href(value)}
      aria-current={value === active ? 'page' : undefined}
      className={cn(
        'flex h-10 items-center gap-2.5 rounded-md px-3 text-sm transition-colors',
        value === active
          ? 'bg-primary/10 font-semibold text-primary'
          : 'text-muted-foreground hover:bg-accent hover:text-foreground',
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  )

  return (
    <nav
      aria-label={t('sideNav')}
      data-testid="group-side-nav"
      className={cn(
        'flex-col gap-1 rounded-xl border bg-card p-3 shadow-sm',
        className,
      )}
    >
      {primary.map(item)}
      <div className="my-2 border-t" />
      {secondary.map(item)}
      <Button asChild className="mt-3">
        <Link href={`/groups/${groupId}/expenses/create`}>
          <Plus className="mr-1 h-4 w-4" />
          {t('addExpense')}
        </Link>
      </Button>
    </nav>
  )
}
