import {
  addExpense,
  createGroup,
  expectBalance,
  getInviteToken,
  joinGroup,
  openTab,
  reimbursementRow,
  uniqueSuffix,
} from './app'
import { expect, newUserPage, test } from './fixtures'
import { money } from './ui'

/**
 * Settling up is its own flow, separate from adding expenses: the sender says
 * they sent the money, the recipient confirms they received it, and only then
 * do balances change.
 */

async function setUp(
  page: import('@playwright/test').Page,
  browser: import('@playwright/test').Browser,
  baseURL: string | undefined,
  name: string,
) {
  const groupId = await createGroup(page, {
    name: `${name} ${uniqueSuffix()}`,
    participants: ['Alice', 'Bob'],
  })
  await addExpense(page, groupId, {
    title: 'Hotel',
    amount: '100',
    paidBy: 'Alice',
  })
  const bob = await newUserPage(browser, baseURL, 'Bob')
  await joinGroup(bob, await getInviteToken(page, groupId), 'Bob')
  return { groupId, bob }
}

test('the sender asks, the recipient confirms, the debt is settled', async ({
  page,
  browser,
  baseURL,
}) => {
  const { groupId, bob } = await setUp(page, browser, baseURL, 'E2E Settle')

  // Only the person who owes the money is offered to record the transfer.
  await openTab(page, 'Balances')
  await expectBalance(page, 'Alice', 50)
  await expectBalance(page, 'Bob', -50)
  const aliceRow = reimbursementRow(page, 'Bob', 'Alice')
  await expect(aliceRow).toContainText(money(50))
  await expect(aliceRow).toContainText('Not settled')
  await expect(aliceRow.getByRole('link', { name: 'I sent it' })).toHaveCount(0)

  await bob.goto(`/groups/${groupId}/settlements`)
  await reimbursementRow(bob, 'Bob', 'Alice')
    .getByRole('link', { name: 'I sent it' })
    .click()
  await bob.waitForURL(/\/settlements\/new/)
  // A dedicated form: no "paid for" or split options, the sender is fixed.
  await expect(bob.getByText('From: Bob (me)')).toBeVisible()
  await expect(bob.getByLabel('Amount sent')).toHaveValue('50')
  await bob.getByLabel('Note (optional)').fill('Bank transfer')
  await bob.getByRole('button', { name: 'Send for confirmation' }).click()
  await bob.waitForURL(/\/settlements\/[^/]+$/)
  await expect(bob.getByTestId('settlement-status')).toHaveText(
    'Waiting for confirmation',
  )

  // Waiting for Alice: nothing is settled yet.
  await page.goto(`/groups/${groupId}/settlements`)
  await expectBalance(page, 'Bob', -50)
  await expect(reimbursementRow(page, 'Bob', 'Alice')).toContainText(
    'Waiting for confirmation',
  )

  // Alice is told on the group home, and confirms.
  await page.goto(`/groups/${groupId}`)
  await expect(
    page.getByText('1 transfer is waiting for your confirmation.'),
  ).toBeVisible()
  await page.getByRole('link', { name: /Did you receive/ }).click()
  await page.getByRole('button', { name: `I received ${money(50)}` }).click()
  await expect(page.getByTestId('settlement-status')).toHaveText('Settled')

  await page.goto(`/groups/${groupId}/settlements`)
  await expectBalance(page, 'Alice', 0)
  await expectBalance(page, 'Bob', 0)
  await expect(
    page.getByText('Nobody owes anything in this group.'),
  ).toBeVisible()
  await expect(page.getByTestId('transfer-row')).toContainText('Settled')

  // The transfer is not an expense.
  await openTab(page, 'Expenses')
  await expect(page.getByTestId('expense-card')).toHaveCount(1)

  // And the activity log says who did what.
  await openTab(page, 'Activity')
  await expect(
    page.getByText(`Bob asked Alice to confirm a transfer of ${money(50)}.`),
  ).toBeVisible()
  await expect(
    page.getByText(`Alice confirmed receiving ${money(50)} from Bob.`),
  ).toBeVisible()
  await bob.context().close()
})

test('a rejected transfer changes nothing and can be sent again', async ({
  page,
  browser,
  baseURL,
}) => {
  const { groupId, bob } = await setUp(page, browser, baseURL, 'E2E Reject')

  await bob.goto(`/groups/${groupId}/settlements/new`)
  await bob.getByLabel('Amount sent').fill('20')
  await bob.getByRole('button', { name: 'Send for confirmation' }).click()
  await bob.waitForURL(/\/settlements\/[^/]+$/)
  // The sender cannot confirm their own transfer.
  await expect(bob.getByRole('button', { name: /I received/ })).toHaveCount(0)

  await page.goto(`/groups/${groupId}`)
  await page.getByRole('link', { name: /Did you receive/ }).click()
  await page.getByRole('button', { name: 'I did not receive it' }).click()
  await page.getByLabel('Why? (optional)').fill('Nothing arrived yet')
  await page.getByRole('button', { name: 'Confirm: not received' }).click()
  await expect(page.getByTestId('settlement-status')).toHaveText('Rejected')

  await page.goto(`/groups/${groupId}/settlements`)
  await expectBalance(page, 'Bob', -50)
  await expect(reimbursementRow(page, 'Bob', 'Alice')).toContainText(
    'Not settled',
  )

  // Bob can send a new request (a partial one here), then cancel it.
  await bob.goto(`/groups/${groupId}/settlements/new`)
  await bob.getByLabel('Amount sent').fill('20')
  await bob.getByRole('button', { name: 'Send for confirmation' }).click()
  await bob.waitForURL(/\/settlements\/[^/]+$/)
  await bob.getByRole('button', { name: 'Cancel my request' }).click()
  await expect(bob.getByTestId('settlement-status')).toHaveText('Canceled')
  await bob.context().close()
})

test('a partial transfer leaves the rest to settle', async ({
  page,
  browser,
  baseURL,
}) => {
  const { groupId, bob } = await setUp(page, browser, baseURL, 'E2E Partial')

  await bob.goto(`/groups/${groupId}/settlements/new`)
  await bob.getByLabel('Amount sent').fill('60')
  await expect(
    bob.getByText(`That is more than you owe (${money(50)}).`),
  ).toBeVisible()
  await expect(
    bob.getByRole('button', { name: 'Send for confirmation' }),
  ).toBeDisabled()
  await bob.getByLabel('Amount sent').fill('30')
  await bob.getByRole('button', { name: 'Send for confirmation' }).click()
  await bob.waitForURL(/\/settlements\/[^/]+$/)

  await page.goto(`/groups/${groupId}`)
  await page.getByRole('link', { name: /Did you receive/ }).click()
  await page.getByRole('button', { name: `I received ${money(30)}` }).click()
  await expect(page.getByTestId('settlement-status')).toHaveText('Settled')

  await page.goto(`/groups/${groupId}/settlements`)
  await expectBalance(page, 'Bob', -20)
  await expect(reimbursementRow(page, 'Bob', 'Alice')).toContainText(money(20))
  await bob.context().close()
})
