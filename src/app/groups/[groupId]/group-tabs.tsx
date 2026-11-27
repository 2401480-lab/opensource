'use client'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { trpc } from '@/trpc/client'
import {
  Activity,
  BarChart3,
  ChevronDown,
  Home,
  Info,
  PiggyBank,
  Receipt,
  Scale,
  Settings,
  Users,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { ComponentType } from 'react'

type Props = {
  groupId: string
}

type Item = { value: string; label: string; Icon: ComponentType<any> }

/**
 * The group's navigation, by importance: the main tasks as tabs (home,
 * expenses, settlements, statistics), everything else under "More".
 * Every page that existed before is still reachable.
 */
export function GroupTabs({ groupId }: Props) {
  const t = useTranslations('GroupNav')
  const pathname = usePathname()
  const router = useRouter()
  const { data } = trpc.groups.get.useQuery({ groupId })
  const fundEnabled = data?.group?.fundEnabled === true
  const isAdmin = data?.me?.role === 'OWNER'
  const section =
    pathname.replace(/^\/groups\/[^/]+\/?([^/]*).*/, '$1') || 'overview'

  const primary: Item[] = [
    { value: 'overview', label: t('overview'), Icon: Home },
    { value: 'expenses', label: t('expenses'), Icon: Receipt },
    { value: 'settlements', label: t('settlements'), Icon: Scale },
    ...(fundEnabled
      ? [{ value: 'fund', label: t('fund'), Icon: PiggyBank }]
      : []),
    { value: 'stats', label: t('stats'), Icon: BarChart3 },
  ]
  const secondary: Item[] = [
    { value: 'information', label: t('information'), Icon: Info },
    { value: 'members', label: t('members'), Icon: Users },
    { value: 'activity', label: t('activity'), Icon: Activity },
    { value: 'edit', label: t('settings'), Icon: Settings },
    ...(isAdmin
      ? [{ value: 'fund/settings', label: t('fundSettings'), Icon: PiggyBank }]
      : []),
  ]
  const href = (value: string) =>
    value === 'overview' ? `/groups/${groupId}` : `/groups/${groupId}/${value}`
  const inSecondary = secondary.some((item) => item.value === section)

  return (
    <div className="flex gap-2 flex-1 min-w-0">
      <Tabs
        value={inSecondary ? '' : section}
        className="[&>*]:border min-w-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        onValueChange={(value) => router.push(href(value))}
      >
        <TabsList>
          {primary.map(({ value, label, Icon }) => (
            <TabsTrigger
              key={value}
              value={value}
              title={label}
              className="gap-1.5 px-2.5 sm:px-3"
            >
              <Icon className="w-4 h-4 hidden sm:block" />
              <span>{label}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              'flex-shrink-0 gap-1 px-2.5',
              inSecondary && 'bg-accent',
            )}
          >
            {inSecondary
              ? secondary.find((item) => item.value === section)?.label
              : t('more')}
            <ChevronDown className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {secondary.map(({ value, label, Icon }) => (
            <DropdownMenuItem key={value} asChild>
              <Link href={href(value)} className="gap-2">
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
