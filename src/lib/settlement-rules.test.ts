import {
  checkRequest,
  checkTransition,
  suggestionStatus,
} from './settlement-rules'

const pending = {
  status: 'PENDING' as const,
  fromParticipantId: 'minsu',
  toParticipantId: 'danbi',
}

describe('checkTransition', () => {
  it('lets only the recipient confirm or reject', () => {
    expect(checkTransition(pending, 'confirm', 'danbi')).toEqual({
      ok: true,
      status: 'CONFIRMED',
    })
    expect(checkTransition(pending, 'reject', 'danbi')).toEqual({
      ok: true,
      status: 'REJECTED',
    })
    expect(checkTransition(pending, 'confirm', 'minsu')).toEqual({
      ok: false,
      error: 'NOT_RECIPIENT',
    })
    expect(checkTransition(pending, 'reject', 'jiyeon')).toEqual({
      ok: false,
      error: 'NOT_RECIPIENT',
    })
  })

  it('lets only the sender cancel', () => {
    expect(checkTransition(pending, 'cancel', 'minsu')).toEqual({
      ok: true,
      status: 'CANCELED',
    })
    expect(checkTransition(pending, 'cancel', 'danbi')).toEqual({
      ok: false,
      error: 'NOT_SENDER',
    })
  })

  it('never changes a finished settlement', () => {
    for (const status of ['CONFIRMED', 'REJECTED', 'CANCELED'] as const) {
      for (const [action, actor] of [
        ['confirm', 'danbi'],
        ['reject', 'danbi'],
        ['cancel', 'minsu'],
      ] as const) {
        expect(checkTransition({ ...pending, status }, action, actor)).toEqual({
          ok: false,
          error: 'NOT_PENDING',
        })
      }
    }
  })
})

describe('checkRequest', () => {
  const base = {
    fromParticipantId: 'minsu',
    toParticipantId: 'danbi',
    amount: 10000,
    suggestedAmount: 16667,
    hasPendingRequest: false,
  }

  it('accepts the full or a partial amount', () => {
    expect(checkRequest({ ...base, amount: 16667 })).toEqual({ ok: true })
    expect(checkRequest(base)).toEqual({ ok: true })
  })

  it('refuses more than what is owed', () => {
    expect(checkRequest({ ...base, amount: 16668 })).toEqual({
      ok: false,
      error: 'AMOUNT_TOO_HIGH',
    })
  })

  it('refuses when nothing is owed to that person', () => {
    expect(checkRequest({ ...base, suggestedAmount: 0 })).toEqual({
      ok: false,
      error: 'NOTHING_TO_SETTLE',
    })
  })

  it('refuses a second request while one is pending', () => {
    expect(checkRequest({ ...base, hasPendingRequest: true })).toEqual({
      ok: false,
      error: 'ALREADY_PENDING',
    })
  })

  it('refuses zero, negative or fractional amounts, and self transfers', () => {
    for (const amount of [0, -5, 10.5])
      expect(checkRequest({ ...base, amount })).toEqual({
        ok: false,
        error: 'INVALID_AMOUNT',
      })
    expect(checkRequest({ ...base, toParticipantId: 'minsu' })).toEqual({
      ok: false,
      error: 'SELF_TRANSFER',
    })
  })
})

describe('suggestionStatus', () => {
  it('is pending only for the pair with a pending request', () => {
    const list = [{ fromParticipantId: 'minsu', toParticipantId: 'danbi' }]
    expect(suggestionStatus(list, 'minsu', 'danbi')).toBe('PENDING')
    expect(suggestionStatus(list, 'jiyeon', 'danbi')).toBe('UNSETTLED')
    expect(suggestionStatus(list, 'danbi', 'minsu')).toBe('UNSETTLED')
  })
})
