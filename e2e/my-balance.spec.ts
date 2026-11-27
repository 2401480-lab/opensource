import { addExpense, createGroup, uniqueSuffix } from './app'
import { expect, test } from './fixtures'
import { money } from './ui'

/**
 * "My settlement detail": per person, the expenses behind what the signed-in
 * member sends or receives, and what to actually transfer when the suggested
 * transfers combine amounts between several people.
 */
test('explains per person which expenses make up the amounts', async ({
  page,
}) => {
  const groupId = await createGroup(page, {
    name: `E2E My Balance ${uniqueSuffix()}`,
    participants: ['Alice', 'Bob', 'Carol'],
  })
  await addExpense(page, groupId, {
    title: 'Lunch',
    amount: '96',
    paidBy: 'Bob',
  })
  await addExpense(page, groupId, {
    title: 'Snacks',
    amount: '30',
    paidBy: 'Alice',
  })
  await addExpense(page, groupId, {
    title: 'Taxi',
    amount: '60',
    paidBy: 'Alice',
    paidFor: ['Alice', 'Carol'],
  })

  // Reached from the settlement card on the group home.
  await page.goto(`/groups/${groupId}`)
  await page.getByRole('link', { name: 'See the details' }).click()
  await page.waitForURL(new RegExp(`/groups/${groupId}/my-balance$`))

  // Alice paid 90 and her share is 32 + 10 + 30 = 72: she gets 18 back.
  const formula = page.getByTestId('my-balance-formula')
  await expect(formula).toContainText(money(90))
  await expect(formula).toContainText(money(72))
  await expect(formula).toContainText(`To receive${money(18)}`)

  // Suggested transfers: Carol pays Bob 54 and Alice 18, so Alice sends
  // nothing; per person she still owes Bob 32 - 10 = 22.
  await expect(page.getByTestId('my-balance-send-total')).toHaveText(money(0))
  await expect(page.getByTestId('my-balance-receive-total')).toHaveText(
    money(18),
  )
  await page.getByRole('tab', { name: /To send/ }).click()
  const bob = page.getByTestId('my-balance-person').filter({ hasText: 'Bob' })
  await expect(bob).toContainText(`To Bob${money(22)}`)
  await expect(
    bob.getByTestId('my-balance-item').filter({ hasText: 'My share of Lunch' }),
  ).toContainText(`+${money(32)}`)
  await expect(
    bob
      .getByTestId('my-balance-item')
      .filter({ hasText: "Bob's share of Snacks" }),
  ).toContainText(`−${money(10)}`)
  await expect(page.getByTestId('my-balance-simplified')).toContainText(
    'You do not actually need to send anything.',
  )

  await page.getByRole('tab', { name: /To receive/ }).click()
  const carol = page
    .getByTestId('my-balance-person')
    .filter({ hasText: 'Carol' })
  await expect(carol).toContainText(`From Carol${money(40)}`)
  await expect(carol.getByTestId('my-balance-item')).toHaveCount(2)
  await expect(page.getByTestId('my-balance-simplified')).toContainText(
    `Receive ${money(18)} from Carol`,
  )
})
