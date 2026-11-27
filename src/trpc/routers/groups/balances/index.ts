import { createTRPCRouter } from '@/trpc/init'
import { listGroupBalancesProcedure } from '@/trpc/routers/groups/balances/list.procedure'
import { myGroupBalanceProcedure } from '@/trpc/routers/groups/balances/mine.procedure'

export const groupBalancesRouter = createTRPCRouter({
  list: listGroupBalancesProcedure,
  mine: myGroupBalanceProcedure,
})
