import { addExpense, createGroup, openTab, uniqueSuffix } from './app'
import { expect, test } from './fixtures'
import { cardByTitle, fillStable, money } from './ui'

/**
 * Stats tell apart what the shared fund paid from what one member paid first
 * and split; groups without a fund only see the second part.
 */
test('splits spending between the fund and what members paid first', async ({
  page,
}) => {
  const groupId = await createGroup(page, {
    name: `E2E Stats Fund ${uniqueSuffix()}`,
    participants: ['Alice', 'Bob', 'Carol'],
  })
  await page.goto(`/groups/${groupId}/fund/settings`)
  await page.getByLabel('Use a shared fund').click()
  await fillStable(page.getByLabel(/Default fee per member/), '20')
  await fillStable(page.getByLabel(/Starting account balance/), '100')
  await page.getByRole('button', { name: 'Save settings' }).click()
  await page.waitForURL(new RegExp(`/groups/${groupId}/fund$`))

  await addExpense(page, groupId, {
    title: 'Dinner',
    amount: '90',
    paidBy: 'Alice',
  })
  await page.goto(`/groups/${groupId}/expenses/create?source=fund`)
  const submit = page.getByRole('button', { name: 'Create', exact: true })
  await expect(submit).toBeVisible({ timeout: 30_000 })
  await fillStable(page.locator('input[name="title"]'), 'Toner')
  await fillStable(page.locator('input[name="amount"]'), '30')
  await submit.click()
  await page.waitForURL(/\/expenses(\?|$)|\/groups\/[^/]+$/)

  await openTab(page, 'Stats')
  const flow = page.getByTestId('money-flow')
  await expect(flow).toContainText(
    `Total spending ${money(120)} = fund ${money(30)} + paid first and split ${money(90)}`,
  )
  const fund = page.getByTestId('money-flow-fund')
  await expect(fund).toContainText(`−${money(30)}`)
  await expect(fund).toContainText(`Account balance today${money(70)}`)
  const split = page.getByTestId('money-flow-split')
  await expect(split).toContainText(`I paid first${money(90)}`)
  await expect(split).toContainText(`My own share of it−${money(30)}`)
  await expect(split).toContainText(`= To get back from others${money(60)}`)

  // The toner is group spending, but nobody's own payment or share.
  await expect(cardByTitle(page, 'Totals')).toContainText(money(120))
  const byPerson = cardByTitle(page, 'Spending by participant')
  await expect(byPerson.getByRole('row', { name: /Alice/ })).toContainText(
    `+${money(60)} gets back`,
  )
  await expect(byPerson.getByRole('row', { name: /Bob/ })).toContainText(
    `−${money(30)} owes`,
  )
})

test('a group without a fund only shows what members paid first', async ({
  page,
}) => {
  const groupId = await createGroup(page, {
    name: `E2E Stats No Fund ${uniqueSuffix()}`,
    participants: ['Alice', 'Bob'],
  })
  await addExpense(page, groupId, {
    title: 'Hotel',
    amount: '100',
    paidBy: 'Alice',
  })
  await openTab(page, 'Stats')
  await expect(page.getByTestId('money-flow')).toContainText(
    'This group has no shared fund',
  )
  await expect(page.getByTestId('money-flow-fund')).toHaveCount(0)
  await expect(page.getByTestId('money-flow-split')).toContainText(
    `= To get back from others${money(50)}`,
  )
})
