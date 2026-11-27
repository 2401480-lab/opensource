import {
  addMonths,
  checkPaymentRequest,
  expectedAmount,
  fundBalance,
  isMonth,
  monthOf,
  monthsBetween,
  paymentState,
} from './fund-rules'

describe('months', () => {
  it('uses Korean time for the current month', () => {
    // 2026-11-30 16:00 UTC is already December 1st in Seoul.
    expect(monthOf(new Date('2026-11-30T16:00:00Z'))).toBe('2026-12')
    expect(monthOf(new Date('2026-11-30T14:00:00Z'))).toBe('2026-11')
  })

  it('adds months across years', () => {
    expect(addMonths('2026-11', 2)).toBe('2027-01')
    expect(addMonths('2026-01', -1)).toBe('2025-12')
  })

  it('lists months between two months', () => {
    expect(monthsBetween('2026-10', '2027-01')).toEqual([
      '2026-10',
      '2026-11',
      '2026-12',
      '2027-01',
    ])
    expect(monthsBetween('2026-12', '2026-11')).toEqual([])
  })

  it('validates month strings', () => {
    expect(isMonth('2026-11')).toBe(true)
    expect(isMonth('2026-13')).toBe(false)
    expect(isMonth('26-11')).toBe(false)
  })
})

describe('paymentState', () => {
  it('reports a month off before anything else', () => {
    expect(paymentState({ status: 'CONFIRMED' }, true)).toBe('REST')
  })
  it('maps payment statuses', () => {
    expect(paymentState(null, false)).toBe('UNPAID')
    expect(paymentState({ status: 'REJECTED' }, false)).toBe('UNPAID')
    expect(paymentState({ status: 'PENDING' }, false)).toBe('PENDING')
    expect(paymentState({ status: 'CONFIRMED' }, false)).toBe('PAID')
    expect(paymentState({ status: 'EXEMPT' }, false)).toBe('EXEMPT')
  })
})

describe('expectedAmount', () => {
  it('uses the member amount when there is one', () => {
    expect(expectedAmount(20000, undefined)).toBe(20000)
    expect(expectedAmount(20000, 10000)).toBe(10000)
    expect(expectedAmount(20000, 0)).toBe(0)
  })
})

describe('checkPaymentRequest', () => {
  const base = {
    fundEnabled: true,
    startMonth: '2026-09',
    currentMonth: '2026-11',
    month: '2026-11',
    isRestMonth: false,
    existing: null,
  }

  it('accepts a regular request', () => {
    expect(checkPaymentRequest(base)).toBeNull()
    // Paying next month ahead is fine.
    expect(checkPaymentRequest({ ...base, month: '2026-12' })).toBeNull()
    // So is asking again after an admin said it did not arrive.
    expect(
      checkPaymentRequest({ ...base, existing: { status: 'REJECTED' } }),
    ).toBeNull()
  })

  it('refuses when the fund is off or not set up', () => {
    expect(checkPaymentRequest({ ...base, fundEnabled: false })).toBe(
      'FUND_DISABLED',
    )
    expect(checkPaymentRequest({ ...base, startMonth: null })).toBe(
      'FUND_DISABLED',
    )
  })

  it('refuses months outside the fund period', () => {
    expect(checkPaymentRequest({ ...base, month: '2026-08' })).toBe(
      'INVALID_MONTH',
    )
    expect(checkPaymentRequest({ ...base, month: '2027-01' })).toBe(
      'INVALID_MONTH',
    )
    expect(checkPaymentRequest({ ...base, month: 'november' })).toBe(
      'INVALID_MONTH',
    )
  })

  it('refuses months off, and months already handled', () => {
    expect(checkPaymentRequest({ ...base, isRestMonth: true })).toBe(
      'REST_MONTH',
    )
    expect(
      checkPaymentRequest({ ...base, existing: { status: 'CONFIRMED' } }),
    ).toBe('ALREADY_PAID')
    expect(
      checkPaymentRequest({ ...base, existing: { status: 'PENDING' } }),
    ).toBe('ALREADY_REQUESTED')
    expect(
      checkPaymentRequest({ ...base, existing: { status: 'EXEMPT' } }),
    ).toBe('EXEMPT')
  })
})

describe('fundBalance', () => {
  it('adds confirmed fees to the starting balance and takes fund expenses', () => {
    expect(
      fundBalance({
        openingBalance: 150500,
        confirmedPayments: [160000, 140000, 110000],
        fundExpenses: [24000, 113000, 45500, 93500],
      }),
    ).toBe(284500)
  })
})
