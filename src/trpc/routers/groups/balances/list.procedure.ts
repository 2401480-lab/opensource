import { getGroupExpenses } from '@/lib/api'
import {
  getBalances,
  getPublicBalances,
  getSuggestedReimbursements,
} from '@/lib/balances'
import { groupProcedure } from '@/trpc/init'

export const listGroupBalancesProcedure = groupProcedure.query(
  async ({ input: { groupId } }) => {
    const expenses = await getGroupExpenses(groupId)
    const balances = getBalances(expenses)
    const reimbursements = getSuggestedReimbursements(balances)
    const publicBalances = getPublicBalances(reimbursements)

    // How each net amount comes about, so the page can explain it:
    // paid for shared expenses - own share of them + transfers sent - received.
    const spending = getBalances(expenses.filter((e) => !e.isReimbursement))
    const transfers = getBalances(expenses.filter((e) => e.isReimbursement))
    const breakdown = Object.fromEntries(
      Object.keys(balances).map((participantId) => [
        participantId,
        {
          paid: spending[participantId]?.paid ?? 0,
          share: spending[participantId]?.paidFor ?? 0,
          sent: transfers[participantId]?.paid ?? 0,
          received: transfers[participantId]?.paidFor ?? 0,
        },
      ]),
    )

    return { balances: publicBalances, reimbursements, breakdown }
  },
)
