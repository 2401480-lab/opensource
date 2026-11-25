'use client'

import { CopyButton } from '@/components/copy-button'
import { ShareQrCodeDialog } from '@/components/share-qr-code-dialog'
import { ShareUrlButton } from '@/components/share-url-button'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Group } from '@/generated/prisma/browser'
import { useBaseUrl } from '@/lib/hooks'
import { trpc } from '@/trpc/client'
import { Loader2, RefreshCw, Share } from 'lucide-react'
import { useTranslations } from 'next-intl'

type Props = {
  group: Group
}

export function ShareButton({ group }: Props) {
  const t = useTranslations('Share')
  const tInvite = useTranslations('Invite')
  const baseUrl = useBaseUrl()
  // The group URL alone no longer gives access: share the invite link.
  const { data: invite } = trpc.groups.invites.get.useQuery({
    groupId: group.id,
  })
  const { data: groupData } = trpc.groups.get.useQuery({ groupId: group.id })
  const isOwner = groupData?.me.role === 'OWNER'
  const utils = trpc.useUtils()
  const regenerate = trpc.groups.invites.regenerate.useMutation({
    onSuccess: ({ token }) =>
      utils.groups.invites.get.setData({ groupId: group.id }, { token }),
  })
  const url = baseUrl && invite && `${baseUrl}/invite/${invite.token}`

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button title={t('title')} size="icon" className="flex-shrink-0">
          <Share className="w-4 h-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="[&_p]:text-sm flex flex-col gap-3">
        <p>
          <strong>{tInvite('title')}</strong> {tInvite('description')}
        </p>
        {!url && (
          <p className="text-muted-foreground">
            <Loader2 className="w-4 h-4 mr-2 inline animate-spin" />
            {tInvite('loading')}
          </p>
        )}
        {url && (
          <div className="flex gap-2">
            <Input className="flex-1" value={url} readOnly />
            <CopyButton text={url} title={t('copyLink')} />
            <ShareUrlButton
              text={`Join my group ${group.name} on Spliit`}
              url={url}
              title={t('shareLink')}
            />
            <ShareQrCodeDialog url={url} groupName={group.name} />
          </div>
        )}
        {isOwner && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={regenerate.isPending}
              onClick={() => regenerate.mutate({ groupId: group.id })}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              {tInvite('regenerate')}
            </Button>
            <span className="text-xs text-muted-foreground">
              {tInvite('regenerateHelp')}
            </span>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
