/**
 * Rules for changing a member's role in a group (관리자 = OWNER, 구성원 = MEMBER).
 * Pure so it can be unit tested; the server applies it inside a transaction.
 */

export type GroupRoleValue = 'OWNER' | 'MEMBER'

export type RoleChangeError =
  /** Only participants linked to an account (members) have a role to change. */
  | 'NOT_A_MEMBER'
  /** The group must always keep at least one owner. */
  | 'LAST_OWNER'

export function checkRoleChange({
  target,
  newRole,
  ownerCount,
}: {
  target: { userId: string | null; role: GroupRoleValue }
  newRole: GroupRoleValue
  /** Number of owners in the group before the change. */
  ownerCount: number
}): RoleChangeError | null {
  if (target.userId === null) return 'NOT_A_MEMBER'
  if (target.role === 'OWNER' && newRole === 'MEMBER' && ownerCount <= 1)
    return 'LAST_OWNER'
  return null
}
