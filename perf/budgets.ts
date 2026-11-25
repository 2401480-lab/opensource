/**
 * Deterministic budgets. These, and only these, can fail the build.
 *
 * Wall-clock timings are recorded and printed but never asserted: on a shared
 * CI runner they vary enough between jobs that any threshold tight enough to
 * catch a real regression would also fire on noise. Request count, response
 * bytes, row count and server-side query count, measured against the fixed
 * dataset in `seed.ts`, do not vary at all -- so they can gate.
 *
 * Budgets are ceilings, not expectations: going under one is an improvement and
 * passes. They are written as formulas over `config` rather than as bare
 * numbers, for two reasons. A resized dataset keeps working. And the formula
 * states the cost model out loud -- `1 + 3 * config.groups` is a readable claim
 * that the home screen runs three queries per recent group, and a diff turning
 * it into `1 + config.groups` is a visible, reviewable improvement rather than a
 * number that quietly moved.
 *
 * The byte constants were fitted from real runs at the default dataset size
 * (and, for the group-scaled term, at 5/10/20 groups) and then given ~8-10%
 * headroom, so an incidental change like a longer participant name does not
 * fail the build but a structural change does. To re-baseline after an
 * intentional change, run `npm run perf` and take the figures the report prints.
 */
import {
  config,
  LARGE_GROUP,
  paidForCountFor,
  participantCountFor,
  searchMatchCount,
  targetExpenseIndex,
} from './config'

export type Budget = {
  /** Max HTTP requests. Rises if batching breaks. */
  requests: number
  /** Max total response bytes. Rises when the server over-fetches to the client. */
  bytes: number
  /**
   * Exact expected row count -- compared for equality, since fetching fewer
   * rows than expected means the step stopped exercising what it was written
   * to exercise. Omitted where the count is emergent rather than predictable.
   */
  rows?: number
  /**
   * Max Prisma operations on the server. Skipped entirely when the app runs
   * without PERF_INSTRUMENTATION.
   */
  dbQueries?: number
}

/**
 * Every `getGroupExpenses` call pays for an unscoped `createRecurringExpenses()`
 * pass before its own query -- see src/lib/api.ts. Two operations, not one.
 */
const EXPENSE_READ_QUERIES = 2

/** `getGroup` is a single findUnique with an include. */
const GROUP_READ_QUERIES = 1

/**
 * Every request is authenticated: better-auth reads the session and its user
 * (src/lib/auth.ts `getCurrentUser`, once per HTTP request, shared by every
 * procedure of a batch).
 */
const AUTH_QUERIES = 2

/**
 * Every group-scoped procedure checks that the user is a member of the group
 * (`groupProcedure` in src/trpc/init.ts): one lookup per procedure.
 */
const MEMBERSHIP_QUERY = 1

const largeGroupParticipants = participantCountFor(LARGE_GROUP)

export const budgets: Record<string, Budget> = {
  /**
   * `groups.list` returns the signed-in user's groups with their own balance
   * in each, from one nested query (src/lib/membership.ts `listMyGroups`),
   * so the cost no longer grows with the number of groups. (Before accounts,
   * the home screen sent its local list of group ids and then ran
   * `getGroup` + a full `getGroupExpenses` per group: 61 queries at the
   * default dataset.)
   */
  'list-groups:home': {
    requests: 1,
    bytes: 120 + config.groups * 360,
    // One row per group: its own settlement status is part of the row.
    rows: config.groups,
    dbQueries: AUTH_QUERIES + 1,
  },

  'view-group:first-page': {
    requests: 1,
    bytes: 1_500 + config.pageSize * 1_340,
    rows: largeGroupParticipants + config.pageSize,
    // groups.get + groups.expenses.list, batched.
    dbQueries:
      AUTH_QUERIES +
      2 * MEMBERSHIP_QUERY +
      GROUP_READ_QUERIES +
      EXPENSE_READ_QUERIES,
  },

  /**
   * Same shape and same row count as `first-page` -- only the offset differs.
   * That is the point: if these two ever diverge in bytes or queries, something
   * about pagination changed. The interesting difference between them is
   * timing, which lives in the report rather than here.
   */
  'view-group:deep-page': {
    requests: 1,
    bytes: config.pageSize * 1_340,
    rows: config.pageSize,
    dbQueries: AUTH_QUERIES + MEMBERSHIP_QUERY + EXPENSE_READ_QUERIES,
  },

  'view-group:search': {
    requests: 1,
    bytes: config.pageSize * 1_340,
    // A full page, unless the dataset is small enough that fewer expenses match.
    rows: Math.min(config.pageSize, searchMatchCount),
    dbQueries: AUTH_QUERIES + MEMBERSHIP_QUERY + EXPENSE_READ_QUERIES,
  },

  /**
   * Loads every expense in the group to compute balances in JS. The response is
   * tiny -- balances only -- so `bytes` cannot catch a regression here;
   * `dbQueries` and the timing trend are what matter for this step.
   *
   * No `rows` budget: `getPublicBalances` only lists participants that appear
   * in a suggested reimbursement, so the count falls out of the balance
   * arithmetic rather than from the dataset size. Pinning it would assert on an
   * emergent property that a legitimate change to the reimbursement algorithm
   * would move.
   */
  'view-group:balances': {
    requests: 1,
    // Each participant also gets a breakdown (paid, share, sent, received),
    // which the settle-up page uses to explain how their amount comes about.
    bytes: largeGroupParticipants * 220,
    dbQueries: AUTH_QUERIES + MEMBERSHIP_QUERY + EXPENSE_READ_QUERIES,
  },

  /**
   * Three procedures, one batched request: `groups.get`, `categories.list` and
   * `groups.expenses.get`. One query each. Most of the payload is the static
   * category table rather than the expense itself, which is why the fixed term
   * dominates.
   */
  'view-expense:edit-form': {
    requests: 1,
    // Participants now carry whether they are members, and the response says
    // which one is the signed-in user.
    bytes:
      4_800 +
      largeGroupParticipants * 90 +
      paidForCountFor(LARGE_GROUP, targetExpenseIndex) * 40,
    rows:
      largeGroupParticipants + paidForCountFor(LARGE_GROUP, targetExpenseIndex),
    // categories.list needs a session but no group membership.
    dbQueries: AUTH_QUERIES + 2 * MEMBERSHIP_QUERY + GROUP_READ_QUERIES + 1 + 1,
  },
}
