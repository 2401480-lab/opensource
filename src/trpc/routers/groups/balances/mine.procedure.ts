import { getGroupExpenses } from '@/lib/api'
import { getBalances, getSuggestedReimbursements } from '@/lib/balances'
import { getMyLedger } from '@/lib/my-ledger'
import { groupProcedure } from '@/trpc/init'

/**
 * The signed-in member's settlement detail: per person, the expenses and
 * transfers behind what they owe or are owed, plus the suggested transfers
 * that involve them. Always computed for the caller's own participant.
 */
export const myGroupBalanceProcedure = groupProcedure.query(
  async ({ ctx, input: { groupId } }) => {
    const me = ctx.membership.participantId
    const expenses = await getGroupExpenses(groupId)
    const reimbursements = getSuggestedReimbursements(getBalances(expenses))
    return {
      participantId: me,
      ledger: getMyLedger(expenses, me),
      toSend: reimbursements.filter((r) => r.from === me),
      toReceive: reimbursements.filter((r) => r.to === me),
    }
  },
)
