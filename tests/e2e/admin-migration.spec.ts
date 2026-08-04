import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { signIn } from './helpers'
import { clearRateLimits, unlockAccounts } from './rate-limit'

/**
 * The previous-participant migration, as an administrator meets it.
 *
 * These sign in as the seeded super administrator rather than creating one:
 * granting migration permissions is itself a privileged operation, and a test
 * that could mint an administrator would be a worse thing to have in the
 * repository than the coverage is worth.
 *
 * The whole suite is skipped when those credentials are not configured, so a
 * contributor without the seed data still gets a green run rather than a wall
 * of failures about a fixture they were never told about.
 */
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@mmpraise.org'
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe!2026'

async function signInAsAdmin(page: Page) {
  await clearRateLimits()
  await unlockAccounts()
  await signIn(page, ADMIN_EMAIL, ADMIN_PASSWORD)
  await expect(page).toHaveURL(/\/(dashboard|admin|apply)/, { timeout: 30_000 })
}

test.describe('previous participants', () => {
  test.beforeEach(async ({ page }) => {
    await signInAsAdmin(page)
    await page.goto('/admin/previous-participants')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 30_000 })
  })

  test('is reachable from the grouped navigation under People', async ({ page }) => {
    const nav = page.getByRole('navigation', { name: /administration/i })
    await expect(nav.getByRole('link', { name: /previous participants/i })).toBeVisible()

    /*
     * Reference data is gone from the top level and RCCG structure now sits
     * under Configuration — the audit's point being that something edited twice
     * a year should not share a level with the daily review queue.
     */
    await expect(nav.getByRole('link', { name: /^reference data$/i })).toHaveCount(0)
    await expect(nav.getByRole('link', { name: /rccg structure/i })).toBeVisible()
  })

  test('explains what happens to an uploaded file before anything is chosen', async ({ page }) => {
    await page.goto('/admin/previous-participants/new')

    // The three promises the security model rests on, stated where the file is
    // handed over rather than buried in documentation nobody opens.
    const notice = page.getByText(/what happens to this file/i)
    await expect(notice).toBeVisible()
    await expect(page.getByText(/deleted 30 days after the import finishes/i)).toBeVisible()
    await expect(page.getByText(/no password is ever imported, generated or emailed/i)).toBeVisible()
  })

  test('labels every field in the upload form', async ({ page }) => {
    await page.goto('/admin/previous-participants/new')

    const unlabelled = await page.evaluate(() =>
      [...document.querySelectorAll('form input:not([type=hidden]), form textarea, form select')]
        .filter(
          (el) =>
            !(el as HTMLInputElement).labels?.length &&
            !el.getAttribute('aria-label') &&
            !el.closest('[aria-hidden]'),
        )
        .map((el) => el.id || el.getAttribute('name')),
    )
    expect(unlabelled).toEqual([])
  })

  test('refuses a file that is not a CSV, without losing what was typed', async ({ page }) => {
    await page.goto('/admin/previous-participants/new')

    await page.locator('#upload-name').fill('Not a spreadsheet')
    await page.locator('#upload-sourceEdition').fill('2024 edition')
    await page.locator('#upload-file').setInputFiles({
      name: 'notes.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('this is not a csv'),
    })
    await page.getByRole('button', { name: /upload and continue/i }).click()

    await expect(page.getByText(/save your spreadsheet as csv/i)).toBeVisible({ timeout: 20_000 })
    // Still on the form, still holding the answers.
    await expect(page).toHaveURL(/previous-participants\/new/)
    await expect(page.locator('#upload-name')).toHaveValue('Not a spreadsheet')
  })

  test('has no detectable accessibility violations', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })

    for (const path of ['/admin/previous-participants', '/admin/previous-participants/new']) {
      await page.goto(path, { waitUntil: 'networkidle' })
      const results = await new AxeBuilder({ page }).analyze()
      expect(JSON.stringify({ path, violations: results.violations }, null, 2)).toBe(
        JSON.stringify({ path, violations: [] }, null, 2),
      )
    }
  })

  test('has no horizontal overflow at any supported width', async ({ page }) => {
    for (const width of [320, 375, 768, 1024, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 })
      for (const path of ['/admin/previous-participants', '/admin/previous-participants/new']) {
        await page.goto(path)
        const overflows = await page.evaluate(
          () => document.documentElement.scrollWidth > window.innerWidth,
        )
        expect(overflows, `${path} overflows at ${width}px`).toBe(false)
      }
    }
  })
})
