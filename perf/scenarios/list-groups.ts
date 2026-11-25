/**
 * The `/groups` home screen: `groups.list`, which returns the signed-in user's
 * groups with their own settlement status (src/lib/membership.ts
 * `listMyGroups`, one query that loads every group's expenses).
 *
 * The suite signs in as PERF_USER (perf/config.ts), whom the seeder makes a
 * member of every group.
 */
import { batched } from '../client'
import type { Step } from '../harness'

export const listGroups: Step[] = [
  {
    name: 'list-groups:home',
    /** Rows: one per group listed. */
    run: async () => {
      const { groups } = await batched.groups.list.query()
      return groups.length
    },
  },
]
