import { SplitMode } from '@/generated/prisma/browser'
import { getExpenseShares } from '@/lib/shares'

/**
 * "내 정산 상세": why the signed-in member has to send or receive money.
 *
 * For every other participant it lists the expenses and transfers between the
 * two of them, and what each one adds to what that person owes the member
 * (positive) or the member owes them (negative). Adding those up per person
 * gives the pairwise amount; adding every person's amount gives the member's
 * net balance, the same total the suggested reimbursements settle.
 */

export type LedgerExpense = {
  id: string
  title: string
  amount: number
  expenseDate: Date
  isReimbursement: boolean
  paymentSource: 'PERSONAL' | 'FUND'
  splitMode: SplitMode
  paidBy: { id: string }
  paidFor: { participant: { id: string }; shares: number }[]
}

export type LedgerItem = {
  expenseId: string
  title: string
  date: Date
  /** Who paid the expense (or who sent the transfer). */
  paidById: string
  /** Full amount of the expense. */
  amount: number
  /** The member's share of the expense (0 for transfers). */
  myShare: number
  /** The other person's share of the expense (0 for transfers). */
  theirShare: number
  /** Number of people the expense is split between. */
  splitCount: number
  /** + the other person owes the member more, − the member owes them more. */
  effect: number
}

export type LedgerPerson = {
  participantId: string
  /** + they owe the member, − the member owes them, before simplification. */
  net: number
  expenses: LedgerItem[]
  /** Transfers already made between the two (confirmed settlements). */
  transfers: LedgerItem[]
}

export type MyLedger = {
  /** Paid for shared expenses. */
  paid: number
  /** Own share of shared expenses. */
  share: number
  /** Transfers sent to other members. */
  sent: number
  /** Transfers received from other members. */
  received: number
  /** paid − share + sent − received. */
  net: number
  people: LedgerPerson[]
}

export function getMyLedger(expenses: LedgerExpense[], meId: string): MyLedger {
  const people = new Map<string, LedgerPerson>()
  const personOf = (id: string) => {
    let person = people.get(id)
    if (!person) {
      person = { participantId: id, net: 0, expenses: [], transfers: [] }
      people.set(id, person)
    }
    return person
  }
  const totals = { paid: 0, share: 0, sent: 0, received: 0 }

  for (const expense of expenses) {
    // Paid from the shared fund: not part of anyone's balance.
    if (expense.paymentSource === 'FUND') continue
    const shares = getExpenseShares({
      id: expense.id,
      amount: expense.amount,
      splitMode: expense.splitMode,
      paidFor: expense.paidFor.map(({ participant, shares }) => ({
        participantId: participant.id,
        shares,
      })),
    })
    const payer = expense.paidBy.id
    const myShare = shares.get(meId) ?? 0
    const splitCount = [...shares.values()].filter((s) => s !== 0).length

    if (payer === meId) {
      if (expense.isReimbursement) totals.sent += expense.amount
      else {
        totals.paid += expense.amount
        totals.share += myShare
      }
    } else {
      if (expense.isReimbursement) totals.received += myShare
      else totals.share += myShare
    }

    const add = (otherId: string, theirShare: number, effect: number) => {
      if (effect === 0) return
      const person = personOf(otherId)
      person.net += effect
      const item: LedgerItem = {
        expenseId: expense.id,
        title: expense.title,
        date: expense.expenseDate,
        paidById: payer,
        amount: expense.amount,
        myShare: expense.isReimbursement ? 0 : myShare,
        theirShare: expense.isReimbursement ? 0 : theirShare,
        splitCount,
        effect,
      }
      if (expense.isReimbursement) person.transfers.push(item)
      else person.expenses.push(item)
    }

    if (payer === meId) {
      // Everyone else's share of what I paid is owed to me.
      shares.forEach((share, participantId) => {
        if (participantId !== meId) add(participantId, share, share)
      })
    } else {
      // My share of what someone else paid is owed to them.
      add(payer, shares.get(payer) ?? 0, -myShare)
    }
  }

  const byDateDesc = (a: LedgerItem, b: LedgerItem) =>
    b.date.getTime() - a.date.getTime()
  const list = [...people.values()]
  for (const person of list) {
    person.expenses.sort(byDateDesc)
    person.transfers.sort(byDateDesc)
  }
  list.sort((a, b) => Math.abs(b.net) - Math.abs(a.net))

  return {
    ...totals,
    net: totals.paid - totals.share + totals.sent - totals.received,
    people: list,
  }
}
