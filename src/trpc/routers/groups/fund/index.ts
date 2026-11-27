import {
  cancelFundPayment,
  FundError,
  getFundOverview,
  requestFundPayment,
  respondFundPayment,
  setFundPaymentByAdmin,
  updateFundSettings,
} from '@/lib/fund'
import {
  createTRPCRouter,
  groupOwnerProcedure,
  groupProcedure,
} from '@/trpc/init'
import { TRPCError } from '@trpc/server'
import { z } from 'zod'

const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/)
const money = z.number().int().min(0).max(10_000_000_00)

function toTRPCError(error: unknown): never {
  if (error instanceof FundError) {
    const code = (
      {
        GROUP_NOT_FOUND: 'NOT_FOUND',
        PAYMENT_NOT_FOUND: 'NOT_FOUND',
        FUND_DISABLED: 'BAD_REQUEST',
        INVALID_MONTH: 'BAD_REQUEST',
        REST_MONTH: 'BAD_REQUEST',
        NOT_A_MEMBER: 'BAD_REQUEST',
        ALREADY_PAID: 'CONFLICT',
        ALREADY_REQUESTED: 'CONFLICT',
        EXEMPT: 'CONFLICT',
        NOT_PENDING: 'CONFLICT',
      } as const
    )[error.code]
    throw new TRPCError({ code, message: error.code })
  }
  throw error
}

async function run<T>(fn: () => Promise<T>) {
  try {
    return await fn()
  } catch (error) {
    toTRPCError(error)
  }
}

/** 회비: any member reads it and reports their own fee; admins manage it. */
export const groupFundRouter = createTRPCRouter({
  get: groupProcedure
    .input(z.object({ month: month.optional() }))
    .query(({ input }) =>
      run(() => getFundOverview(input.groupId, input.month)),
    ),

  /** "회비 냈어요": always for the caller's own participant. */
  requestPayment: groupProcedure
    .input(z.object({ month }))
    .mutation(({ ctx, input }) =>
      run(() =>
        requestFundPayment({
          groupId: input.groupId,
          participantId: ctx.membership.participantId,
          userId: ctx.user.id,
          month: input.month,
        }),
      ),
    ),

  cancelRequest: groupProcedure
    .input(z.object({ month }))
    .mutation(({ ctx, input }) =>
      run(() =>
        cancelFundPayment(
          input.groupId,
          ctx.membership.participantId,
          input.month,
        ),
      ),
    ),

  respond: groupOwnerProcedure
    .input(
      z.object({ paymentId: z.string().min(1).max(64), accept: z.boolean() }),
    )
    .mutation(({ ctx, input }) =>
      run(() =>
        respondFundPayment({
          groupId: input.groupId,
          userId: ctx.user.id,
          paymentId: input.paymentId,
          accept: input.accept,
        }),
      ),
    ),

  setByAdmin: groupOwnerProcedure
    .input(
      z.object({
        participantId: z.string().min(1).max(64),
        month,
        action: z.enum(['PAID', 'EXEMPT', 'CLEAR_EXEMPT']),
        note: z.string().max(200).optional(),
      }),
    )
    .mutation(({ ctx, input }) =>
      run(() =>
        setFundPaymentByAdmin({
          groupId: input.groupId,
          userId: ctx.user.id,
          participantId: input.participantId,
          month: input.month,
          action: input.action,
          note: input.note,
        }),
      ),
    ),

  updateSettings: groupOwnerProcedure
    .input(
      z.object({
        enabled: z.boolean(),
        amount: money,
        dueDay: z.number().int().min(1).max(28),
        startMonth: month,
        openingBalance: z.number().int().min(-10_000_000_00).max(10_000_000_00),
        restMonths: z.array(month).max(120),
        memberAmounts: z
          .array(
            z.object({
              participantId: z.string().min(1).max(64),
              amount: money,
              reason: z.string().max(100).optional(),
            }),
          )
          .max(100),
      }),
    )
    .mutation(({ input: { groupId, ...settings } }) =>
      run(() => updateFundSettings(groupId, settings)),
    ),
})
