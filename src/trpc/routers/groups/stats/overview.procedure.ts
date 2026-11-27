import {
  getActiveRecurringExpenses,
  getGroup,
  getGroupExpenses,
} from '@/lib/api'
import { fundBalance } from '@/lib/fund-rules'
import { getMonthlyCategorySpending } from '@/lib/monthly-spending'
import { prisma } from '@/lib/prisma'
import {
  filterExpensesByDateRange,
  getRecurringSpending,
  getSpendingByCategory,
  getSpendingByParticipant,
  getSpendingBySource,
  getSpendingOverTime,
  getSpendingSummary,
  getTotalActiveUserPaidFor,
  getTotalActiveUserShare,
  getTotalGroupSpending,
} from '@/lib/totals'
import { groupProcedure } from '@/trpc/init'
import { z } from 'zod'

/**
 * Single data-loader for the whole stats page. Fetches the group's expenses
 * once and derives every stats section from them, so loading the page (and
 * changing the date range) costs one request instead of one per card.
 *
 * Recurring stats are range-independent (they reflect the currently active
 * subscriptions) and come from a separate query.
 */
export const getStatsOverviewProcedure = groupProcedure
  .input(
    z.object({
      groupId: z.string().min(1),
      from: z.string().optional(),
      to: z.string().optional(),
    }),
  )
  .query(async ({ ctx, input: { groupId, from, to } }) => {
    // getGroupExpenses and getActiveRecurringExpenses both materialize due
    // recurring frames; run them sequentially so the two passes don't race
    // each other (the second is a no-op once the first has materialized).
    const [group, allExpenses] = await Promise.all([
      getGroup(groupId),
      getGroupExpenses(groupId),
    ])
    const recurringExpenses = await getActiveRecurringExpenses(groupId)

    // "Your" totals are the signed-in member's, resolved on the server.
    const participantId: string | undefined = ctx.membership.participantId
    const expenses = filterExpensesByDateRange(allExpenses, from, to)
    const participants = group?.participants ?? []

    // The shared fund (회비), for groups that use one: fees collected in the
    // period (by fee month) and the account balance today.
    let fund = null
    if (group?.fundEnabled) {
      const confirmed = await prisma.fundPayment.findMany({
        where: { groupId, status: 'CONFIRMED' },
        select: { month: true, amount: true },
      })
      const fromMonth = from?.slice(0, 7)
      const toMonth = to?.slice(0, 7)
      const inRange = confirmed.filter(
        (p) =>
          (!fromMonth || p.month >= fromMonth) &&
          (!toMonth || p.month <= toMonth),
      )
      fund = {
        collected: inRange.reduce((sum, p) => sum + p.amount, 0),
        collectedCount: inRange.length,
        balance: fundBalance({
          openingBalance: group.fundOpeningBalance,
          confirmedPayments: confirmed.map((p) => p.amount),
          fundExpenses: allExpenses
            .filter((e) => e.paymentSource === 'FUND' && !e.isReimbursement)
            .map((e) => e.amount),
        }),
      }
    }

    return {
      bySource: getSpendingBySource(expenses),
      fund,
      totalGroupSpendings: getTotalGroupSpending(expenses),
      totalParticipantSpendings:
        participantId !== undefined
          ? getTotalActiveUserPaidFor(participantId, expenses)
          : undefined,
      totalParticipantShare:
        participantId !== undefined
          ? getTotalActiveUserShare(participantId, expenses)
          : undefined,
      summary: getSpendingSummary(expenses),
      months: getSpendingOverTime(expenses),
      monthlyCategorySpending: getMonthlyCategorySpending(expenses, {
        grouping: 'category',
        from,
        to,
      }),
      participants: getSpendingByParticipant(participants, expenses),
      categories: getSpendingByCategory(expenses),
      recurring: getRecurringSpending(recurringExpenses),
    }
  })
