'use client'

import { GroupForm } from '@/components/group-form'
import { RuntimeFeatureFlags } from '@/lib/featureFlags'
import { trpc } from '@/trpc/client'
import { useCurrentGroup } from '../current-group-context'

export const EditGroup = ({
  runtimeFeatureFlags,
}: {
  runtimeFeatureFlags: RuntimeFeatureFlags
}) => {
  const { groupId } = useCurrentGroup()
  const { data, isLoading } = trpc.groups.getDetails.useQuery({ groupId })
  const { data: groupData } = trpc.groups.get.useQuery({ groupId })
  const { mutateAsync } = trpc.groups.update.useMutation()
  const utils = trpc.useUtils()

  if (isLoading) return <></>

  return (
    <GroupForm
      group={data?.group}
      onSubmit={async (groupFormValues) => {
        await mutateAsync({ groupId, groupFormValues })
        await utils.groups.invalidate()
      }}
      protectedParticipantIds={data?.participantsWithExpenses}
      myParticipantId={groupData?.me.participantId}
      linkedParticipantIds={data?.group.participants
        .filter((p) => p.isLinked)
        .map((p) => p.id)}
      enableGroupDeletion={runtimeFeatureFlags.enableGroupDeletion}
    />
  )
}
