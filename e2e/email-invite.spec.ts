import { Browser, Page } from '@playwright/test'
import { createGroup, uniqueSuffix } from './app'
import {
  expect,
  newUserPage,
  preparePage,
  signUp,
  test,
  uniqueEmail,
} from './fixtures'

/**
 * Inviting a participant by email: the invitation shows up inside the app for
 * the account with that email (no mail is sent), and accepting it links that
 * account to exactly the invited participant.
 */

async function userWithEmail(
  browser: Browser,
  baseURL: string | undefined,
  name: string,
  email: string,
) {
  const context = await browser.newContext({ baseURL })
  const page = await context.newPage()
  await preparePage(page, baseURL, null)
  await signUp(page, baseURL, name, email)
  return page
}

async function pendingInviteId(page: Page, groupId: string, name: string) {
  const input = encodeURIComponent(JSON.stringify({ json: { groupId } }))
  const response = await page.request.get(`/api/trpc/groups.get?input=${input}`)
  const body = await response.json()
  const participant = body.result.data.json.group.participants.find(
    (p: { name: string }) => p.name === name,
  )
  return participant.invite?.id as string | undefined
}

test('an invited person accepts and joins as the invited participant', async ({
  page,
  browser,
  baseURL,
}) => {
  const bobEmail = uniqueEmail('bob')
  const name = `E2E Email ${uniqueSuffix()}`
  const groupId = await createGroup(page, {
    name,
    participants: ['Alice', 'Bob', 'Carol'],
    emails: { Bob: bobEmail },
  })

  await page.goto(`/groups/${groupId}/members`)
  await expect(page.getByTestId('email-invite')).toHaveText(
    `Invited: ${bobEmail}`,
  )

  // Someone else does not see it, and cannot accept it through the API.
  const mallory = await newUserPage(browser, baseURL, 'Mallory')
  await mallory.goto('/groups')
  await expect(mallory.getByText('You are not in any group yet')).toBeVisible()
  await expect(mallory.getByTestId('received-invites')).toHaveCount(0)
  const inviteId = await pendingInviteId(page, groupId, 'Bob')
  expect(inviteId).toBeTruthy()
  const stolen = await mallory.request.post(
    '/api/trpc/membership.acceptInvite',
    {
      data: { json: { inviteId } },
    },
  )
  expect(stolen.status()).toBe(403)
  await mallory.context().close()

  // Bob signs up with the invited email and accepts.
  const bob = await userWithEmail(browser, baseURL, 'Bob', bobEmail)
  await bob.goto('/groups')
  await expect(bob.getByTestId('received-invite')).toContainText(
    `invited Bob to ${name}`,
  )
  await bob.getByRole('button', { name: 'Accept invitation' }).click()
  await bob.waitForURL(new RegExp(`/groups/${groupId}$`))
  await expect(bob.getByTestId('my-settlement')).toContainText(
    "Bob's settlement",
  )

  // The invite is used up; Bob is a member, Carol still is not.
  await bob.goto('/groups')
  await expect(bob.getByTestId('received-invites')).toHaveCount(0)
  await expect(bob.getByRole('link', { name })).toBeVisible()
  await page.goto(`/groups/${groupId}/members`)
  await expect(page.getByText('Joined', { exact: true })).toHaveCount(1)
  await expect(page.getByTestId('email-invite')).toHaveCount(0)
  await bob.context().close()
})

test('invites from the members page can be declined or canceled', async ({
  page,
  browser,
  baseURL,
}) => {
  const carolEmail = uniqueEmail('carol')
  const groupId = await createGroup(page, {
    name: `E2E Email Members ${uniqueSuffix()}`,
    participants: ['Alice', 'Bob', 'Carol'],
  })

  await page.goto(`/groups/${groupId}/members`)
  const carolRow = page.locator('li', { hasText: 'Carol' })
  await carolRow.getByRole('button', { name: 'Invite by email' }).click()
  await carolRow.getByLabel('Their email').fill(carolEmail)
  await carolRow.getByRole('button', { name: 'Send invitation' }).click()
  await expect(carolRow.getByTestId('email-invite')).toHaveText(
    `Invited: ${carolEmail}`,
  )

  // Carol declines: nothing changes in the group.
  const carol = await userWithEmail(browser, baseURL, 'Carol', carolEmail)
  await carol.goto('/groups')
  await carol.getByRole('button', { name: 'Decline' }).click()
  await expect(carol.getByTestId('received-invites')).toHaveCount(0)
  await expect(carol.getByText('You are not in any group yet')).toBeVisible()
  await page.reload()
  await expect(carolRow.getByTestId('email-invite')).toHaveCount(0)

  // Invite again, then cancel it: Carol no longer sees it.
  await carolRow.getByRole('button', { name: 'Invite by email' }).click()
  await carolRow.getByLabel('Their email').fill(carolEmail)
  await carolRow.getByRole('button', { name: 'Send invitation' }).click()
  await carol.reload()
  await expect(carol.getByTestId('received-invite')).toHaveCount(1)
  await carolRow.getByRole('button', { name: 'Cancel invitation' }).click()
  await expect(carolRow.getByTestId('email-invite')).toHaveCount(0)
  await carol.reload()
  await expect(carol.getByTestId('received-invites')).toHaveCount(0)
  await carol.context().close()
})

test('an email of someone already in the group is refused', async ({
  page,
}) => {
  const groupId = await createGroup(page, {
    name: `E2E Email Self ${uniqueSuffix()}`,
    participants: ['Alice', 'Bob'],
  })
  // The signed-in creator's own email.
  const meResponse = await page.request.get('/api/auth/get-session')
  const myEmail = (await meResponse.json()).user.email as string

  await page.goto(`/groups/${groupId}/members`)
  const bobRow = page.locator('li', { hasText: 'Bob' })
  await bobRow.getByRole('button', { name: 'Invite by email' }).click()
  await bobRow.getByLabel('Their email').fill(myEmail)
  await bobRow.getByRole('button', { name: 'Send invitation' }).click()
  await expect(
    bobRow.getByText('This email belongs to someone already in the group.'),
  ).toBeVisible()
  await expect(bobRow.getByTestId('email-invite')).toHaveCount(0)

  // Same in the group form: nothing is saved.
  await page.goto('/groups/create')
  await page.locator('input[name="name"]').fill('E2E Self invite')
  await page.getByRole('button', { name: 'Add participant' }).click()
  await page.locator('input[name="participants.1.name"]').fill('Bob')
  await page.locator('input[name="participants.1.email"]').fill(myEmail)
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  await expect(
    page.getByText(
      'One of the emails belongs to someone already in this group',
    ),
  ).toBeVisible()
  await expect(page).toHaveURL(/\/groups\/create$/)
})
