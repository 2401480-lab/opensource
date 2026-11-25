'use client'

import {
  archiveGroup,
  starGroup,
  unarchiveGroup,
  unstarGroup,
} from '@/app/groups/recent-groups-helpers'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { formatCurrency, getCurrencyFromGroup } from '@/lib/utils'
import { AppRouterOutput } from '@/trpc/routers/_app'
import { StarFilledIcon } from '@radix-ui/react-icons'
import { MoreHorizontal, Star, Users } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import Link from 'next/link'

type MyGroup = AppRouterOutput['groups']['list']['groups'][number]

/** One of the user's groups, with what the user has to do in it. */
export function MyGroupCard({
  group,
  isStarred,
  isArchived,
  refresh,
}: {
  group: MyGroup
  isStarred: boolean
  isArchived: boolean
  refresh: () => void
}) {
  const locale = useLocale()
  const t = useTranslations('MyGroups')
  const tGroups = useTranslations('Groups')
  const currency = getCurrencyFromGroup(group)
  const money = (amount: number) => formatCurrency(currency, amount, locale)

  // Sending comes first: it is what the user has to act on.
  const lines = [
    ...group.toSend.map((r) => ({
      kind: 'send' as const,
      text: t('status.toSend', { name: r.to, amount: money(r.amount) }),
    })),
    ...group.toReceive.map((r) => ({
      kind: 'receive' as const,
      text: t('status.toReceive', { name: r.from, amount: money(r.amount) }),
    })),
  ]

  return (
    <li className="relative rounded-lg border bg-card shadow-sm p-3 flex flex-col gap-2 hover:bg-accent/50 transition-colors">
      <div className="flex gap-2 items-start justify-between">
        <Link
          href={`/groups/${group.id}`}
          className="flex-1 min-w-0 font-medium truncate after:absolute after:inset-0"
        >
          {group.name}
        </Link>
        <span className="relative z-10 flex-shrink-0 flex">
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            aria-label={t(isStarred ? 'unstar' : 'star')}
            onClick={() => {
              if (isStarred) unstarGroup(group.id)
              else {
                starGroup(group.id)
                unarchiveGroup(group.id)
              }
              refresh()
            }}
          >
            {isStarred ? (
              <StarFilledIcon className="w-4 h-4 text-orange-400" />
            ) : (
              <Star className="w-4 h-4 text-muted-foreground" />
            )}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" className="h-7 w-7">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => {
                  if (isArchived) unarchiveGroup(group.id)
                  else {
                    archiveGroup(group.id)
                    unstarGroup(group.id)
                  }
                  refresh()
                }}
              >
                {tGroups(isArchived ? 'unarchive' : 'archive')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </span>
      </div>

      <ul className="text-sm flex flex-col gap-0.5" data-testid="group-status">
        {lines.length === 0 ? (
          <li className="text-muted-foreground">{t('status.settled')}</li>
        ) : (
          <>
            {lines.slice(0, 2).map((line, index) => (
              <li
                key={index}
                className={
                  line.kind === 'send'
                    ? 'font-semibold text-red-700 dark:text-red-400'
                    : 'font-semibold text-green-700 dark:text-green-400'
                }
              >
                {line.text}
              </li>
            ))}
            {lines.length > 2 && (
              <li className="text-muted-foreground">
                {t('status.more', { count: lines.length - 2 })}
              </li>
            )}
          </>
        )}
      </ul>

      <div className="text-xs text-muted-foreground flex items-center gap-3">
        <span className="flex items-center gap-1">
          <Users className="w-3 h-3" />
          {t('members', { count: group.participantCount })}
        </span>
        {group.role === 'OWNER' && <span>{t('owner')}</span>}
      </div>
    </li>
  )
}
