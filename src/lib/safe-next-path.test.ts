import { safeNextPath } from './safe-next-path'

describe('safeNextPath', () => {
  it('defaults to the groups home', () => {
    expect(safeNextPath(null)).toBe('/groups')
    expect(safeNextPath('')).toBe('/groups')
  })

  it('keeps same-site paths, with their query', () => {
    expect(safeNextPath('/groups/abc/expenses')).toBe('/groups/abc/expenses')
    expect(safeNextPath('/invite/tok?x=1')).toBe('/invite/tok?x=1')
  })

  it('rejects other sites and protocol-relative URLs', () => {
    expect(safeNextPath('https://evil.example')).toBe('/groups')
    expect(safeNextPath('//evil.example')).toBe('/groups')
    expect(safeNextPath('/\\evil.example')).toBe('/groups')
    expect(safeNextPath('javascript:alert(1)')).toBe('/groups')
  })

  it('does not loop back to the auth pages', () => {
    expect(safeNextPath('/login')).toBe('/groups')
    expect(safeNextPath('/login?next=/groups')).toBe('/groups')
    expect(safeNextPath('/signup')).toBe('/groups')
  })
})
