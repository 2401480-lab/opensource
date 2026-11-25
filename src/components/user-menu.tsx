'use client'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { authClient } from '@/lib/auth-client'
import { CircleUser } from 'lucide-react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'

/** Header links for the signed-in user; nothing on the login pages. */
export function UserMenu() {
  const t = useTranslations('UserMenu')
  const { data: session } = authClient.useSession()
  if (!session) return null

  return (
    <>
      <li>
        <Button
          variant="ghost"
          size="sm"
          asChild
          className="-my-3 text-primary"
        >
          <Link href="/groups">{t('myGroups')}</Link>
        </Button>
      </li>
      <li>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="-my-3 gap-1">
              <CircleUser className="w-4 h-4" />
              <span className="max-w-[8rem] truncate">{session.user.name}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel className="font-normal text-xs text-muted-foreground">
              {session.user.email}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/account">{t('account')}</Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={async () => {
                await authClient.signOut()
                window.location.assign('/login')
              }}
            >
              {t('logout')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </li>
    </>
  )
}
