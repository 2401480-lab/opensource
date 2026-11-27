import 'server-only'
import { Prisma } from '@/generated/prisma/client'
import {
  checkPaymentRequest,
  expectedAmount,
  fundBalance,
  isMonth,
  monthOf,
  monthOfDateOnly,
  monthsBetween,
  paymentState,
} from '@/lib/fund-rules'
import { prisma } from '@/lib/prisma'
import { randomId } from '@/lib/random'

/**
 * 회비 (shared fund): settings, monthly fees and the account balance.
 *
 * Who is billed: participants linked to an account (members). Participants
 * nobody has joined as yet are not billed. Expenses paid from the fund are
 * regular expenses with `paymentSource = FUND`, left out of balances.
 */

export class FundError extends Error {
  constructor(
    public readonly code:
      | 'GROUP_NOT_FOUND'
      | 'FUND_DISABLED'
      | 'INVALID_MONTH'
      | 'REST_MONTH'
      | 'ALREADY_PAID'
      | 'ALREADY_REQUESTED'
      | 'EXEMPT'
      | 'NOT_A_MEMBER'
      | 'PAYMENT_NOT_FOUND'
      | 'NOT_PENDING',
  ) {
    super(code)
  }
}

type Tx = Prisma.TransactionClient

async function lockGroup(tx: Tx, groupId: string) {
  const locked = await tx.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "Group" WHERE "id" = ${groupId} FOR UPDATE`
  if (locked.length === 0) throw new FundError('GROUP_NOT_FOUND')
  return tx.group.findUniqueOrThrow({
    where: { id: groupId },
    select: {
      fundEnabled: true,
      fundAmount: true,
      fundStartMonth: true,
      fundMemberAmounts: { select: { participantId: true, amount: true } },
    },
  })
}

async function memberOf(tx: Tx, groupId: string, participantId: string) {
  const participant = await tx.participant.findFirst({
    where: { id: participantId, groupId, userId: { not: null } },
    select: { id: true },
  })
  if (!participant) throw new FundError('NOT_A_MEMBER')
  return participant
}

async function isRestMonth(tx: Tx, groupId: string, month: string) {
  return (
    (await tx.fundRestMonth.findUnique({
      where: { groupId_month: { groupId, month } },
    })) !== null
  )
}

function amountFor(
  group: Awaited<ReturnType<typeof lockGroup>>,
  participantId: string,
) {
  return expectedAmount(
    group.fundAmount,
    group.fundMemberAmounts.find((m) => m.participantId === participantId)
      ?.amount,
  )
}

export async function getFundOverview(
  groupId: string,
  requestedMonth: string | undefined,
  now = new Date(),
) {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: {
      fundEnabled: true,
      fundAmount: true,
      fundDueDay: true,
      fundStartMonth: true,
      fundOpeningBalance: true,
      participants: {
        where: { userId: { not: null } },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      },
      fundMemberAmounts: {
        select: { participantId: true, amount: true, reason: true },
      },
      fundRestMonths: { select: { month: true }, orderBy: { month: 'asc' } },
      fundPayments: {
        select: {
          id: true,
          participantId: true,
          month: true,
          amount: true,
          status: true,
          note: true,
          createdAt: true,
          respondedAt: true,
        },
      },
    },
  })
  if (!group) throw new FundError('GROUP_NOT_FOUND')

  const fundExpenses = await prisma.expense.findMany({
    where: { groupId, paymentSource: 'FUND' },
    select: {
      id: true,
      title: true,
      amount: true,
      expenseDate: true,
      paidBy: { select: { name: true } },
    },
    orderBy: [{ expenseDate: 'desc' }, { createdAt: 'desc' }],
  })

  const currentMonth = monthOf(now)
  const start = group.fundStartMonth ?? currentMonth
  const months = monthsBetween(
    start,
    currentMonth > start ? currentMonth : start,
  ).reverse()
  const month =
    requestedMonth && months.includes(requestedMonth)
      ? requestedMonth
      : months[0]
  const restMonths = new Set(group.fundRestMonths.map((r) => r.month))
  const rest = restMonths.has(month)
  const confirmed = group.fundPayments.filter((p) => p.status === 'CONFIRMED')
  const expenseMonth = (e: { expenseDate: Date }) =>
    monthOfDateOnly(e.expenseDate)

  const rows = group.participants.map((participant) => {
    const payment =
      group.fundPayments.find(
        (p) => p.participantId === participant.id && p.month === month,
      ) ?? null
    const memberAmount = group.fundMemberAmounts.find(
      (m) => m.participantId === participant.id,
    )
    return {
      participantId: participant.id,
      name: participant.name,
      expected: expectedAmount(group.fundAmount, memberAmount?.amount),
      memberAmountReason: memberAmount?.reason ?? null,
      state: paymentState(payment, rest),
      payment: payment && {
        id: payment.id,
        amount: payment.amount,
        status: payment.status,
        note: payment.note,
      },
    }
  })

  const sum = (values: number[]) => values.reduce((a, b) => a + b, 0)
  const monthPayments = confirmed.filter((p) => p.month === month)
  const monthExpenses = fundExpenses.filter((e) => expenseMonth(e) === month)
  const nameOf = (id: string) =>
    group.participants.find((p) => p.id === id)?.name ?? ''

  return {
    settings: {
      enabled: group.fundEnabled,
      amount: group.fundAmount,
      dueDay: group.fundDueDay,
      startMonth: group.fundStartMonth,
      openingBalance: group.fundOpeningBalance,
      memberAmounts: group.fundMemberAmounts,
      restMonths: [...restMonths],
    },
    currentMonth,
    months,
    month,
    isRestMonth: rest,
    rows,
    totals: {
      balance: fundBalance({
        openingBalance: group.fundOpeningBalance,
        confirmedPayments: confirmed.map((p) => p.amount),
        fundExpenses: fundExpenses.map((e) => e.amount),
      }),
      monthCollected: sum(monthPayments.map((p) => p.amount)),
      monthPaidCount: monthPayments.length,
      monthSpent: sum(monthExpenses.map((e) => e.amount)),
      monthSpentCount: monthExpenses.length,
      cumulativeCollected: sum(
        confirmed.filter((p) => p.month <= month).map((p) => p.amount),
      ),
      cumulativeSpent: sum(
        fundExpenses
          .filter((e) => expenseMonth(e) <= month)
          .map((e) => e.amount),
      ),
    },
    history: [
      ...monthPayments.map((p) => ({
        kind: 'payment' as const,
        id: p.id,
        date: p.respondedAt ?? p.createdAt,
        title: nameOf(p.participantId),
        who: nameOf(p.participantId),
        amount: p.amount,
      })),
      ...monthExpenses.map((e) => ({
        kind: 'expense' as const,
        id: e.id,
        date: e.expenseDate,
        title: e.title,
        who: e.paidBy.name,
        amount: e.amount,
      })),
    ].sort((a, b) => b.date.getTime() - a.date.getTime()),
  }
}

export type FundSettingsInput = {
  enabled: boolean
  amount: number
  dueDay: number
  startMonth: string
  openingBalance: number
  restMonths: string[]
  memberAmounts: { participantId: string; amount: number; reason?: string }[]
}

/** Replaces the fund settings (admins only, checked by the caller). */
export async function updateFundSettings(
  groupId: string,
  input: FundSettingsInput,
) {
  if (!isMonth(input.startMonth) || !input.restMonths.every(isMonth))
    throw new FundError('INVALID_MONTH')
  await prisma.$transaction(async (tx) => {
    await lockGroup(tx, groupId)
    for (const { participantId } of input.memberAmounts)
      await memberOf(tx, groupId, participantId)

    await tx.group.update({
      where: { id: groupId },
      data: {
        fundEnabled: input.enabled,
        fundAmount: input.amount,
        fundDueDay: input.dueDay,
        fundStartMonth: input.startMonth,
        fundOpeningBalance: input.openingBalance,
      },
    })
    await tx.fundRestMonth.deleteMany({ where: { groupId } })
    if (input.restMonths.length > 0)
      await tx.fundRestMonth.createMany({
        data: [...new Set(input.restMonths)].map((month) => ({
          id: randomId(),
          groupId,
          month,
        })),
      })
    await tx.fundMemberAmount.deleteMany({ where: { groupId } })
    if (input.memberAmounts.length > 0)
      await tx.fundMemberAmount.createMany({
        data: input.memberAmounts.map((m) => ({
          id: randomId(),
          groupId,
          participantId: m.participantId,
          amount: m.amount,
          reason: m.reason?.trim() || null,
        })),
      })
  })
}

/** A member says they paid their own fee for a month. */
export async function requestFundPayment({
  groupId,
  participantId,
  userId,
  month,
  now = new Date(),
}: {
  groupId: string
  participantId: string
  userId: string
  month: string
  now?: Date
}) {
  await prisma.$transaction(async (tx) => {
    const group = await lockGroup(tx, groupId)
    const existing = await tx.fundPayment.findUnique({
      where: { participantId_month: { participantId, month } },
    })
    const error = checkPaymentRequest({
      fundEnabled: group.fundEnabled,
      startMonth: group.fundStartMonth,
      currentMonth: monthOf(now),
      month,
      isRestMonth: isMonth(month) && (await isRestMonth(tx, groupId, month)),
      existing,
    })
    if (error) throw new FundError(error)
    const data = {
      amount: amountFor(group, participantId),
      status: 'PENDING' as const,
      note: null,
      requestedByUserId: userId,
      respondedByUserId: null,
      respondedAt: null,
    }
    await tx.fundPayment.upsert({
      where: { participantId_month: { participantId, month } },
      create: { id: randomId(), groupId, participantId, month, ...data },
      update: data,
    })
  })
}

/** A member withdraws their own request that nobody confirmed yet. */
export async function cancelFundPayment(
  groupId: string,
  participantId: string,
  month: string,
) {
  const { count } = await prisma.fundPayment.deleteMany({
    where: { groupId, participantId, month, status: 'PENDING' },
  })
  if (count === 0) throw new FundError('NOT_PENDING')
}

/** An admin confirms or rejects a member's request. */
export async function respondFundPayment({
  groupId,
  userId,
  paymentId,
  accept,
}: {
  groupId: string
  userId: string
  paymentId: string
  accept: boolean
}) {
  await prisma.$transaction(async (tx) => {
    await lockGroup(tx, groupId)
    const payment = await tx.fundPayment.findFirst({
      where: { id: paymentId, groupId },
    })
    if (!payment) throw new FundError('PAYMENT_NOT_FOUND')
    if (payment.status !== 'PENDING') throw new FundError('NOT_PENDING')
    await tx.fundPayment.update({
      where: { id: payment.id },
      data: {
        status: accept ? 'CONFIRMED' : 'REJECTED',
        respondedByUserId: userId,
        respondedAt: new Date(),
      },
    })
  })
}

/**
 * An admin records a member's fee as paid (e.g. handed over in cash), or
 * exempts them for the month, or lifts an exemption.
 */
export async function setFundPaymentByAdmin({
  groupId,
  userId,
  participantId,
  month,
  action,
  note,
}: {
  groupId: string
  userId: string
  participantId: string
  month: string
  action: 'PAID' | 'EXEMPT' | 'CLEAR_EXEMPT'
  note?: string
}) {
  if (!isMonth(month)) throw new FundError('INVALID_MONTH')
  await prisma.$transaction(async (tx) => {
    const group = await lockGroup(tx, groupId)
    if (!group.fundEnabled || !group.fundStartMonth)
      throw new FundError('FUND_DISABLED')
    if (month < group.fundStartMonth) throw new FundError('INVALID_MONTH')
    await memberOf(tx, groupId, participantId)
    if (await isRestMonth(tx, groupId, month)) throw new FundError('REST_MONTH')
    const existing = await tx.fundPayment.findUnique({
      where: { participantId_month: { participantId, month } },
    })

    if (action === 'CLEAR_EXEMPT') {
      if (existing?.status !== 'EXEMPT') return
      await tx.fundPayment.delete({ where: { id: existing.id } })
      return
    }
    if (existing?.status === 'CONFIRMED') throw new FundError('ALREADY_PAID')
    const data = {
      amount: action === 'PAID' ? amountFor(group, participantId) : 0,
      status: action === 'PAID' ? ('CONFIRMED' as const) : ('EXEMPT' as const),
      note: action === 'EXEMPT' ? note?.trim() || null : null,
      respondedByUserId: userId,
      respondedAt: new Date(),
    }
    await tx.fundPayment.upsert({
      where: { participantId_month: { participantId, month } },
      create: { id: randomId(), groupId, participantId, month, ...data },
      update: data,
    })
  })
}

/** Whether expenses may be paid from the group's fund. */
export async function isFundEnabled(groupId: string) {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { fundEnabled: true },
  })
  return group?.fundEnabled === true
}
