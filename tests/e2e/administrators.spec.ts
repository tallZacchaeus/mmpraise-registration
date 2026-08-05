import { expect, test } from '@playwright/test'
import { signIn } from './helpers'
import { clearRateLimits, unlockAccounts } from './rate-limit'
import { seedAdmin } from './seed-user'

/**
 * Administrator management.
 *
 * Every action here was a database operation before this slice: granting one
 * permission, suspending somebody for a fortnight, or answering "who made this
 * person a reviewer?". Each test uses its own seeded administrator, because
 * doing any of it to yourself is refused — deliberately.
 */
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@mmpraise.org'
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe!2026'

test.describe('administrators', () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await clearRateLimits()
    await unlockAccounts()
    await signIn(page, ADMIN_EMAIL, ADMIN_PASSWORD)
    await expect(page).toHaveURL(/\/(dashboard|admin)/, { timeout: 30_000 })
  })

  test('finds an administrator by name and shows what their role grants', async ({ page }) => {
    const admin = await seedAdmin('REVIEWER')

    await page.goto(`/admin/users?q=${encodeURIComponent(admin.username)}`)
    // Rows are labelled by the person's name and email, not their username.
    await page.getByRole('link', { name: new RegExp(admin.email, 'i') }).first().click()

    await expect(page).toHaveURL(/\/admin\/users\/[a-z0-9_]+/, { timeout: 20_000 })
    await expect(page.getByText('Reviewer', { exact: true }).first()).toBeVisible()

    // A reviewer can read applications but cannot decide outcomes — the matrix
    // states both, rather than leaving it to be inferred from the role name.
    const viewRow = page.locator('tr').filter({ hasText: 'application:view_all' })
    await expect(viewRow.getByText('Allowed', { exact: true })).toBeVisible()
    const decideRow = page.locator('tr').filter({ hasText: 'application:decide' })
    await expect(decideRow.getByText('Not allowed', { exact: true })).toBeVisible()
  })

  test('grants one permission to one person without inventing a role', async ({ page }) => {
    const admin = await seedAdmin('REVIEWER')

    await page.goto(`/admin/users/${admin.id}`)
    await page.getByLabel('application:export', { exact: true }).selectOption('grant')

    const exportRow = page.locator('tr').filter({ hasText: 'application:export' })
    await expect(exportRow.getByText('Allowed (added)')).toBeVisible({ timeout: 20_000 })

    // And it is recorded against the person, with who did it.
    await expect(page.getByText('application:export').last()).toBeVisible()
    await expect(page.getByText(/superadmin/i).first()).toBeVisible()
  })

  test('withdraws a permission a role would otherwise grant', async ({ page }) => {
    const admin = await seedAdmin('REVIEWER')

    await page.goto(`/admin/users/${admin.id}`)
    await page.getByLabel('application:note', { exact: true }).selectOption('revoke')

    const noteRow = page.locator('tr').filter({ hasText: 'application:note' })
    await expect(noteRow.getByText('Blocked', { exact: true })).toBeVisible({ timeout: 20_000 })
  })

  test('suspends administrative access until a date, and lifts it again', async ({ page }) => {
    const admin = await seedAdmin('REVIEWER')
    const nextYear = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 16)

    await page.goto(`/admin/users/${admin.id}`)
    await page.locator('#suspend-until').fill(nextYear)
    await page.getByRole('button', { name: /^suspend$/i }).click()

    await expect(page.getByText(/access returns by itself/i)).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText(/suspended until/i).first()).toBeVisible()

    await page.getByRole('button', { name: /lift suspension/i }).click()
    // Both the confirmation and the new history entry say it; the confirmation
    // is the one with the full stop.
    await expect(page.getByText('Suspension lifted.', { exact: true })).toBeVisible({
      timeout: 20_000,
    })
    await expect(page.getByText('Active', { exact: true })).toBeVisible()
  })

  test('a suspended administrator loses the admin area but keeps their dashboard', async ({
    page,
    browser,
  }) => {
    const admin = await seedAdmin('REGISTRATION_ADMIN')
    const soon = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 16)

    await page.goto(`/admin/users/${admin.id}`)
    await page.locator('#suspend-until').fill(soon)
    await page.getByRole('button', { name: /^suspend$/i }).click()
    await expect(page.getByText(/access returns by itself/i)).toBeVisible({ timeout: 20_000 })

    const context = await browser.newContext()
    const theirPage = await context.newPage()
    try {
      await theirPage.emulateMedia({ reducedMotion: 'reduce' })
      await signIn(theirPage, admin.email, admin.password)
      await expect(theirPage).toHaveURL(/\/dashboard/, { timeout: 30_000 })

      // The volunteer side is untouched; the administration side is closed.
      await theirPage.goto('/admin/applications')
      await expect(theirPage).toHaveURL(/\/dashboard/, { timeout: 20_000 })
    } finally {
      await context.close()
    }
  })

  test('role changes are recorded with who made them', async ({ page }) => {
    const admin = await seedAdmin('REVIEWER')

    await page.goto(`/admin/users/${admin.id}`)
    await page.getByRole('checkbox', { name: /communication officer/i }).check()
    await page.getByRole('button', { name: /update roles/i }).click()

    await expect(page.getByText(/roles updated for/i)).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText('Given', { exact: true }).first()).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText(/communication officer/i).first()).toBeVisible()
  })

  test('you cannot widen your own permissions', async ({ page }) => {
    await page.goto(`/admin/users?q=${encodeURIComponent(ADMIN_EMAIL)}`)
    await page.getByRole('link', { name: new RegExp(ADMIN_EMAIL, 'i') }).first().click()

    await expect(page.getByText(/these are your own permissions/i)).toBeVisible()
    await expect(page.getByLabel('application:export', { exact: true })).toBeDisabled()
    await expect(page.getByText(/cannot suspend or disable your own/i)).toBeVisible()
  })
})
