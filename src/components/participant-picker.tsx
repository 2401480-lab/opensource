'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

export type ParticipantChoice = { participantId: string } | { newName: string }

const NEW = '__new__'

/**
 * Asks the user which participant of a group they are, or to join as a new
 * one. Used when joining with an invite link and when claiming a group created
 * before accounts existed. The choice is always explicit: nothing is matched
 * by name.
 */
export function ParticipantPicker({
  participants,
  defaultNewName,
  submitLabel,
  onSubmit,
}: {
  participants: { id: string; name: string }[]
  defaultNewName: string
  submitLabel: string
  onSubmit: (choice: ParticipantChoice) => Promise<void>
}) {
  const t = useTranslations('Join')
  const [selected, setSelected] = useState<string>(
    participants.length === 0 ? NEW : '',
  )
  const [newName, setNewName] = useState(defaultNewName)
  const [pending, setPending] = useState(false)

  const canSubmit =
    selected === NEW ? newName.trim().length >= 2 : selected !== ''

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (event) => {
        event.preventDefault()
        if (!canSubmit) return
        setPending(true)
        try {
          await onSubmit(
            selected === NEW
              ? { newName: newName.trim() }
              : { participantId: selected },
          )
        } finally {
          setPending(false)
        }
      }}
    >
      <div>
        <h2 className="font-semibold">{t('whoAreYou')}</h2>
        <p className="text-sm text-muted-foreground">{t('whoAreYouHelp')}</p>
      </div>
      <RadioGroup value={selected} onValueChange={setSelected}>
        <div className="flex flex-col gap-3">
          {participants.map((participant) => (
            <div key={participant.id} className="flex items-center gap-2">
              <RadioGroupItem value={participant.id} id={participant.id} />
              <Label htmlFor={participant.id} className="flex-1 text-base">
                {participant.name}
              </Label>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <RadioGroupItem value={NEW} id={NEW} />
            <Label htmlFor={NEW} className="flex-1">
              {t('newParticipant')}
            </Label>
          </div>
        </div>
      </RadioGroup>
      {selected === NEW && (
        <div className="flex flex-col gap-2 pl-6">
          <Label htmlFor="new-name">{t('newName')}</Label>
          <Input
            id="new-name"
            className="text-base"
            minLength={2}
            maxLength={50}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
        </div>
      )}
      <Button type="submit" disabled={!canSubmit || pending}>
        {pending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        {pending ? t('joining') : submitLabel}
      </Button>
    </form>
  )
}

/** The `Join.errors.*` key for a failed join/claim. */
export function joinErrorKey(error: unknown) {
  const message =
    error && typeof error === 'object' && 'message' in error
      ? String(error.message)
      : ''
  return [
    'PARTICIPANT_TAKEN',
    'DUPLICATE_NAME',
    'GROUP_ALREADY_CLAIMED',
  ].includes(message)
    ? message
    : 'generic'
}
