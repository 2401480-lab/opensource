import { Page } from '@playwright/test'
import { createGroup, getInviteToken, joinGroup, uniqueSuffix } from './app'
import { expect, newUserPage, test } from './fixtures'
import { fillStable, money } from './ui'

/**
 * 회비 (shared fund): admins turn it on and set the fee, members say they
 * paid, admins confirm or exempt, and expenses paid from the fund change the
 * account balance without becoming anyone's debt. The server enforces who may
 * do what.
 */

function currentMonthLabel() {
  // The fund's months follow Korean time.
  const now = new Date()
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(now)
  const year = Number(parts.find((p) => p.type === 'year')!.value)
  const month = Number(parts.find((p) => p.type === 'month')!.value)
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  })
}

async function trpcPost(page: Page, path: string, json: unknown) {
  return page.request.post(`/api/trpc/${path}`, { data: { json } })
}

async function participants(page: Page, groupId: string) {
  const input = encodeURIComponent(JSON.stringify({ json: { groupId } }))
  const response = await page.request.get(`/api/trpc/groups.get?input=${input}`)
  const body = await response.json()
  return body.result.data.json.group.participants as {
    id: string
    name: string
  }[]
}

function memberRow(page: Page, name: string) {
  return page.getByTestId('fund-member').filter({ hasText: name })
}

test('admins run the fund; members report payments; fund expenses are no one’s debt', async ({
  page,
  browser,
  baseURL,
}) => {
  const month = currentMonthLabel()
  const groupId = await createGroup(page, {
    name: `E2E Fund ${uniqueSuffix()}`,
    participants: ['Alice', 'Bob', 'Carol'],
  })
  const bob = await newUserPage(browser, baseURL, 'Bob')
  await joinGroup(bob, await getInviteToken(page, groupId), 'Bob')
  const ids = Object.fromEntries(
    (await participants(page, groupId)).map((p) => [p.name, p.id]),
  )

  // Off by default: no fund tab, and members cannot turn it on.
  await expect(page.getByRole('tab', { name: 'Fund' })).toHaveCount(0)
  expect(
    (
      await trpcPost(bob, 'groups.fund.updateSettings', {
        groupId,
        enabled: true,
        amount: 2000,
        dueDay: 10,
        startMonth: '2026-01',
        openingBalance: 0,
        restMonths: [],
        memberAmounts: [],
      })
    ).status(),
  ).toBe(403)

  // Alice turns it on: $20 a month, $100 already in the account.
  await page.goto(`/groups/${groupId}/fund/settings`)
  await page.getByLabel('Use a shared fund').click()
  await fillStable(page.getByLabel(/Default fee per member/), '20')
  await fillStable(page.getByLabel(/Starting account balance/), '100')
  await page.getByRole('button', { name: 'Save settings' }).click()
  await page.waitForURL(new RegExp(`/groups/${groupId}/fund$`))
  await expect(page.getByTestId('fund-balance')).toHaveText(money(100))
  await expect(page.getByRole('tab', { name: 'Fund' })).toBeVisible()

  // Only members with an account are billed: Carol has not joined.
  await expect(page.getByTestId('fund-member')).toHaveCount(2)
  await expect(
    memberRow(page, 'Bob').getByTestId('fund-member-state'),
  ).toHaveText('Not paid')

  // Bob says he paid; he cannot confirm it himself.
  await bob.goto(`/groups/${groupId}/fund`)
  await bob.getByRole('button', { name: `I paid for ${month}` }).click()
  await expect(
    memberRow(bob, 'Bob').getByTestId('fund-member-state'),
  ).toHaveText('To confirm')
  await expect(bob.getByRole('button', { name: 'Confirm' })).toHaveCount(0)

  // Alice confirms it, and exempts herself this month.
  await page.reload()
  await memberRow(page, 'Bob').getByRole('button', { name: 'Confirm' }).click()
  await expect(
    memberRow(page, 'Bob').getByTestId('fund-member-state'),
  ).toHaveText('Paid')
  await expect(page.getByTestId('fund-balance')).toHaveText(money(120))
  await memberRow(page, 'Alice')
    .getByRole('button', { name: 'Exempt this month' })
    .click()
  await page.getByLabel('Reason for exempting Alice').fill('Conference abroad')
  await page.getByRole('button', { name: 'Exempt', exact: true }).click()
  await expect(
    memberRow(page, 'Alice').getByTestId('fund-member-state'),
  ).toHaveText('Exempt')
  await expect(memberRow(page, 'Alice')).toContainText('Conference abroad')
  await expect(page.getByText('1 / 1 paid')).toBeVisible()

  // Alice pays $30 of toner from the fund.
  await page.goto(`/groups/${groupId}/expenses/create?source=fund`)
  const submit = page.getByRole('button', { name: 'Create', exact: true })
  await expect(submit).toBeVisible({ timeout: 30_000 })
  await expect(
    page.getByRole('radio', { name: /Fund account/ }),
  ).toHaveAttribute('aria-checked', 'true')
  await fillStable(page.locator('input[name="title"]'), 'Toner')
  await fillStable(page.locator('input[name="amount"]'), '30')
  await submit.click()
  await page.waitForURL(/\/expenses(\?|$)|\/groups\/[^/]+$/)

  await page.goto(`/groups/${groupId}/fund`)
  await expect(page.getByTestId('fund-balance')).toHaveText(money(90))
  await expect(page.getByTestId('fund-month-spent')).toHaveText(`−${money(30)}`)
  await expect(
    page.getByTestId('fund-history-item').filter({ hasText: 'Toner' }),
  ).toBeVisible()

  // Nobody owes anybody for it.
  await bob.goto(`/groups/${groupId}`)
  await expect(bob.getByTestId('my-to-send')).toHaveText(money(0))
  await bob.goto(`/groups/${groupId}/expenses`)
  await expect(bob.getByTestId('fund-badge')).toHaveText('Fund')

  // Members cannot pay from the fund or manage fees, even through the API.
  const fundExpense = {
    expenseDate: new Date().toISOString().slice(0, 10),
    title: 'Sneaky',
    category: 0,
    amount: 1000,
    originalCurrency: '',
    paidBy: ids.Bob,
    paidFor: [{ participant: ids.Bob, shares: 100 }],
    splitMode: 'EVENLY',
    saveDefaultSplittingOptions: false,
    isReimbursement: false,
    paymentSource: 'FUND',
    documents: [],
    recurrenceRule: 'NONE',
  }
  expect(
    (
      await trpcPost(bob, 'groups.expenses.create', {
        groupId,
        expenseFormValues: fundExpense,
      })
    ).status(),
  ).toBe(403)
  expect(
    (
      await trpcPost(bob, 'groups.fund.setByAdmin', {
        groupId,
        participantId: ids.Bob,
        month: '2026-01',
        action: 'EXEMPT',
      })
    ).status(),
  ).toBe(403)
  await bob.context().close()
})

test('an expense id does not reach into another group', async ({
  page,
  browser,
  baseURL,
}) => {
  const groupId = await createGroup(page, {
    name: `E2E Scope ${uniqueSuffix()}`,
    participants: ['Alice', 'Bob'],
  })
  await page.goto(`/groups/${groupId}/expenses/create`)
  const submit = page.getByRole('button', { name: 'Create', exact: true })
  await expect(submit).toBeVisible({ timeout: 30_000 })
  await fillStable(page.locator('input[name="title"]'), 'Hotel')
  await fillStable(page.locator('input[name="amount"]'), '50')
  await submit.click()
  await page.waitForURL(/\/expenses(\?|$)|\/groups\/[^/]+$/)
  const input = encodeURIComponent(JSON.stringify({ json: { groupId } }))
  const list = await page.request.get(
    `/api/trpc/groups.expenses.list?input=${input}`,
  )
  const expenseId = (await list.json()).result.data.json.expenses[0].id

  // Mallory is a member of her own group only.
  const mallory = await newUserPage(browser, baseURL, 'Mallory')
  const malloryGroup = await createGroup(mallory, {
    name: `E2E Mallory ${uniqueSuffix()}`,
    participants: ['Mallory', 'Eve'],
  })
  const get = await mallory.request.get(
    `/api/trpc/groups.expenses.get?input=${encodeURIComponent(
      JSON.stringify({ json: { groupId: malloryGroup, expenseId } }),
    )}`,
  )
  expect(get.status()).toBe(404)
  const del = await trpcPost(mallory, 'groups.expenses.delete', {
    groupId: malloryGroup,
    expenseId,
  })
  expect(del.status()).toBe(404)

  // Alice's expense is still there.
  await page.goto(`/groups/${groupId}/expenses`)
  await expect(page.getByText('Hotel')).toBeVisible()
  await mallory.context().close()
})
