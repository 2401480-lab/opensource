import { createGroup, getInviteToken, joinGroup, uniqueSuffix } from './app'
import { expect, newUserPage, test } from './fixtures'

/**
 * A group is only visible to its members. The group URL alone no longer gives
 * access: others need the invite link, and the server refuses every request
 * from a non-member, whatever the page shows.
 */

test('a non-member cannot open the group, its API or its export', async ({
  page,
  browser,
  baseURL,
}) => {
  const groupId = await createGroup(page, {
    name: `E2E Private ${uniqueSuffix()}`,
    participants: ['Alice', 'Bob'],
  })

  const mallory = await newUserPage(browser, baseURL, 'Mallory')
  await mallory.goto(`/groups/${groupId}/expenses`)
  await expect(
    mallory.getByText('You are not a member of this group'),
  ).toBeVisible()
  await expect(mallory.getByText(/E2E Private/)).toHaveCount(0)

  const input = encodeURIComponent(JSON.stringify({ json: { groupId } }))
  const api = await mallory.request.get(`/api/trpc/groups.get?input=${input}`)
  expect(api.status()).toBe(403)

  const exported = await mallory.request.get(
    `/groups/${groupId}/expenses/export/json`,
  )
  expect(exported.status()).toBe(404)

  // Not in their groups either.
  await mallory.goto('/groups')
  await expect(mallory.getByText('You are not in any group yet')).toBeVisible()
  await mallory.context().close()
})

test('joining picks an existing participant once, without duplicates', async ({
  page,
  browser,
  baseURL,
}) => {
  const groupId = await createGroup(page, {
    name: `E2E Invite ${uniqueSuffix()}`,
    participants: ['Alice', 'Bob', 'Carol'],
  })
  const token = await getInviteToken(page, groupId)

  const bob = await newUserPage(browser, baseURL, 'Bob')
  await joinGroup(bob, token, 'Bob')

  // Opening the link again does not add Bob a second time.
  await bob.goto(`/invite/${token}`)
  await expect(
    bob.getByText('You are already a member of this group.'),
  ).toBeVisible()

  // Bob is taken: the next person can only pick Carol (or a new name).
  const carol = await newUserPage(browser, baseURL, 'Carol')
  await carol.goto(`/invite/${token}`)
  await expect(carol.getByLabel('Carol', { exact: true })).toBeVisible()
  await expect(carol.getByLabel('Bob', { exact: true })).toHaveCount(0)
  await expect(carol.getByLabel('Alice', { exact: true })).toHaveCount(0)

  await page.goto(`/groups/${groupId}/members`)
  await expect(page.getByText('Joined', { exact: true })).toHaveCount(1)
  await expect(page.getByText('Not joined yet', { exact: true })).toHaveCount(1)
  await bob.context().close()
  await carol.context().close()
})
