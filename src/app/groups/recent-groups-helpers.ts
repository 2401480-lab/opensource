import { z } from 'zod'

export const starredGroupsSchema = z.array(z.string())
export const archivedGroupsSchema = z.array(z.string())

const STARRED_GROUPS_STORAGE_KEY = 'starredGroups'
const ARCHIVED_GROUPS_STORAGE_KEY = 'archivedGroups'

/**
 * Before accounts, the list of "my groups" and who "I" am in each group were
 * kept in the browser. Both now come from the account (database), so the old
 * browser copies are removed.
 */
export function clearLegacyDeviceData() {
  try {
    localStorage.removeItem('recentGroups')
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i)
      if (key?.endsWith('-activeUser')) localStorage.removeItem(key)
    }
  } catch {
    // Storage unavailable (private mode): nothing to clean up.
  }
}

export function getStarredGroups() {
  const starredGroupsJson = localStorage.getItem(STARRED_GROUPS_STORAGE_KEY)
  const starredGroupsRaw = starredGroupsJson
    ? JSON.parse(starredGroupsJson)
    : []
  const parseResult = starredGroupsSchema.safeParse(starredGroupsRaw)
  return parseResult.success ? parseResult.data : []
}

export function starGroup(groupId: string) {
  const starredGroups = getStarredGroups()
  localStorage.setItem(
    STARRED_GROUPS_STORAGE_KEY,
    JSON.stringify([...starredGroups, groupId]),
  )
}

export function unstarGroup(groupId: string) {
  const starredGroups = getStarredGroups()
  localStorage.setItem(
    STARRED_GROUPS_STORAGE_KEY,
    JSON.stringify(starredGroups.filter((g) => g !== groupId)),
  )
}

export function getArchivedGroups() {
  const archivedGroupsJson = localStorage.getItem(ARCHIVED_GROUPS_STORAGE_KEY)
  const archivedGroupsRaw = archivedGroupsJson
    ? JSON.parse(archivedGroupsJson)
    : []
  const parseResult = archivedGroupsSchema.safeParse(archivedGroupsRaw)
  return parseResult.success ? parseResult.data : []
}

export function archiveGroup(groupId: string) {
  const archivedGroups = getArchivedGroups()
  localStorage.setItem(
    ARCHIVED_GROUPS_STORAGE_KEY,
    JSON.stringify([...archivedGroups, groupId]),
  )
}

export function unarchiveGroup(groupId: string) {
  const archivedGroups = getArchivedGroups()
  localStorage.setItem(
    ARCHIVED_GROUPS_STORAGE_KEY,
    JSON.stringify(archivedGroups.filter((g) => g !== groupId)),
  )
}
