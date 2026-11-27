'use client'

import { cn } from '@/lib/utils'
import { usePathname } from 'next/navigation'
import { PropsWithChildren } from 'react'

/**
 * Group pages and the group list use the width of a desktop screen (sidebar
 * and dashboard); forms such as "create a group" stay narrow.
 */
export function GroupsMain({ children }: PropsWithChildren) {
  const pathname = usePathname()
  const wide =
    pathname === '/groups' ||
    (/^\/groups\/[^/]+/.test(pathname) &&
      !pathname.startsWith('/groups/create'))
  return (
    <main
      className={cn(
        'flex-1 w-full mx-auto px-4 py-6 flex flex-col gap-6',
        wide ? 'max-w-screen-md lg:max-w-screen-xl' : 'max-w-screen-md',
      )}
    >
      {children}
    </main>
  )
}
