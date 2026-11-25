'use client'

import {
  joinErrorKey,
  ParticipantPicker,
} from '@/components/participant-picker'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useToast } from '@/components/ui/use-toast'
import { trpc } from '@/trpc/client'
import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'

/**
 * Shown instead of a group created before accounts existed, until someone
 * claims it by saying which participant they are.
 */
export function ClaimGroup({
  groupId,
  userName,
}: {
  groupId: string
  userName: string
}) {
  const t = useTranslations('Join')
  const { toast } = useToast()
  const { data, isLoading } = trpc.membership.unclaimedGroup.useQuery({
    groupId,
  })
  const { mutateAsync } = trpc.membership.claim.useMutation()

  if (isLoading || !data)
    return <Loader2 className="w-5 h-5 m-4 animate-spin" aria-hidden />
  if (!data.group) return <NoGroupAccess />

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('claimTitle', { name: data.group.name })}</CardTitle>
        <CardDescription>{t('claimHelp')}</CardDescription>
      </CardHeader>
      <CardContent>
        <ParticipantPicker
          participants={data.group.unlinkedParticipants}
          defaultNewName={userName}
          submitLabel={t('claimSubmit')}
          onSubmit={async (choice) => {
            try {
              await mutateAsync({ groupId, choice })
              // Full reload: the server layout decides what to render.
              window.location.reload()
            } catch (error) {
              toast({
                description: t(`errors.${joinErrorKey(error)}`),
                variant: 'destructive',
              })
            }
          }}
        />
      </CardContent>
    </Card>
  )
}

export function NoGroupAccess() {
  const t = useTranslations('Join')
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('forbiddenTitle')}</CardTitle>
        <CardDescription>{t('forbiddenHelp')}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="secondary" asChild>
          <Link href="/groups">{t('backHome')}</Link>
        </Button>
      </CardContent>
    </Card>
  )
}
