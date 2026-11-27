import { Page } from '@playwright/test'
import { createGroup, getInviteToken, joinGroup, uniqueSuffix } from './app'
import { expect, newUserPage, test } from './fixtures'

/**
 * Roles: the group creator is an admin (OWNER), people who join are members.
 * Only admins can change roles, and the group always keeps one admin. The
 * server enforces both, not just the page.
 */

async function setRoleRequest(
  page: Page,
  groupId: string,
  participantId: string,
  role: 'OWNER' | 'MEMBER',
) {
  return page.request.post('/api/trpc/groups.members.setRole', {
    data: { json: { groupId, participantId, role } },
  })
}

async function participantId(page: Page, groupId: string, name: string) {
  const input = encodeURIComponent(JSON.stringify({ json: { groupId } }))
  const response = await page.request.get(`/api/trpc/groups.get?input=${input}`)
  const body = await response.json()
  return body.result.data.json.group.participants.find(
    (p: { name: string }) => p.name === name,
  ).id as string
}

async function pickRole(page: Page, name: string, role: 'Admin' | 'Member') {
  await page.getByRole('combobox', { name: `Role of ${name}` }).click()
  await page.getByRole('option', { name: role }).click()
}

test('admins change roles; members cannot; one admin always remains', async ({
  page,
  browser,
  baseURL,
}) => {
  const groupId = await createGroup(page, {
    name: `E2E Roles ${uniqueSuffix()}`,
    participants: ['Alice', 'Bob', 'Carol'],
  })
  const bob = await newUserPage(browser, baseURL, 'Bob')
  await joinGroup(bob, await getInviteToken(page, groupId), 'Bob')
  const aliceId = await participantId(page, groupId, 'Alice')
  const carolId = await participantId(page, groupId, 'Carol')

  // Bob is a member: no role pickers, and the server refuses him too.
  await bob.goto(`/groups/${groupId}/members`)
  await expect(bob.getByText('Admin', { exact: true })).toBeVisible()
  await expect(bob.getByRole('combobox')).toHaveCount(0)
  expect((await setRoleRequest(bob, groupId, aliceId, 'MEMBER')).status()).toBe(
    403,
  )

  // Alice is the only admin: she cannot step down.
  await page.goto(`/groups/${groupId}/members`)
  await pickRole(page, 'Alice', 'Member')
  await expect(
    page.getByText('The group needs at least one admin.', { exact: false }),
  ).toBeVisible()
  await expect(
    page.getByRole('combobox', { name: 'Role of Alice' }),
  ).toHaveText('Admin')

  // Participants who have not joined have no role to change.
  expect((await setRoleRequest(page, groupId, carolId, 'OWNER')).status()).toBe(
    400,
  )

  // Alice makes Bob an admin; now Bob can manage roles and demote Alice.
  await pickRole(page, 'Bob', 'Admin')
  await expect(page.getByRole('combobox', { name: 'Role of Bob' })).toHaveText(
    'Admin',
  )
  await bob.reload()
  await pickRole(bob, 'Alice', 'Member')
  await expect(bob.getByRole('combobox', { name: 'Role of Alice' })).toHaveText(
    'Member',
  )

  // Alice is now a member: no pickers for her.
  await page.reload()
  await expect(page.getByRole('combobox')).toHaveCount(0)
  expect((await setRoleRequest(page, groupId, aliceId, 'OWNER')).status()).toBe(
    403,
  )

  // Both changes are in the activity log.
  await page.goto(`/groups/${groupId}/activity`)
  await expect(page.getByText('made Bob an admin.')).toBeVisible()
  await expect(page.getByText('made Alice a member.')).toBeVisible()
  await bob.context().close()
})
