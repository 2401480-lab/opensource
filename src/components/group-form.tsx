import { DeleteGroupButton } from '@/components/delete-group-button'
import { SubmitButton } from '@/components/submit-button'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card'
import { Input } from '@/components/ui/input'
import { Locale } from '@/i18n/request'
import { useAnalytics } from '@/lib/analytics/context'
import { getGroup } from '@/lib/api'
import { defaultCurrencyList, getCurrency } from '@/lib/currency'
import {
  GROUP_INFORMATION_MAX,
  groupFormSchema,
  GroupFormValues,
} from '@/lib/schemas'
import { zodResolver } from '@hookform/resolvers/zod'
import { Save, Trash2 } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import Link from 'next/link'
import { useFieldArray, useForm } from 'react-hook-form'
import { CurrencySelector } from './currency-selector'
import { Textarea } from './ui/textarea'

export type Props = {
  group?: NonNullable<Awaited<ReturnType<typeof getGroup>>>
  onSubmit: (groupFormValues: GroupFormValues) => Promise<void>
  protectedParticipantIds?: string[]
  /** Resolved on the server, since the runtime variable is not public. */
  defaultCurrencyCode?: string
  /** Whether to offer deleting the group (ENABLE_GROUP_DELETION). */
  enableGroupDeletion?: boolean
  /**
   * Creating: the signed-in user's name. They are the first participant of the
   * new group (the server links that participant to their account).
   */
  currentUserName?: string
  /** Editing: the signed-in user's participant, shown as "you". */
  myParticipantId?: string
  /** Editing: participants linked to an account (members). */
  linkedParticipantIds?: string[]
}

export function GroupForm({
  group,
  onSubmit,
  protectedParticipantIds = [],
  defaultCurrencyCode = 'KRW',
  enableGroupDeletion = false,
  currentUserName = '',
  myParticipantId,
  linkedParticipantIds = [],
}: Props) {
  const locale = useLocale()
  const t = useTranslations('GroupForm')
  const form = useForm<GroupFormValues>({
    resolver: zodResolver(groupFormSchema),
    defaultValues: group
      ? {
          name: group.name,
          information: group.information ?? '',
          currency: group.currency ?? '',
          currencyCode: group.currencyCode ?? '',
          participants: group.participants,
        }
      : {
          name: '',
          information: '',
          currency: '',
          currencyCode: defaultCurrencyCode, // TODO: derive from the locale when not configured
          // The creator first; others can be added now or join later with
          // the invite link.
          participants: [{ name: currentUserName }],
        },
  })
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'participants',
    keyName: 'key',
  })
  const sendEvent = useAnalytics()

  const participantBadge = (id: string | undefined, index: number) => {
    if (!group) return index === 0 ? t('Participants.you') : null
    if (id && id === myParticipantId) return t('Participants.you')
    if (id && linkedParticipantIds.includes(id)) return t('Participants.member')
    return null
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(async (values) => {
          if (group) {
            sendEvent(
              { event: 'group: update', props: {} },
              `/groups/${group.id}/edit`,
            )
          } else {
            sendEvent({ event: 'group: create', props: {} }, `/groups`)
          }
          await onSubmit(values)
        })}
      >
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>{t('title')}</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('NameField.label')}</FormLabel>
                  <FormControl>
                    <Input
                      className="text-base"
                      placeholder={t('NameField.placeholder')}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    {t('NameField.description')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="currencyCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('CurrencyCodeField.label')}</FormLabel>
                  <CurrencySelector
                    currencies={defaultCurrencyList(
                      locale as Locale,
                      t('CurrencyCodeField.customOption'),
                    )}
                    defaultValue={form.watch(field.name) ?? ''}
                    onValueChange={(newCurrency) => {
                      field.onChange(newCurrency)
                      const currency = getCurrency(newCurrency)
                      if (
                        currency.code.length ||
                        form.getFieldState('currency').isTouched
                      )
                        form.setValue('currency', currency.symbol, {
                          shouldValidate: true,
                          shouldTouch: true,
                          shouldDirty: true,
                        })
                    }}
                    isLoading={false}
                  />
                  <FormDescription>
                    {t(
                      group
                        ? 'CurrencyCodeField.editDescription'
                        : 'CurrencyCodeField.createDescription',
                    )}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="currency"
              render={({ field }) => (
                <FormItem hidden={!!form.watch('currencyCode')?.length}>
                  <FormLabel>{t('CurrencyField.label')}</FormLabel>
                  <FormControl>
                    <Input
                      className="text-base"
                      placeholder={t('CurrencyField.placeholder')}
                      max={5}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    {t('CurrencyField.description')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="col-span-2">
              <FormField
                control={form.control}
                name="information"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('InformationField.label')}</FormLabel>
                    <FormControl>
                      <Textarea
                        rows={2}
                        className="text-base"
                        maxLength={GROUP_INFORMATION_MAX}
                        {...field}
                        placeholder={t('InformationField.placeholder')}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="mb-4">
          <CardHeader>
            <CardTitle>{t('Participants.title')}</CardTitle>
            <CardDescription>{t('Participants.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2">
              {fields.map((item, index) => (
                <li key={item.key}>
                  <FormField
                    control={form.control}
                    name={`participants.${index}.name`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="sr-only">
                          Participant #{index + 1}
                        </FormLabel>
                        <FormControl>
                          <div className="flex gap-2">
                            <Input
                              className="text-base"
                              {...field}
                              placeholder={t('Participants.new')}
                            />
                            {participantBadge(item.id, index) && (
                              <span className="self-center flex-shrink-0 text-xs rounded-full border px-2 py-0.5 text-muted-foreground">
                                {participantBadge(item.id, index)}
                              </span>
                            )}
                            {(!group && index === 0) ||
                            (item.id &&
                              protectedParticipantIds.includes(item.id)) ? (
                              <HoverCard>
                                <HoverCardTrigger>
                                  <Button
                                    variant="ghost"
                                    className="text-destructive-"
                                    type="button"
                                    size="icon"
                                    disabled
                                  >
                                    <Trash2 className="w-4 h-4 text-destructive opacity-50" />
                                  </Button>
                                </HoverCardTrigger>
                                <HoverCardContent
                                  align="end"
                                  className="text-sm"
                                >
                                  {t('Participants.protectedParticipant')}
                                </HoverCardContent>
                              </HoverCard>
                            ) : (
                              <Button
                                variant="ghost"
                                className="text-destructive"
                                onClick={() => remove(index)}
                                type="button"
                                size="icon"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </li>
              ))}
            </ul>
          </CardContent>
          <CardFooter>
            <Button
              variant="secondary"
              onClick={() => {
                append({ name: '' })
              }}
              type="button"
            >
              {t('Participants.add')}
            </Button>
          </CardFooter>
        </Card>

        <div className="flex mt-4 gap-2">
          <SubmitButton
            loadingContent={t(group ? 'Settings.saving' : 'Settings.creating')}
          >
            <Save className="w-4 h-4 mr-2" />{' '}
            {t(group ? 'Settings.save' : 'Settings.create')}
          </SubmitButton>
          {!group && (
            <Button variant="ghost" asChild>
              <Link href="/groups">{t('Settings.cancel')}</Link>
            </Button>
          )}
        </div>

        {enableGroupDeletion && group && !group.deleteAt && (
          <Card className="mt-8 border-red-700">
            <CardHeader>
              <CardTitle className="text-red-700">
                {t('Delete.title')}
              </CardTitle>
              <CardDescription>{t('Delete.description')}</CardDescription>
            </CardHeader>
            <CardContent>
              <DeleteGroupButton group={group} />
            </CardContent>
          </Card>
        )}
      </form>
    </Form>
  )
}
