import { Prisma } from '@/generated/prisma/client'
import { getCurrentUser } from '@/lib/auth'
import { getMembership } from '@/lib/membership'
import { initTRPC, TRPCError } from '@trpc/server'
import { cache } from 'react'
import superjson from 'superjson'
import { z } from 'zod'

superjson.registerCustom<Prisma.Decimal, string>(
  {
    isApplicable: (v): v is Prisma.Decimal => Prisma.Decimal.isDecimal(v),
    serialize: (v) => v.toJSON(),
    deserialize: (v) => new Prisma.Decimal(v),
  },
  'decimal.js',
)

export const createTRPCContext = cache(async () => {
  /**
   * @see: https://trpc.io/docs/server/context
   */
  // Resolved from the session cookie and checked against the session table.
  return { user: await getCurrentUser() }
})

// Avoid exporting the entire t-object
// since it's not very descriptive.
// For instance, the use of a t variable
// is common in i18n libraries.
const t = initTRPC.context<typeof createTRPCContext>().create({
  /**
   * @see https://trpc.io/docs/server/data-transformers
   */
  transformer: superjson,
})

// Base router and procedure helpers
export const createTRPCRouter = t.router
/** No authentication. Only for the few endpoints that must stay public. */
export const baseProcedure = t.procedure

/** Requires a signed-in user (`ctx.user`). */
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' })
  return next({ ctx: { user: ctx.user } })
})

/**
 * Requires the signed-in user to be a member of `input.groupId`. Adds
 * `ctx.membership` (the user's participant in that group) and `ctx.actor`
 * (for the activity log), so procedures never trust a participant id sent by
 * the client.
 */
export const groupProcedure = protectedProcedure
  .input(z.object({ groupId: z.string().min(1).max(64) }))
  .use(async ({ ctx, input, next }) => {
    const membership = await getMembership(input.groupId, ctx.user.id)
    if (!membership) throw new TRPCError({ code: 'FORBIDDEN' })
    return next({
      ctx: {
        membership,
        actor: { participantId: membership.participantId, userId: ctx.user.id },
      },
    })
  })

/** Like `groupProcedure`, restricted to the group owner. */
export const groupOwnerProcedure = groupProcedure.use(({ ctx, next }) => {
  if (ctx.membership.role !== 'OWNER')
    throw new TRPCError({ code: 'FORBIDDEN' })
  return next()
})
