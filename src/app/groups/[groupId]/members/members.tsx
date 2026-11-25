'use client'

import { CopyButton } from '@/components/copy-button'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useBaseUrl } from '@/lib/hooks'
import { trpc } from '@/trpc/client'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useState } from 'react'
import { useCurrentGroup } from '../current-group-context'

/** Who is in the group, who has joined with an account, and the invite link. */
export function Members() {
  const t = useTranslations('Members')
  const { groupId, group } = useCurrentGroup()
  const { data: groupData } = trpc.groups.get.useQuery({ groupId })
  const { data: invite } = trpc.groups.invites.get.useQuery({ groupId })
  const baseUrl = useBaseUrl()
  const me = groupData?.me
  const participants = groupData?.group?.participants ?? []
  const url = baseUrl && invite ? `${baseUrl}/invite/${invite.token}` : null

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
          <CardDescription>
            {t('description')} {t('emailDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col divide-y text-sm">
            {participants.map((participant) => (
              <li
                key={participant.id}
                className="py-2 flex items-center justify-between gap-2"
              >
                <div className="flex flex-col gap-1 flex-1 min-w-0">
                  <span className="font-medium">{participant.name}</span>
                  {!participant.isLinked && (
                    <EmailInvite
                      groupId={groupId}
                      participantId={participant.id}
                      invite={participant.invite}
                    />
                  )}
                </div>
                <span className="text-xs text-muted-foreground self-start pt-0.5">
                  {participant.id === me?.participantId
                    ? t('you')
                    : participant.role === 'OWNER'
                      ? t('owner')
                      : participant.isLinked
                        ? t('joined')
                        : t('notJoined')}
                </span>
              </li>
            ))}
          </ul>
          {group && (
            <Button variant="secondary" size="sm" className="mt-4" asChild>
              <Link href={`/groups/${groupId}/edit`}>{t('edit')}</Link>
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('inviteTitle')}</CardTitle>
          <CardDescription>{t('inviteDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          {url && (
            <div className="flex gap-2">
              <Input className="flex-1" value={url} readOnly />
              <CopyButton text={url} title={t('copy')} />
            </div>
          )}
        </CardContent>
      </Card>
    </>
  )
}

/** Pending email invite of a participant who has not joined, or a form to send one. */
function EmailInvite({
  groupId,
  participantId,
  invite,
}: {
  groupId: string
  participantId: string
  invite: { id: string; email: string } | null
}) {
  const t = useTranslations('Members')
  const utils = trpc.useUtils()
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const refresh = () => utils.groups.invalidate()
  const send = trpc.groups.invites.sendEmail.useMutation({
    onSuccess: async () => {
      setOpen(false)
      setEmail('')
      setMessage(t('emailSent'))
      await refresh()
    },
    onError: (error) =>
      setMessage(
        error.message === 'EMAIL_ALREADY_MEMBER'
          ? t('emailAlreadyMember')
          : error.data?.code === 'BAD_REQUEST'
            ? t('invalidEmail')
            : t('emailError'),
      ),
  })
  const cancel = trpc.groups.invites.cancelEmail.useMutation({
    onSuccess: async () => {
      setMessage(null)
      await refresh()
    },
  })

  if (invite)
    return (
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span data-testid="email-invite">
          {t('invited', { email: invite.email })}
        </span>
        <Button
          variant="link"
          size="sm"
          className="h-auto p-0 text-xs"
          disabled={cancel.isPending}
          onClick={() => cancel.mutate({ groupId, inviteId: invite.id })}
        >
          {t('cancelInvite')}
        </Button>
        {message && <span className="w-full">{message}</span>}
      </div>
    )

  return (
    <div className="flex flex-col gap-1 text-xs">
      {open ? (
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            setMessage(null)
            send.mutate({ groupId, participantId, email })
          }}
        >
          <Input
            type="email"
            required
            autoFocus
            className="h-8 text-sm"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder={t('emailPlaceholder')}
            aria-label={t('emailPlaceholder')}
          />
          <Button type="submit" size="sm" disabled={send.isPending}>
            {t('send')}
          </Button>
        </form>
      ) : (
        <Button
          variant="link"
          size="sm"
          className="h-auto p-0 text-xs self-start"
          onClick={() => setOpen(true)}
        >
          {t('emailInvite')}
        </Button>
      )}
      {message && <span className="text-muted-foreground">{message}</span>}
    </div>
  )
}
