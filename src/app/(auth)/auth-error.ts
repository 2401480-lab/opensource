/** Maps a better-auth error to one of our `Auth.errors.*` messages. */
export function authErrorKey(error: { code?: string; status?: number }) {
  const code = error.code ?? ''
  if (code.includes('INVALID_EMAIL_OR_PASSWORD') || error.status === 401)
    return 'invalidCredentials'
  if (code.includes('USER_ALREADY_EXISTS')) return 'emailTaken'
  if (code.includes('PASSWORD_TOO_SHORT')) return 'passwordTooShort'
  if (code.includes('INVALID_EMAIL')) return 'invalidEmail'
  return 'generic'
}
