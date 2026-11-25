import { addExpense, createGroup, uniqueSuffix } from './app'
import { expect, test } from './fixtures'
import { cardByTitle, money } from './ui'

const CARD_TITLE = 'Your total balance'

/**
 * The card sums the signed-in user's balance over the groups they are a member
 * of (from the server). Each test signs up its own user, so it only sees the
 * groups it created, even though the whole suite shares one database. Alice,
 * the first participant, is that user.
 */

test('sums balances across groups once you are identified in them', async ({
  page,
}) => {
  const first = await createGroup(page, {
    name: `E2E Global A ${uniqueSuffix()}`,
    participants: ['Alice', 'Bob'],
  })
  // Alice pays 100 split evenly, so she is owed 50.
  await addExpense(page, first, {
    title: 'Hotel',
    amount: '100',
    paidBy: 'Alice',
  })

  const second = await createGroup(page, {
    name: `E2E Global B ${uniqueSuffix()}`,
    participants: ['Alice', 'Bob'],
  })
  // Alice pays 60 split evenly, so she is owed 30.
  await addExpense(page, second, {
    title: 'Train',
    amount: '60',
    paidBy: 'Alice',
  })

  await page.goto('/groups')

  const card = cardByTitle(page, CARD_TITLE)
  await expect(card).toBeVisible()
  await expect(card).toContainText('You are owed')
  await expect(card).toContainText(money(80))
})

test('reports being settled up when every balance is zero', async ({
  page,
}) => {
  for (const name of ['E2E Global Settled A', 'E2E Global Settled B']) {
    const groupId = await createGroup(page, {
      name: `${name} ${uniqueSuffix()}`,
      participants: ['Alice', 'Bob'],
    })
    // Alice pays and is the only participant charged, so nobody owes anybody.
    await addExpense(page, groupId, {
      title: 'Coffee',
      amount: '10',
      paidBy: 'Alice',
      paidFor: ['Alice'],
    })
  }

  await page.goto('/groups')

  const card = cardByTitle(page, CARD_TITLE)
  await expect(card).toBeVisible()
  await expect(card).toContainText('You are all settled up across your groups.')
})

test('stays hidden with a single group, whose card already says it all', async ({
  page,
}) => {
  const groupId = await createGroup(page, {
    name: `E2E Global Single ${uniqueSuffix()}`,
    participants: ['Alice', 'Bob'],
  })
  await addExpense(page, groupId, {
    title: 'Lunch',
    amount: '40',
    paidBy: 'Alice',
  })

  await page.goto('/groups')

  await expect(
    page.getByRole('link', { name: /E2E Global Single/ }),
  ).toBeVisible()
  await expect(page.getByTestId('group-status')).toContainText(
    `You receive ${money(20)} from Bob`,
  )
  await expect(
    page.getByRole('heading', { name: CARD_TITLE, exact: true }),
  ).toHaveCount(0)
})
