'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { trpc } from '@/trpc/client'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

/**
 * Invitations addressed to the signed-in user's email. Accepting links the
 * account to the participant the invite was made for, and opens the group.
 */
export function ReceivedInvites() {
  const t = useTranslations('MyGroups.invites')
  const router = useRouter()
  const utils = trpc.useUtils()
  const { data } = trpc.membership.receivedInvites.useQuery()
  const [error, setError] = useState<string | null>(null)
  const refresh = () =>
    Promise.all([
      utils.membership.receivedInvites.invalidate(),
      utils.groups.list.invalidate(),
    ])
  const accept = trpc.membership.acceptInvite.useMutation({
    onSuccess: async (result) => {
      await refresh()
      if (result) router.push(`/groups/${result.groupId}`)
    },
    onError: async () => {
      setError(t('error'))
      await refresh()
    },
  })
  const decline = trpc.membership.declineInvite.useMutation({
    onSuccess: refresh,
    onError: async () => {
      setError(t('error'))
      await refresh()
    },
  })

  const invites = data?.invites ?? []
  if (invites.length === 0 && !error) return null

  const busy = accept.isPending || decline.isPending
  return (
    <Card className="border-primary/40" data-testid="received-invites">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{t('title')}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        {error && (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}
        {invites.map((invite) => (
          <div
            key={invite.id}
            data-testid="received-invite"
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-2"
          >
            <span>
              {t('item', {
                inviter: invite.invitedByName,
                group: invite.groupName,
                participant: invite.participantName,
              })}
            </span>
            <div className="flex gap-2 flex-shrink-0">
              <Button
                size="sm"
                disabled={busy}
                onClick={() => {
                  setError(null)
                  accept.mutate({ inviteId: invite.id })
                }}
              >
                {t('accept')}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={busy}
                onClick={() => {
                  setError(null)
                  decline.mutate({ inviteId: invite.id })
                }}
              >
                {t('decline')}
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
