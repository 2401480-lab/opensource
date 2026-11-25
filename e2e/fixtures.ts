import { test as base, Browser, expect, Page } from '@playwright/test'

/**
 * Shared test fixture.
 *
 * Three things every spec needs:
 *
 * 1. A signed-in user. Every page but /login and /signup requires an account,
 *    so each test signs up a fresh user (unique email) before it starts. The
 *    sign-up request goes through `page.request`, which shares the browser
 *    context's cookie jar, so the page is logged in from its first navigation.
 *    `test.use({ signIn: false })` keeps a test logged out.
 *
 * 2. The locale. Assertions are English literals and amounts are formatted by
 *    Intl, so both the app locale (NEXT_LOCALE cookie, which outranks
 *    Accept-Language in src/lib/locale.ts) and the browser locale are pinned.
 *
 * 3. No third-party network: currency rates are mocked and flag images
 *    blocked.
 */
type Options = {
  /** Sign up a fresh user before the test. Defaults to true. */
  signIn: boolean

  /** Display name of that user. */
  userName: string

  /**
   * Rate returned for every api.frankfurter.dev request, so currency
   * conversion is deterministic and offline. Null (the default) aborts the
   * request instead, which is what every non-currency spec wants.
   */
  exchangeRate: number | null
}

export const E2E_PASSWORD = 'e2e-password-123'

export function uniqueEmail(name: string) {
  const local = name.toLowerCase().replace(/[^a-z0-9]+/g, '') || 'user'
  return `${local}+${Date.now()}${Math.random().toString(36).slice(2, 8)}@e2e.test`
}

/** Locale cookie and network stubs, shared by every page of the suite. */
export async function preparePage(
  page: Page,
  baseURL: string | undefined,
  exchangeRate: number | null,
) {
  if (baseURL) {
    await page
      .context()
      .addCookies([{ name: 'NEXT_LOCALE', value: 'en-US', url: baseURL }])
  }

  // The suite must never depend on a third-party API. useCurrencyRate calls
  // this only when the expense currency differs from the group currency.
  await page.route('https://api.frankfurter.dev/**', (route) => {
    if (exchangeRate === null) return route.abort()

    // Request shape: /v2/rates?date=<YYYY-MM-DD>&base=<CODE>&quotes=<CODE>.
    // The hook turns the response into a RangeError unless `date` echoes the
    // requested date exactly, so mirror it back rather than inventing one.
    const url = new URL(route.request().url())
    const date = url.searchParams.get('date') ?? ''
    const base = url.searchParams.get('base') ?? ''
    const quote = url.searchParams.get('quotes') ?? ''

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ date, base, quote, rate: exchangeRate }]),
    })
  })

  // Currency and category pickers render flag images from a CDN. Nothing is
  // asserted on them and they only add latency, so keep the run hermetic.
  await page.route('https://flagcdn.com/**', (route) => route.abort())
}

/** Signs up (and so logs in) a new user in the page's browser context. */
export async function signUp(
  page: Page,
  baseURL: string | undefined,
  name: string,
  email = uniqueEmail(name),
) {
  const response = await page.request.post('/api/auth/sign-up/email', {
    data: { name, email, password: E2E_PASSWORD },
    headers: baseURL ? { origin: baseURL } : undefined,
  })
  expect(response.ok(), await response.text()).toBeTruthy()
  return { name, email }
}

/** A second (third…) member, in a browser context of their own. */
export async function newUserPage(
  browser: Browser,
  baseURL: string | undefined,
  name: string,
  exchangeRate: number | null = null,
) {
  const context = await browser.newContext({ baseURL })
  const page = await context.newPage()
  await preparePage(page, baseURL, exchangeRate)
  await signUp(page, baseURL, name)
  return page
}

export const test = base.extend<Options>({
  signIn: [true, { option: true }],
  userName: ['E2E User', { option: true }],
  exchangeRate: [null, { option: true }],

  // The second argument is Playwright's `use` callback, renamed because
  // eslint-plugin-react-hooks would otherwise read `use(...)` as React's hook.
  page: async ({ page, baseURL, signIn, userName, exchangeRate }, runTest) => {
    await preparePage(page, baseURL, exchangeRate)
    if (signIn) await signUp(page, baseURL, userName)
    await runTest(page)
  },
})

export { expect }
