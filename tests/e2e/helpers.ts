import { expect, type Page } from '@playwright/test'

/**
 * Locators target element ids rather than label text.
 *
 * Accessible names are deliberately verbose in this app ("Password (required)",
 * and a "Show password" toggle sits inside the same field), which makes text
 * lookups ambiguous. Ids are stable and unambiguous, and the labels themselves
 * are asserted separately by the accessibility suite.
 */
export function newVolunteer(prefix = 'e2e') {
  const stamp = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`
  // Build the phone from a decimal clock, not from `stamp`: base-36 is mostly
  // letters, so stripping non-digits left only two or three of them and the
  // rest was padding. Phone numbers are unique in the database, so those few
  // combinations were exhausted after a handful of suite runs and later runs
  // failed on a duplicate. Milliseconds plus four random digits is unique in
  // practice, and every character is a real digit.
  const digits = `${Date.now()}`.slice(-4) + `${Math.floor(Math.random() * 1e4)}`.padStart(4, '0')
  return {
    firstName: 'Test',
    lastName: 'Volunteer',
    email: `${prefix}.${stamp}@example.com`,
    // Set explicitly rather than relying on the name-derived suggestion, which
    // would collide between runs.
    username: `${prefix}${stamp}`.toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 30),
    password: 'Praise2026!',
    phoneLocal: `80${digits}`.slice(0, 10),
  }
}

export async function signUp(page: Page, volunteer: ReturnType<typeof newVolunteer>) {
  await page.goto('/register')
  await page.locator('#signup-firstName').fill(volunteer.firstName)
  await page.locator('#signup-lastName').fill(volunteer.lastName)
  await page.locator('#signup-email').fill(volunteer.email)
  await page.locator('#signup-username').fill(volunteer.username)
  await page.locator('#signup-password').fill(volunteer.password)
  await page.locator('#signup-confirmPassword').fill(volunteer.password)
  await page.locator('form input[type="checkbox"]').first().check()
  await page.getByRole('button', { name: /create account/i }).click()
  // Server Action redirects navigate client-side, so no `load` event fires —
  // assert on the URL rather than waiting for a navigation lifecycle event.
  await expect(page).toHaveURL(/\/apply\/personal/, { timeout: 30_000 })
}

export async function signIn(page: Page, identifier: string, password: string) {
  await page.goto('/login')
  await page.locator('#identifier').fill(identifier)
  await page.locator('#password').fill(password)
  await page.getByRole('button', { name: /^sign in$/i }).click()
}

export async function signOut(page: Page) {
  await page.getByRole('button', { name: /sign out/i }).click()
  await expect(page).toHaveURL(/\/login/, { timeout: 30_000 })
}

/** Type into a searchable combobox and choose the first matching option. */
export async function pickFromCombobox(page: Page, id: string, text: string) {
  const input = page.locator(`#${id}`)
  await input.click()
  await input.fill(text)
  const option = page.getByRole('option', { name: new RegExp(`^${escapeRegExp(text)}`, 'i') }).first()
  await option.waitFor({ state: 'visible', timeout: 15_000 })
  await option.click()
  await expect(input).toHaveAttribute('aria-expanded', 'false')
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Click the step's own submit button, never the header's sign-out button. */
export async function continueStep(page: Page) {
  await page.getByRole('button', { name: /save and continue$/i }).click()
}

export async function expectStep(page: Page, slug: string) {
  await expect(page).toHaveURL(new RegExp(`/apply/${slug}`), { timeout: 30_000 })
}
