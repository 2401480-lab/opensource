/**
 * Rules of the settle-up flow, kept free of the database so they can be unit
 * tested. The service (src/lib/settlements.ts) applies them inside a
 * transaction.
 *
 *   (no request) --request by sender--> PENDING
 *   PENDING --confirm by recipient--> CONFIRMED   (creates the transfer record)
 *   PENDING --reject by recipient---> REJECTED
 *   PENDING --cancel by sender------> CANCELED
 *
 * CONFIRMED, REJECTED and CANCELED are final. Asking for confirmation and
 * confirming are never the same step, and nobody acts on someone else's side.
 */

export type SettlementStatus = 'PENDING' | 'CONFIRMED' | 'REJECTED' | 'CANCELED'
export type SettlementAction = 'confirm' | 'reject' | 'cancel'

export type SettlementRuleError =
  | 'NOT_SENDER'
  | 'NOT_RECIPIENT'
  | 'NOT_PENDING'
  | 'SELF_TRANSFER'
  | 'INVALID_AMOUNT'
  | 'NOTHING_TO_SETTLE'
  | 'AMOUNT_TOO_HIGH'
  | 'ALREADY_PENDING'

const nextStatus: Record<SettlementAction, SettlementStatus> = {
  confirm: 'CONFIRMED',
  reject: 'REJECTED',
  cancel: 'CANCELED',
}

/**
 * Whether `actorParticipantId` may apply `action` to the settlement. Returns
 * the new status, or the reason it is refused.
 */
export function checkTransition(
  settlement: {
    status: SettlementStatus
    fromParticipantId: string
    toParticipantId: string
  },
  action: SettlementAction,
  actorParticipantId: string,
):
  | { ok: true; status: SettlementStatus }
  | { ok: false; error: SettlementRuleError } {
  if (settlement.status !== 'PENDING')
    return { ok: false, error: 'NOT_PENDING' }
  if (
    action === 'cancel' &&
    actorParticipantId !== settlement.fromParticipantId
  )
    return { ok: false, error: 'NOT_SENDER' }
  if (
    (action === 'confirm' || action === 'reject') &&
    actorParticipantId !== settlement.toParticipantId
  )
    return { ok: false, error: 'NOT_RECIPIENT' }
  return { ok: true, status: nextStatus[action] }
}

/**
 * Whether a member may say they sent `amount` to `toParticipantId`.
 *
 * The amount is what the suggested settlement says they owe that person at
 * most: sending part of it is fine (the rest stays suggested afterwards), more
 * is refused, as is a second request while one is still pending.
 */
export function checkRequest({
  fromParticipantId,
  toParticipantId,
  amount,
  suggestedAmount,
  hasPendingRequest,
}: {
  fromParticipantId: string
  toParticipantId: string
  amount: number
  /** What the suggested reimbursements say `from` owes `to` (0 if nothing). */
  suggestedAmount: number
  hasPendingRequest: boolean
}): { ok: true } | { ok: false; error: SettlementRuleError } {
  if (fromParticipantId === toParticipantId)
    return { ok: false, error: 'SELF_TRANSFER' }
  if (!Number.isInteger(amount) || amount <= 0)
    return { ok: false, error: 'INVALID_AMOUNT' }
  if (hasPendingRequest) return { ok: false, error: 'ALREADY_PENDING' }
  if (suggestedAmount <= 0) return { ok: false, error: 'NOTHING_TO_SETTLE' }
  if (amount > suggestedAmount) return { ok: false, error: 'AMOUNT_TOO_HIGH' }
  return { ok: true }
}

/**
 * Status of a suggested transfer as shown to users: "not settled" until the
 * sender asks, then "waiting for confirmation". (Once confirmed, the balances
 * change and the suggestion disappears or shrinks.)
 */
export function suggestionStatus(
  pending: { fromParticipantId: string; toParticipantId: string }[],
  from: string,
  to: string,
): 'UNSETTLED' | 'PENDING' {
  return pending.some(
    (s) => s.fromParticipantId === from && s.toParticipantId === to,
  )
    ? 'PENDING'
    : 'UNSETTLED'
}
