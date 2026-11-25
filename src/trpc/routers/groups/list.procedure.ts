import { listMyGroups } from '@/lib/membership'
import { protectedProcedure } from '@/trpc/init'

/** The groups the signed-in user is a member of, with their own status. */
export const listGroupsProcedure = protectedProcedure.query(async ({ ctx }) => {
  const groups = await listMyGroups(ctx.user.id)
  return { groups }
})
