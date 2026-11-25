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
          <CardDescription>{t('description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col divide-y text-sm">
            {participants.map((participant) => (
              <li
                key={participant.id}
                className="py-2 flex items-center justify-between gap-2"
              >
                <span className="font-medium">{participant.name}</span>
                <span className="text-xs text-muted-foreground">
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
