import { getBalances } from './balances'
import { getMyLedger, LedgerExpense } from './my-ledger'

let n = 0
function expense(
  paidBy: string,
  amount: number,
  paidFor: string[],
  options: { title?: string; day?: number; isReimbursement?: boolean } = {},
): LedgerExpense {
  n += 1
  return {
    id: `e${n}`,
    title: options.title ?? `expense ${n}`,
    amount,
    expenseDate: new Date(Date.UTC(2026, 10, options.day ?? 1)),
    isReimbursement: options.isReimbursement ?? false,
    paymentSource: 'PERSONAL',
    splitMode: 'EVENLY',
    paidBy: { id: paidBy },
    paidFor: paidFor.map((id) => ({ participant: { id }, shares: 100 })),
  }
}

const all8 = ['me', 'minseo', 'b', 'c', 'd', 'e', 'f', 'g']

describe('getMyLedger', () => {
  it('nets what I owe someone against what they owe me', () => {
    const ledger = getMyLedger(
      [
        expense('minseo', 96000, all8, { title: 'lunch', day: 22 }),
        expense('me', 28000, all8, { title: 'snacks', day: 18 }),
      ],
      'me',
    )
    const minseo = ledger.people.find((p) => p.participantId === 'minseo')!
    // I owe 12,000 for lunch, Minseo owes me 3,500 for snacks.
    expect(minseo.net).toBe(-8500)
    expect(minseo.expenses.map((i) => [i.title, i.effect])).toEqual([
      ['lunch', -12000],
      ['snacks', 3500],
    ])
    expect(minseo.expenses[0]).toMatchObject({
      myShare: 12000,
      theirShare: 12000,
      splitCount: 8,
    })
  })

  it('keeps transfers apart and counts them towards the person', () => {
    const ledger = getMyLedger(
      [
        expense('me', 60000, ['me', 'hangyeol', 'seoyoung'], { title: 'taxi' }),
        // Seoyoung paid me back her share.
        expense('seoyoung', 20000, ['me'], { isReimbursement: true }),
      ],
      'me',
    )
    const seoyoung = ledger.people.find((p) => p.participantId === 'seoyoung')!
    const hangyeol = ledger.people.find((p) => p.participantId === 'hangyeol')!
    expect(seoyoung.net).toBe(0)
    expect(seoyoung.expenses).toHaveLength(1)
    expect(seoyoung.transfers.map((t) => t.effect)).toEqual([-20000])
    expect(hangyeol.net).toBe(20000)
    expect(ledger).toMatchObject({
      paid: 60000,
      share: 20000,
      sent: 0,
      received: 20000,
      net: 20000,
    })
  })

  it('adds up to the same net balance as the group balances', () => {
    const expenses = [
      expense('me', 28000, all8),
      expense('minseo', 96000, all8),
      expense('b', 10001, ['me', 'b', 'c']),
      expense('me', 5000, ['c', 'd']),
      expense('c', 3000, ['me'], { isReimbursement: true }),
      expense('me', 7000, ['b'], { isReimbursement: true }),
      expense('d', 4000, ['y', 'z']),
    ]
    const ledger = getMyLedger(expenses, 'me')
    const balances = getBalances(expenses as never)
    expect(ledger.net).toBe(balances.me.total)
    expect(ledger.people.reduce((sum, p) => sum + p.net, 0)).toBe(ledger.net)
    // Someone with no expense in common with me is not listed.
    expect(ledger.people.find((p) => p.participantId === 'z')).toBeUndefined()
  })
})
