import { expenseFormSchema, groupFormSchema } from './schemas'

function byAmountExpense(amount: string, shares: string[]) {
  return {
    expenseDate: new Date('2026-09-01'),
    title: 'Dinner',
    amount,
    paidBy: 'a',
    splitMode: 'BY_AMOUNT',
    saveDefaultSplittingOptions: false,
    isReimbursement: false,
    paidFor: shares.map((shares, i) => ({ participant: `p${i}`, shares })),
  }
}

function issueMessages(input: unknown): string[] {
  const result = expenseFormSchema.safeParse(input)
  return result.success ? [] : result.error.issues.map((i) => i.message)
}

describe('expenseFormSchema, split by amount', () => {
  it('accepts amounts that add up to the expense amount', () => {
    expect(
      issueMessages(
        byAmountExpense('524.34', [
          '110.11',
          '209.74',
          '104.87',
          '89.14',
          '10.48',
        ]),
      ),
    ).toEqual([])
  })

  it('rejects amounts one cent off', () => {
    expect(
      issueMessages(
        byAmountExpense('524.34', [
          '110.11',
          '209.74',
          '104.87',
          '89.14',
          '10.49',
        ]),
      ),
    ).toEqual(['amountSum'])
  })

  it('sums amounts typed with a decimal comma', () => {
    expect(
      issueMessages(byAmountExpense('100', ['50', '30', '20,00'])),
    ).toEqual([])
  })

  it('reports an emptied amount instead of throwing on it', () => {
    expect(issueMessages(byAmountExpense('100', ['60', '']))).toEqual([
      'noZeroShares',
      'amountSum',
    ])
  })
})

describe('groupFormSchema, participant emails', () => {
  const group = (participants: { name: string; email?: string }[]) => ({
    name: 'Trip',
    currency: '$',
    currencyCode: 'USD',
    participants,
  })

  it('accepts no email or an empty one, and normalizes a given one', () => {
    const result = groupFormSchema.parse(
      group([
        { name: 'Alice' },
        { name: 'Bob', email: '' },
        { name: 'Carol', email: '  Carol@Example.COM ' },
      ]),
    )
    expect(result.participants[2].email).toBe('carol@example.com')
  })

  it('rejects an invalid email', () => {
    const result = groupFormSchema.safeParse(
      group([{ name: 'Alice' }, { name: 'Bob', email: 'not-an-email' }]),
    )
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toBe('invalidEmail')
  })

  it('rejects the same email for two participants', () => {
    const result = groupFormSchema.safeParse(
      group([
        { name: 'Alice' },
        { name: 'Bob', email: 'x@example.com' },
        { name: 'Carol', email: 'X@example.com' },
      ]),
    )
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]).toMatchObject({
      message: 'duplicateParticipantEmail',
      path: ['participants', 2, 'email'],
    })
  })
})
