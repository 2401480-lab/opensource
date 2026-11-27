import { checkRoleChange } from './role-rules'

describe('checkRoleChange', () => {
  const member = { userId: 'u2', role: 'MEMBER' as const }
  const owner = { userId: 'u1', role: 'OWNER' as const }

  it('lets an owner promote a member', () => {
    expect(
      checkRoleChange({ target: member, newRole: 'OWNER', ownerCount: 1 }),
    ).toBeNull()
  })

  it('lets an owner step down when another owner remains', () => {
    expect(
      checkRoleChange({ target: owner, newRole: 'MEMBER', ownerCount: 2 }),
    ).toBeNull()
  })

  it('refuses to remove the last owner', () => {
    expect(
      checkRoleChange({ target: owner, newRole: 'MEMBER', ownerCount: 1 }),
    ).toBe('LAST_OWNER')
  })

  it('refuses participants who have not joined with an account', () => {
    expect(
      checkRoleChange({
        target: { userId: null, role: 'MEMBER' },
        newRole: 'OWNER',
        ownerCount: 1,
      }),
    ).toBe('NOT_A_MEMBER')
  })

  it('accepts setting the role a member already has', () => {
    expect(
      checkRoleChange({ target: owner, newRole: 'OWNER', ownerCount: 1 }),
    ).toBeNull()
  })
})
