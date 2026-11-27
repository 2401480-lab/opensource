'use client'

import { trpc } from '@/trpc/client'
import {
  Activity,
  BarChart3,
  Home,
  Info,
  PiggyBank,
  Receipt,
  Scale,
  Settings,
  UserRoundSearch,
  Users,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { usePathname } from 'next/navigation'
import { ComponentType } from 'react'

export type GroupNavItem = {
  value: string
  label: string
  Icon: ComponentType<{ className?: string }>
}

/**
 * The group's pages, shared by the mobile tabs and the desktop sidebar:
 * main tasks first, everything else after. Which item is active is derived
 * from the URL (the longest matching path wins, so "fund/settings" beats
 * "fund").
 */
export function useGroupNav(groupId: string) {
  const t = useTranslations('GroupNav')
  const pathname = usePathname()
  const { data } = trpc.groups.get.useQuery({ groupId })
  const fundEnabled = data?.group?.fundEnabled === true
  const isAdmin = data?.me?.role === 'OWNER'

  const primary: GroupNavItem[] = [
    { value: 'overview', label: t('overview'), Icon: Home },
    { value: 'expenses', label: t('expenses'), Icon: Receipt },
    { value: 'settlements', label: t('settlements'), Icon: Scale },
    ...(fundEnabled
      ? [{ value: 'fund', label: t('fund'), Icon: PiggyBank }]
      : []),
    { value: 'stats', label: t('stats'), Icon: BarChart3 },
  ]
  const secondary: GroupNavItem[] = [
    { value: 'my-balance', label: t('myBalance'), Icon: UserRoundSearch },
    { value: 'members', label: t('members'), Icon: Users },
    { value: 'information', label: t('information'), Icon: Info },
    { value: 'activity', label: t('activity'), Icon: Activity },
    { value: 'edit', label: t('settings'), Icon: Settings },
    ...(isAdmin
      ? [{ value: 'fund/settings', label: t('fundSettings'), Icon: PiggyBank }]
      : []),
  ]

  const path = pathname.replace(/^\/groups\/[^/]+\/?/, '').replace(/\/$/, '')
  const active =
    path === ''
      ? 'overview'
      : ([...primary, ...secondary]
          .map((item) => item.value)
          .filter((value) => path === value || path.startsWith(`${value}/`))
          .sort((a, b) => b.length - a.length)[0] ?? '')
  const href = (value: string) =>
    value === 'overview' ? `/groups/${groupId}` : `/groups/${groupId}/${value}`
  const activeItem = [...primary, ...secondary].find((i) => i.value === active)

  return { primary, secondary, active, activeItem, href }
}
