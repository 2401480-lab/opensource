/**
 * The path to go to after logging in, from a `?next=` parameter. Only
 * same-site paths are accepted, so the login page cannot be used to send users
 * to another website (open redirect).
 */
export function safeNextPath(next: string | null | undefined): string {
  if (!next) return '/groups'
  if (!next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\'))
    return '/groups'
  if (next === '/login' || next === '/signup' || next.startsWith('/login?'))
    return '/groups'
  return next
}
