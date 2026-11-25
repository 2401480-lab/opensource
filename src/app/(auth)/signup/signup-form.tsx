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

export function SignupForm({ next }: { next: string }) {
  const t = useTranslations('Auth')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('signupTitle')}</CardTitle>
      </CardHeader>
      <form
        onSubmit={async (event) => {
          event.preventDefault()
          setError(null)
          if (name.trim().length < 2) return setError(t('errors.nameRequired'))
          if (password.length < 8) return setError(t('errors.passwordTooShort'))
          if (password !== passwordConfirm)
            return setError(t('errors.passwordMismatch'))
          setPending(true)
          const { error } = await authClient.signUp.email({
            name: name.trim(),
            email,
            password,
          })
          if (error) {
            setError(t(`errors.${authErrorKey(error)}`))
            setPending(false)
            return
          }
          window.location.assign(next)
        }}
      >
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">{t('name')}</Label>
            <Input
              id="name"
              autoComplete="name"
              className="text-base"
              required
              minLength={2}
              maxLength={50}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">{t('nameHint')}</p>
          </div>
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
              autoComplete="new-password"
              className="text-base"
              required
              minLength={8}
              maxLength={128}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">{t('passwordHint')}</p>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="passwordConfirm">{t('passwordConfirm')}</Label>
            <Input
              id="passwordConfirm"
              type="password"
              autoComplete="new-password"
              className="text-base"
              required
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
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
            {pending ? t('signingUp') : t('signup')}
          </Button>
          <p className="text-sm text-center text-muted-foreground">
            {t('haveAccount')}{' '}
            <Link
              className="text-primary underline"
              href={`/login?next=${encodeURIComponent(next)}`}
            >
              {t('goLogin')}
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  )
}
