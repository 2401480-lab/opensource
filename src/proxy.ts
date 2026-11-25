import { getSessionCookie } from 'better-auth/cookies'
import { NextRequest, NextResponse } from 'next/server'

/** Pages reachable without being signed in. */
const PUBLIC_PATHS = ['/', '/login', '/signup']

/**
 * Sends visitors without a session cookie to the login page, remembering where
 * they were going.
 *
 * This only checks that a session cookie is present, to avoid a round trip for
 * pages that need a login. It is NOT the authorization check: every page,
 * tRPC procedure and route handler verifies the session (and group
 * membership) on the server itself. API routes are excluded here and answer
 * with an error instead of a redirect.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  if (PUBLIC_PATHS.includes(pathname)) return NextResponse.next()

  if (!getSessionCookie(request)) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', `${pathname}${search}`)
    return NextResponse.redirect(loginUrl)
  }
  return NextResponse.next()
}

export const config = {
  matcher: [
    // Everything but API routes, Next.js internals and static files
    // (icons, manifest, service worker, robots.txt, sitemap.xml…).
    '/((?!api/|_next/|.*\\.[a-zA-Z0-9]+$).*)',
  ],
}
