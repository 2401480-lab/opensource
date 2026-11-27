import { isFundEnabled } from '@/lib/fund'
import { Membership } from '@/lib/membership'
import { TRPCError } from '@trpc/server'

/**
 * Expenses paid from the shared fund (회비 계좌) are managed by admins only,
 * and only while the group uses a fund. `before`/`after` are the expense's
 * payment source before and after the change (undefined when it does not
 * exist on that side).
 */
export async function assertFundExpenseAllowed({
  groupId,
  membership,
  before,
  after,
}: {
  groupId: string
  membership: Membership
  before?: 'PERSONAL' | 'FUND'
  after?: 'PERSONAL' | 'FUND'
}) {
  if (before !== 'FUND' && after !== 'FUND') return
  if (membership.role !== 'OWNER')
    throw new TRPCError({ code: 'FORBIDDEN', message: 'FUND_ADMIN_ONLY' })
  if (after === 'FUND' && !(await isFundEnabled(groupId)))
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'FUND_DISABLED' })
}
