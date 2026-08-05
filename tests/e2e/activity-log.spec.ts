import { expect, test } from '@playwright/test'
import { signIn } from './helpers'
import { clearRateLimits, unlockAccounts } from './rate-limit'

/**
 * The activity log.
 *
 * Signing in is itself an audited action, so every test arrives with a fresh
 * entry of its own already at the top — no seeding needed.
 */
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@mmpraise.org'
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe!2026'

test.describe('activity log', () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await clearRateLimits()
    await unlockAccounts()
    await signIn(page, ADMIN_EMAIL, ADMIN_PASSWORD)
    await expect(page).toHaveURL(/\/(dashboard|admin)/, { timeout: 30_000 })
    await page.goto('/admin/audit')
  })

  test('reads as sentences, not action codes', async ({ page }) => {
    // The sign-in that got us here.
    await expect(page.getByText(/signed in/i).first()).toBeVisible()
    await expect(page.getByText('superadmin').first()).toBeVisible()

    // The raw code is still available, one disclosure away.
    const entries = page.getByRole('list', { name: /activity entries/i })
    const first = entries.locator('> li').first()
    await first.getByText(/technical details/i).click()
    await expect(first.getByText('auth.login', { exact: true })).toBeVisible()
  })

  test('the security view keeps out the ordinary traffic', async ({ page }) => {
    await page.getByRole('link', { name: /security and compliance/i }).click()

    await expect(page).toHaveURL(/view=security/, { timeout: 20_000 })
    await expect(page.getByText(/reading personal data/i)).toBeVisible()
    // Signing in is not a compliance event, and it is the noisiest thing here.
    await expect(page.getByText(/^signed in$/i)).toHaveCount(0)
  })

  test('system events are the ones with nobody behind them', async ({ page }) => {
    await page.getByRole('link', { name: /system events/i }).click()

    await expect(page).toHaveURL(/view=system/, { timeout: 20_000 })
    await expect(page.getByText(/actions with no person behind them/i)).toBeVisible()
  })

  test('filters by who did it, and says when nothing matches', async ({ page }) => {
    await page.getByLabel('Who').fill('superadmin')
    await page.getByRole('button', { name: /apply/i }).click()
    await expect(page.getByText(/signed in/i).first()).toBeVisible({ timeout: 20_000 })

    await page.getByLabel('Who').fill('nobody-by-this-name')
    await page.getByRole('button', { name: /apply/i }).click()
    await expect(page.getByText(/no activity matches these filters/i)).toBeVisible({
      timeout: 20_000,
    })

    await page.getByRole('link', { name: /^clear$/i }).click()
    await expect(page.getByText(/signed in/i).first()).toBeVisible({ timeout: 20_000 })
  })

  test('filters by area', async ({ page }) => {
    await page.getByLabel('Area').selectOption('access')
    await page.getByRole('button', { name: /apply/i }).click()

    await expect(page).toHaveURL(/category=access/, { timeout: 20_000 })
    // Scoped to the entries: the same words are also an <option> in the filter.
    const entries = page.getByRole('list', { name: /activity entries/i })
    await expect(entries.getByText('Sign-in and access').first()).toBeVisible()
  })

  test('a date range that excludes everything returns nothing, not everything', async ({ page }) => {
    await page.getByLabel('From').fill('2019-01-01')
    await page.getByLabel('To').fill('2019-01-02')
    await page.getByRole('button', { name: /apply/i }).click()

    await expect(page.getByText(/no activity matches these filters/i)).toBeVisible({
      timeout: 20_000,
    })
  })
})
