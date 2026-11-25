import 'server-only'
import { effectiveBaseUrl, env } from '@/lib/env'
import { prisma } from '@/lib/prisma'
import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { nextCookies } from 'better-auth/next-js'
import { headers } from 'next/headers'
import { cache } from 'react'

/**
 * Email/password accounts with database sessions (httpOnly cookie).
 *
 * Passwords are hashed by better-auth (scrypt) and stored in `account.password`;
 * the plain password is never stored or logged.
 */
export const auth = betterAuth({
  baseURL: effectiveBaseUrl,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: [effectiveBaseUrl],
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    // Signing up logs the user in right away (no email verification step:
    // this instance has no mail server).
    autoSignIn: true,
  },
  // On by default in production (better-auth's own limits on sign-in/up).
  ...(env.AUTH_RATE_LIMIT_DISABLED ? { rateLimit: { enabled: false } } : {}),
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // refreshed at most once a day
  },
  // Lets server actions and route handlers set the session cookie.
  plugins: [nextCookies()],
})

export type SessionUser = {
  id: string
  name: string
  email: string
}

/**
 * The signed-in user for the current request, or null. Verified against the
 * session table on every call (memoized per request), so it is safe to use for
 * authorization -- unlike the cookie check in src/proxy.ts.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return null
  const { id, name, email } = session.user
  return { id, name, email }
})
