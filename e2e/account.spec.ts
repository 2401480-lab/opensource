import {
  addExpense,
  createGroup,
  expenseCard,
  getInviteToken,
  joinGroup,
  uniqueSuffix,
} from './app'
import {
  E2E_PASSWORD,
  expect,
  newUserPage,
  test,
  uniqueEmail,
} from './fixtures'
import { money } from './ui'

/**
 * Who "I" am now comes from the account, not from a per-device choice: the
 * group creator is its first participant, and members who join through the
 * invite link pick their own participant once.
 */

test.describe('logged out', () => {
  test.use({ signIn: false })

  test('shows the login page first, and returns to the page asked for after signing up', async ({
    page,
  }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByText('How it works')).toBeVisible()

    await page.goto('/groups/create')
    await expect(page).toHaveURL(/\/login\?next=%2Fgroups%2Fcreate/)

    await page.getByRole('link', { name: 'Sign up' }).click()
    await page.locator('#name').fill('Alice')
    await page.locator('#email').fill(uniqueEmail('alice'))
    await page.locator('#password').fill(E2E_PASSWORD)
    await page.locator('#passwordConfirm').fill(E2E_PASSWORD)
    await page.getByRole('button', { name: 'Create account' }).click()

    await expect(page).toHaveURL(/\/groups\/create$/)
    // The creator is the first participant, pre-filled with their name.
    await expect(page.locator('input[name="participants.0.name"]')).toHaveValue(
      'Alice',
    )
  })

  test('logs in, and rejects a wrong password', async ({ page, baseURL }) => {
    const email = uniqueEmail('bob')
    const response = await page.request.post('/api/auth/sign-up/email', {
      data: { name: 'Bob', email, password: E2E_PASSWORD },
      headers: { origin: baseURL! },
    })
    expect(response.ok()).toBeTruthy()
    await page.context().clearCookies()

    await page.goto('/login')
    await page.locator('#email').fill(email)
    await page.locator('#password').fill('not-the-password')
    await page.getByRole('button', { name: 'Log in' }).click()
    await expect(
      page.getByText('The email or password is incorrect.'),
    ).toBeVisible()

    await page.locator('#password').fill(E2E_PASSWORD)
    await page.getByRole('button', { name: 'Log in' }).click()
    await expect(page).toHaveURL(/\/groups$/)
    await expect(page.getByText('You are not in any group yet')).toBeVisible()
  })
})

test('the creator is "me": paid by is pre-filled and cards show my share', async ({
  page,
}) => {
  const groupId = await createGroup(page, {
    name: `E2E Account ${uniqueSuffix()}`,
    participants: ['Alice', 'Bob', 'Carol'],
  })

  await page.goto(`/groups/${groupId}/expenses/create`)
  await expect(page.getByTestId('paid-by')).toContainText('Alice')

  await addExpense(page, groupId, {
    title: 'Dinner',
    amount: '90',
    paidBy: 'Bob',
  })
  await page.goto(`/groups/${groupId}/expenses`)
  await expect(expenseCard(page, 'Dinner')).toContainText('My share:')
  await expect(expenseCard(page, 'Dinner')).toContainText(money(30))
  // The old "who are you?" dialog is gone.
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('a member who joins with the invite link is identified on every device', async ({
  page,
  browser,
  baseURL,
}) => {
  const name = `E2E Join ${uniqueSuffix()}`
  const groupId = await createGroup(page, {
    name,
    participants: ['Alice', 'Bob'],
  })
  await addExpense(page, groupId, {
    title: 'Hotel',
    amount: '100',
    paidBy: 'Alice',
  })

  const bob = await newUserPage(browser, baseURL, 'Bob')
  await joinGroup(bob, await getInviteToken(page, groupId), 'Bob')

  // Bob's group home starts with what he has to do.
  await expect(bob.getByTestId('my-settlement')).toContainText(
    "Bob's settlement",
  )
  await expect(bob.getByTestId('my-to-send')).toHaveText(money(50))

  // His groups list is stored with his account, not in the browser.
  await bob.goto('/groups')
  await expect(bob.getByRole('link', { name })).toBeVisible()
  await expect(bob.getByTestId('group-status')).toContainText(
    `You send ${money(50)} to Alice`,
  )

  await bob.goto(`/groups/${groupId}/expenses/create`)
  await expect(bob.getByTestId('paid-by')).toContainText('Bob')
  await bob.context().close()
})
