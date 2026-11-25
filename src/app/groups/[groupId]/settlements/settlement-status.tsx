import { cn } from '@/lib/utils'
import { useTranslations } from 'next-intl'

export type DisplayStatus =
  'UNSETTLED' | 'PENDING' | 'CONFIRMED' | 'REJECTED' | 'CANCELED' | 'LEGACY'

/** A status in words (never only a color). */
export function SettlementStatusBadge({ status }: { status: DisplayStatus }) {
  const t = useTranslations('Settlements.Status')
  return (
    <span
      data-testid="settlement-status"
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        status === 'PENDING' &&
          'border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
        status === 'CONFIRMED' &&
          'border-green-300 bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-200',
        status === 'REJECTED' &&
          'border-red-300 bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200',
        (status === 'CANCELED' ||
          status === 'UNSETTLED' ||
          status === 'LEGACY') &&
          'text-muted-foreground',
      )}
    >
      {t(status)}
    </span>
  )
}
