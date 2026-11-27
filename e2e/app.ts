import { expect, Locator, Page } from '@playwright/test'
import {
  clickUntil,
  escapeRegExp,
  fieldByLabel,
  fillStable,
  money,
  selectRadixOption,
  setChecked,
} from './ui'

export type SplitMode = 'EVENLY' | 'BY_SHARES' | 'BY_PERCENTAGE' | 'BY_AMOUNT'

export type Recurrence = 'None' | 'Daily' | 'Weekly' | 'Monthly'

export type GroupTab =
  | 'Home'
  | 'Expenses'
  | 'Balances'
  | 'Information'
  | 'Stats'
  | 'Members'
  | 'Activity'
  | 'Settings'

/**
 * Where each page is, since the navigation was reorganised: the main tasks are
 * tabs, the rest is in the "More" menu. ("Balances" is now "Settle up".)
 */
const TABS: Record<
  GroupTab,
  { path: string; label: string; inMoreMenu: boolean }
> = {
  Home: { path: '', label: 'Home', inMoreMenu: false },
  Expenses: { path: 'expenses', label: 'Expenses', inMoreMenu: false },
  Balances: { path: 'settlements', label: 'Settle up', inMoreMenu: false },
  Stats: { path: 'stats', label: 'Statistics', inMoreMenu: false },
  Information: { path: 'information', label: 'Group info', inMoreMenu: true },
  Members: { path: 'members', label: 'Participants', inMoreMenu: true },
  Activity: { path: 'activity', label: 'Activity', inMoreMenu: true },
  Settings: { path: 'edit', label: 'Group settings', inMoreMenu: true },
}

// Regexes, not literals: the labels are "Unevenly – By shares" with an en dash.
const SPLIT_MODE_LABELS: Record<SplitMode, RegExp> = {
  EVENLY: /^Evenly$/,
  BY_SHARES: /By shares/,
  BY_PERCENTAGE: /By percentage/,
  BY_AMOUNT: /By amount/,
}

/**
 * GroupForm ships with one participant row pre-filled: the signed-in user, who
 * becomes the group's first participant (and owner). Its name can be edited,
 * so `participants[0]` of a test is always "me".
 */
const PREFILLED_PARTICIPANTS = 1

/**
 * The expenses list URL.
 *
 * Anchored deliberately: an unanchored /groups/<id>/expenses also matches
 * /groups/<id>/expenses/create, so waiting on it would return instantly while
 * still sitting on the form and let assertions run before the write landed.
 */
export const EXPENSES_URL = /\/groups\/[^/]+\/expenses(\?|$)/

/**
 * Where saving an expense lands: the group home (which lists the latest
 * expenses), or the expenses list. Anchored for the same reason as above.
 */
export const AFTER_SAVE_URL =
  /\/groups\/(?!create(\?|$))[^/]+(\/expenses)?(\?|$)/

/** A group's home page (not /groups/create). */
export const GROUP_HOME_URL =
  /\/groups\/(?!create(\?|$)|import(\?|$))[^/]+(\?|$)/

/** Short random suffix so group names are unique on the shared database. */
export function uniqueSuffix(): string {
  return Math.random().toString(36).slice(2, 8)
}

export async function createGroup(
  page: Page,
  opts: {
    name: string
    participants: string[]
    /** Email invites, by participant name (not the creator). */
    emails?: Record<string, string>
  },
): Promise<string> {
  await page.goto('/groups/create')

  // fillStable doubles as the hydration gate: once RHF keeps a value, React is
  // live and later clicks are safe.
  await fillStable(page.locator('input[name="name"]'), opts.name)

  for (let i = PREFILLED_PARTICIPANTS; i < opts.participants.length; i++) {
    await page.getByRole('button', { name: 'Add participant' }).click()
    await expect(
      page.locator(`input[name="participants.${i}.name"]`),
    ).toBeVisible()
  }

  for (let i = 0; i < opts.participants.length; i++) {
    await fillStable(
      page.locator(`input[name="participants.${i}.name"]`),
      opts.participants[i],
    )
    const email = opts.emails?.[opts.participants[i]]
    if (email)
      await fillStable(
        page.locator(`input[name="participants.${i}.email"]`),
        email,
      )
  }

  await page.getByRole('button', { name: 'Create', exact: true }).click()
  await page.waitForURL(GROUP_HOME_URL, { timeout: 30_000 })

  const groupId = /\/groups\/([^/?]+)/.exec(page.url())
  if (!groupId) throw new Error(`Could not read group id from ${page.url()}`)
  return groupId[1]
}

export async function addExpense(
  page: Page,
  groupId: string,
  expense: {
    title: string
    /** As typed, e.g. '90' or '12.34'. */
    amount: string
    /** Participant name. */
    paidBy: string
    /** Participant names. Omit to leave every participant checked. */
    paidFor?: string[]
    splitMode?: SplitMode
    /** Participant name -> share value. Set one for every checked participant. */
    shares?: Record<string, string>
    /** YYYY-MM-DD. Defaults to today. */
    date?: string
    /** Visible category name, e.g. 'Groceries'. Defaults to General. */
    category?: string
    /** Visible label: 'None' | 'Daily' | 'Weekly' | 'Monthly'. Defaults to None. */
    recurrence?: Recurrence
    notes?: string
  },
): Promise<void> {
  await page.goto(`/groups/${groupId}/expenses/create`)

  // CreateExpenseForm returns null until its tRPC queries resolve, so the
  // submit button appearing means both hydrated and data-ready.
  const submit = page.getByRole('button', { name: 'Create', exact: true })
  await expect(submit).toBeVisible({ timeout: 30_000 })

  await fillStable(page.locator('input[name="title"]'), expense.title)
  // Amount before split mode: BY_AMOUNT re-distributes shares whenever the
  // amount changes, which would wipe values set beforehand.
  await fillStable(page.locator('input[name="amount"]'), expense.amount)
  await selectRadixOption(page, page.getByTestId('paid-by'), expense.paidBy)

  if (expense.date) {
    // The date input spreads no RHF field, so it has no name attribute.
    await fillStable(page.locator('input[type="date"]'), expense.date)
  }

  if (expense.category || expense.recurrence || expense.notes)
    await openMoreOptions(page)

  if (expense.category) {
    // A cmdk Command in a Popover, not a Radix Select, but the trigger is still
    // role=combobox and the items are still role=option.
    await selectRadixOption(
      page,
      fieldByLabel(page, 'Category').getByRole('combobox'),
      expense.category,
    )
  }

  if (expense.recurrence) {
    await selectRadixOption(
      page,
      fieldByLabel(page, 'Expense Recurrence').getByRole('combobox'),
      expense.recurrence,
    )
  }

  if (expense.notes) {
    await fillStable(page.locator('textarea[name="notes"]'), expense.notes)
  }

  if (expense.paidFor) {
    const wanted = expense.paidFor
    const rows = await page.locator('[data-id]').all()
    for (const row of rows) {
      const label = (await row.innerText()).split('\n')[0].trim()
      const name = label.replace(/\s*\(.*\)$/, '')
      await setChecked(row.getByRole('checkbox'), wanted.indexOf(name) !== -1)
    }
  }

  const splitMode = expense.splitMode ?? 'EVENLY'
  if (splitMode !== 'EVENLY') {
    // Radix Collapsible unmounts its content, so the Split mode select does
    // not exist in the DOM until this is opened.
    await page
      .getByRole('button', { name: /Advanced splitting options/ })
      .click()
    await selectRadixOption(
      page,
      page.getByTestId('split-mode'),
      SPLIT_MODE_LABELS[splitMode],
    )
  }

  if (expense.shares) {
    // Set every participant's share, not just the ones being changed: under
    // BY_AMOUNT the form auto-distributes to whoever has not been edited yet.
    const shares = expense.shares
    const names = Object.keys(shares)
    for (const name of names) {
      await fillStable(
        paidForRow(page, name).getByRole('textbox'),
        shares[name],
      )
    }
  }

  await submit.click()
  await page.waitForURL(AFTER_SAVE_URL, { timeout: 30_000 })
}

/**
 * Unfolds "More options" on the expense form (category, currency, repeat,
 * notes, receipts). It is closed for a new expense, and open when editing one
 * that already uses an option.
 */
export async function openMoreOptions(page: Page): Promise<void> {
  const trigger = page.getByRole('button', { name: /^More options/ })
  if ((await trigger.getAttribute('aria-expanded')) !== 'true')
    await trigger.click()
  await expect(trigger).toHaveAttribute('aria-expanded', 'true')
}

export async function openTab(page: Page, tab: GroupTab): Promise<void> {
  const { path, label, inMoreMenu } = TABS[tab]
  const url = new RegExp(
    path ? `/groups/[^/]+/${path}(\\?|$)` : `/groups/[^/]+(\\?|$)`,
  )
  await clickUntil(
    async () => {
      // Wide screens show every page in a sidebar instead of tabs.
      const sideNav = page.getByTestId('group-side-nav')
      if (await sideNav.isVisible()) {
        await sideNav.getByRole('link', { name: label, exact: true }).click()
      } else if (inMoreMenu) {
        // Labelled "More", or with the current page's name when already on
        // one of its pages.
        await page
          .getByRole('button', {
            name: /^(More|Group info|Participants|Activity|Group settings)$/,
          })
          .click()
        await page.getByRole('menuitem', { name: label, exact: true }).click()
      } else {
        await page.getByRole('tab', { name: label, exact: true }).click()
      }
    },
    () => page.waitForURL(url, { timeout: 5_000 }),
  )
}

/** Opens an expense for editing. The card is a div with onClick, not a link. */
export async function openExpense(page: Page, title: string): Promise<void> {
  await clickUntil(
    () =>
      page
        .getByTestId('expense-card')
        .filter({ hasText: title })
        .first()
        .click(),
    () => page.waitForURL(/\/expenses\/[^/]+\/edit/, { timeout: 5_000 }),
  )
}

/**
 * A "Paid for" row on the expense form. Scoped by the checkbox's accessible
 * name because the share inputs inside these rows share a duplicated id and
 * carry no name attribute -- the row is the only way to tell them apart.
 */
export function paidForRow(page: Page, participant: string): Locator {
  return page.locator('[data-id]').filter({
    has: page.getByRole('checkbox', {
      name: new RegExp(`^${escapeRegExp(participant)}\\b`),
    }),
  })
}

/** The group's invite token, as a member sees it in the share popover. */
export async function getInviteToken(
  page: Page,
  groupId: string,
): Promise<string> {
  const input = encodeURIComponent(JSON.stringify({ json: { groupId } }))
  const response = await page.request.get(
    `/api/trpc/groups.invites.get?input=${input}`,
  )
  expect(response.ok()).toBeTruthy()
  return (await response.json()).result.data.json.token
}

/**
 * Joins a group through its invite link as `participant`: the existing
 * participant of that name, picked explicitly on the join screen.
 */
export async function joinGroup(
  page: Page,
  token: string,
  participant: string,
): Promise<void> {
  await page.goto(`/invite/${token}`)
  await page.getByLabel(participant, { exact: true }).click()
  await page.getByRole('button', { name: 'Join the group' }).click()
  await page.waitForURL(GROUP_HOME_URL, { timeout: 30_000 })
}

/** An expense row in the list. */
export function expenseCard(page: Page, title: string): Locator {
  return page.getByTestId('expense-card').filter({ hasText: title })
}

/** YYYY-MM-DD, n days before today. The suite pins the timezone to UTC. */
export function daysAgo(n: number): string {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() - n)
  return date.toISOString().slice(0, 10)
}

export function balanceRow(page: Page, participant: string): Locator {
  return page.locator(
    `[data-testid="balance-row"][data-participant="${participant}"]`,
  )
}

/**
 * Checks a member's result on the Settle up page, which is written out in
 * words: "Receives $50.00", "Sends $10.00" or "Settled".
 */
export async function expectBalance(
  page: Page,
  participant: string,
  amount: number,
): Promise<void> {
  const label = balanceRow(page, participant).getByTestId('balance-label')
  if (amount > 0) await expect(label).toHaveText(`Receives ${money(amount)}`)
  else if (amount < 0) await expect(label).toHaveText(`Sends ${money(-amount)}`)
  else await expect(label).toHaveText('Settled')
}

export function reimbursementRow(
  page: Page,
  from: string,
  to: string,
): Locator {
  return page.locator(
    `[data-testid="reimbursement-row"][data-from="${from}"][data-to="${to}"]`,
  )
}
