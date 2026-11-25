import { createGroup, openMoreOptions, uniqueSuffix } from './app'
import { expect, test } from './fixtures'
import { fieldByLabel, fillStable, selectRadixOption } from './ui'

// Groups default to USD, so picking EUR forces a conversion. The rate is
// mocked, so 1 EUR is always exactly 1.25 USD.
//
// (Transfers between members used to be recorded with the expense form, in any
// currency. They are now settlement requests in the group currency, see
// settle-up.spec.ts, so only the expense side of this remains.)
test.use({ exchangeRate: 1.25 })

test('refreshing the exchange rate does not submit the form', async ({
  page,
}) => {
  const groupId = await createGroup(page, {
    name: `E2E Rate Refresh ${uniqueSuffix()}`,
    participants: ['Alice', 'Bob'],
  })
  await page.goto(`/groups/${groupId}/expenses/create`)
  await fillStable(page.locator('input[name="title"]'), 'Museum')
  await openMoreOptions(page)
  await selectRadixOption(
    page,
    fieldByLabel(page, 'Currency of expense').getByRole('combobox'),
    /Euro \(EUR\)/,
  )
  // Blurring is what makes the form recompute the group-currency amount.
  const original = page.locator('input[name="originalAmount"]')
  await fillStable(original, '40')
  await original.blur()
  await expect(page.locator('input[name="amount"]')).toHaveValue(/^50/)

  await page.getByRole('button', { name: 'Refresh' }).click()

  // Asserting that nothing happens, so it needs a settling period rather than
  // an immediate check: a submit navigates a second or two later.
  await page.waitForTimeout(3_000)
  await expect(page).toHaveURL(new RegExp(`/groups/${groupId}/expenses/create`))
})
