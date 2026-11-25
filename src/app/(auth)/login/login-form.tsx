'use client'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { authClient } from '@/lib/auth-client'
import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useState } from 'react'
import { authErrorKey } from '../auth-error'

export function LoginForm({ next }: { next: string }) {
  const t = useTranslations('Auth')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('loginTitle')}</CardTitle>
      </CardHeader>
      <form
        onSubmit={async (event) => {
          event.preventDefault()
          setPending(true)
          setError(null)
          const { error } = await authClient.signIn.email({ email, password })
          if (error) {
            setError(t(`errors.${authErrorKey(error)}`))
            setPending(false)
            return
          }
          // A full navigation, so that every server component re-renders with
          // the new session.
          window.location.assign(next)
        }}
      >
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">{t('email')}</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              className="text-base"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">{t('password')}</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              className="text-base"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </CardContent>
        <CardFooter className="flex flex-col gap-3 items-stretch">
          <Button type="submit" disabled={pending}>
            {pending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {pending ? t('loggingIn') : t('login')}
          </Button>
          <p className="text-sm text-center text-muted-foreground">
            {t('noAccount')}{' '}
            <Link
              className="text-primary underline"
              href={`/signup?next=${encodeURIComponent(next)}`}
            >
              {t('goSignup')}
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  )
}
