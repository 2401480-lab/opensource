'use client'

import {
  joinErrorKey,
  ParticipantPicker,
} from '@/components/participant-picker'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/use-toast'
import { trpc } from '@/trpc/client'
import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export function JoinGroup({
  token,
  userName,
}: {
  token: string
  userName: string
}) {
  const t = useTranslations('Join')
  const router = useRouter()
  const { toast } = useToast()
  const utils = trpc.useUtils()
  const { data, isLoading, isError } = trpc.membership.invite.useQuery(
    { token },
    { retry: false },
  )
  const { mutateAsync } = trpc.membership.joinWithInvite.useMutation()

  if (isLoading)
    return <Loader2 className="w-5 h-5 m-4 animate-spin" aria-hidden />

  if (isError || !data) {
    return (
      <Card>
        <CardContent className="pt-6 flex flex-col gap-4">
          <p>{t('invalid')}</p>
          <Button variant="secondary" asChild>
            <Link href="/groups">{t('backHome')}</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  const { group, membership } = data

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title', { name: group.name })}</CardTitle>
      </CardHeader>
      <CardContent>
        {membership ? (
          <div className="flex flex-col gap-4">
            <p>{t('alreadyMember')}</p>
            <Button asChild>
              <Link href={`/groups/${group.id}`}>{t('open')}</Link>
            </Button>
          </div>
        ) : (
          <ParticipantPicker
            participants={group.unlinkedParticipants}
            defaultNewName={userName}
            submitLabel={t('submit')}
            onSubmit={async (choice) => {
              try {
                const { groupId } = await mutateAsync({ token, choice })
                await utils.groups.invalidate()
                router.push(`/groups/${groupId}`)
              } catch (error) {
                toast({
                  description: t(`errors.${joinErrorKey(error)}`),
                  variant: 'destructive',
                })
              }
            }}
          />
        )}
      </CardContent>
    </Card>
  )
}
