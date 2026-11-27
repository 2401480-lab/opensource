/**
 * 회비 (shared fund) rules. Pure, so they can be unit tested; the server uses
 * them for every check and the page only for display.
 *
 * The fee is monthly. A month is a "YYYY-MM" string in the group's local time
 * (Korea), so the 1st of the month starts at midnight there, not in UTC.
 */

export const FUND_TIME_ZONE = 'Asia/Seoul'
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/

export function isMonth(value: string): boolean {
  return MONTH.test(value)
}

/** "YYYY-MM" of a date, in the fund's time zone. */
export function monthOf(date: Date, timeZone = FUND_TIME_ZONE): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(date)
  const year = parts.find((p) => p.type === 'year')!.value
  const month = parts.find((p) => p.type === 'month')!.value
  return `${year}-${month}`
}

/** "YYYY-MM" of a calendar date stored as UTC midnight (expense dates). */
export function monthOfDateOnly(date: Date): string {
  return date.toISOString().slice(0, 7)
}

export function addMonths(month: string, count: number): string {
  const [year, m] = month.split('-').map(Number)
  const index = year * 12 + (m - 1) + count
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`
}

/** Months from `start` to `end`, both included, oldest first. */
export function monthsBetween(start: string, end: string): string[] {
  const months: string[] = []
  for (let m = start; m <= end && months.length < 600; m = addMonths(m, 1))
    months.push(m)
  return months
}

export type FundPaymentState =
  | 'REST' // no fee this month for anyone
  | 'PAID'
  | 'PENDING' // the member says they paid, an admin has to confirm
  | 'EXEMPT' // this member does not pay this month
  | 'UNPAID' // not paid yet (or an admin said it did not arrive)

export function paymentState(
  payment: { status: 'PENDING' | 'CONFIRMED' | 'REJECTED' | 'EXEMPT' } | null,
  isRestMonth: boolean,
): FundPaymentState {
  if (isRestMonth) return 'REST'
  switch (payment?.status) {
    case 'CONFIRMED':
      return 'PAID'
    case 'PENDING':
      return 'PENDING'
    case 'EXEMPT':
      return 'EXEMPT'
    default:
      return 'UNPAID'
  }
}

/** What a member owes for a month: their own amount, or the group default. */
export function expectedAmount(
  defaultAmount: number,
  memberAmount: number | undefined,
): number {
  return memberAmount ?? defaultAmount
}

export type FundRequestError =
  | 'FUND_DISABLED'
  | 'INVALID_MONTH'
  | 'REST_MONTH'
  | 'ALREADY_PAID'
  | 'ALREADY_REQUESTED'
  | 'EXEMPT'

/** Whether a member may say "I paid" for a month. */
export function checkPaymentRequest({
  fundEnabled,
  startMonth,
  currentMonth,
  month,
  isRestMonth,
  existing,
}: {
  fundEnabled: boolean
  startMonth: string | null
  currentMonth: string
  month: string
  isRestMonth: boolean
  existing: { status: 'PENDING' | 'CONFIRMED' | 'REJECTED' | 'EXEMPT' } | null
}): FundRequestError | null {
  if (!fundEnabled || !startMonth) return 'FUND_DISABLED'
  // Paying ahead for next month is fine; further ahead or before the start is not.
  if (
    !isMonth(month) ||
    month < startMonth ||
    month > addMonths(currentMonth, 1)
  )
    return 'INVALID_MONTH'
  if (isRestMonth) return 'REST_MONTH'
  if (existing?.status === 'CONFIRMED') return 'ALREADY_PAID'
  if (existing?.status === 'PENDING') return 'ALREADY_REQUESTED'
  if (existing?.status === 'EXEMPT') return 'EXEMPT'
  return null
}

/**
 * Account balance: money that was there before + confirmed fees − expenses
 * paid from the fund.
 */
export function fundBalance({
  openingBalance,
  confirmedPayments,
  fundExpenses,
}: {
  openingBalance: number
  confirmedPayments: number[]
  fundExpenses: number[]
}): number {
  const sum = (values: number[]) => values.reduce((a, b) => a + b, 0)
  return openingBalance + sum(confirmedPayments) - sum(fundExpenses)
}
