'use client'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SessionUser } from '@/lib/auth'
import { authClient } from '@/lib/auth-client'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

export function AccountForm({ user }: { user: SessionUser }) {
  const t = useTranslations('Account')
  const [name, setName] = useState(user.name)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>(
    'idle',
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <form
        onSubmit={async (event) => {
          event.preventDefault()
          if (name.trim().length < 2) return
          setStatus('saving')
          const { error } = await authClient.updateUser({ name: name.trim() })
          setStatus(error ? 'error' : 'saved')
        }}
      >
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">{t('email')}</Label>
            <Input id="email" value={user.email} readOnly disabled />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">{t('name')}</Label>
            <Input
              id="name"
              className="text-base"
              minLength={2}
              maxLength={50}
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                setStatus('idle')
              }}
            />
            <p className="text-xs text-muted-foreground">{t('nameNote')}</p>
          </div>
          {status === 'saved' && (
            <p role="status" className="text-sm text-primary">
              {t('saved')}
            </p>
          )}
        </CardContent>
        <CardFooter className="flex gap-2 justify-between">
          <Button type="submit" disabled={status === 'saving'}>
            {t('save')}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={async () => {
              await authClient.signOut()
              window.location.assign('/login')
            }}
          >
            {t('logout')}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
