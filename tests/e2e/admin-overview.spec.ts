import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { signIn } from './helpers'
import { clearRateLimits, unlockAccounts } from './rate-limit'

/**
 * The admin command centre.
 *
 * Signs in as the seeded super administrator, so the run needs the seeded
 * database (`npm run db:seed`) — the same requirement every admin flow has.
 */
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@mmpraise.org'
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe!2026'

test.describe('admin overview', () => {
  test.beforeEach(async ({ page }) => {
    await clearRateLimits()
    await unlockAccounts()
    await signIn(page, ADMIN_EMAIL, ADMIN_PASSWORD)
    await expect(page).toHaveURL(/\/(dashboard|admin)/, { timeout: 30_000 })
    await page.goto('/admin')
    await expect(page.getByRole('heading', { level: 1, name: /overview/i })).toBeVisible({
      timeout: 30_000,
    })
  })

  test('opens with the needs-attention queue, then the event state', async ({ page }) => {
    // The first card answers "is anything on fire?" — either queues or the
    // all-clear sentence, never silence.
    const attention = page.getByRole('heading', { name: /needs attention/i })
    await expect(attention).toBeVisible()

    await expect(page.getByText(/registration (open|closed)/i)).toBeVisible()
    // The countdown is the shared clock at operational size, minutes not seconds.
    await expect(page.getByText(/days/i).first()).toBeVisible()
  })

  test('reports the two lifecycles separately', async ({ page }) => {
    /*
     * The registration/participation split, visible: one-time standing and
     * this edition's participation are different questions with different
     * numbers, and conflating them again on the dashboard would undo the model.
     */
    await expect(page.getByRole('heading', { name: /^registrations$/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: /\d{4} participation/i })).toBeVisible()
    await expect(page.getByText(/not yet confirmed/i).first()).toBeVisible()
  })

  test('every actionable metric is a link to the view that resolves it', async ({ page }) => {
    await expect(
      page.getByRole('link', { name: /awaiting review/i }).first(),
    ).toHaveAttribute('href', /\/admin\/applications\?status=SUBMITTED/)

    const hrefs = await page
      .locator('main a[href]')
      .evaluateAll((nodes) => nodes.map((n) => n.getAttribute('href') ?? ''))
    for (const href of hrefs) {
      expect(href).not.toBe('#')
      expect(href).not.toBe('')
    }
  })

  test('shows migration and communications sections to a super administrator', async ({ page }) => {
    // Scoped to main: the sidebar has group headings with the same names.
    const main = page.locator('main')
    await expect(main.getByRole('heading', { name: /previous participants/i })).toBeVisible()
    await expect(main.getByRole('heading', { name: /communications/i })).toBeVisible()
    await expect(main.getByRole('heading', { name: /recent activity/i })).toBeVisible()
  })

  test('never shows department capacity anywhere', async ({ page }) => {
    const body = await page.locator('main').innerText()
    expect(body).not.toMatch(/\d+\s*\/\s*\d+ places/i)
    expect(body).not.toMatch(/\bfull\b/i)
    await expect(page.getByText(/departments have no cap/i)).toBeVisible()
  })


  /*
   * The drill-through. A distribution bar that reports a number and cannot
   * tell you who is behind it is a dead end, so each row links into the
   * applicant list with that filter applied.
   *
   * The count is the contract: both sides exclude DRAFT and both reach
   * department through this edition's participation, so the figure on the
   * card must be the figure on the list. A mismatch here means the two
   * queries have drifted apart, which is exactly the bug this asserts against.
   */
  test('every distribution row opens the volunteers behind it, and the count agrees', async ({
    page,
  }) => {
    const rows = page.locator(
      'a[href*="/admin/applications?departmentId="], a[href*="/admin/applications?countryId="], a[href*="/admin/applications?ageRange="]',
    )
    await expect(rows.first()).toBeVisible()

    const first = rows.first()
    // The bar is decorative, so the figure has to live in the accessible name.
    const label = await first.getAttribute('aria-label')
    expect(label).toMatch(/: \d+\. View these volunteers\./)
    const claimed = Number(/: (\d+)\./.exec(label ?? '')?.[1])
    expect(claimed).toBeGreaterThan(0)

    await first.click()
    await expect(page).toHaveURL(/\/admin\/applications\?/, { timeout: 30_000 })
    await expect(page.getByText(`${claimed} application`)).toBeVisible({ timeout: 30_000 })
  })

  test('a segment with nobody in it is not offered as a link', async ({ page }) => {
    // "No department yet" and an unknown country cannot be expressed as a
    // filter, so they stay plain text rather than linking to nothing.
    const deadEnds = page.getByText(/no department yet|^unknown$/i)
    for (const text of await deadEnds.all()) {
      await expect(text.locator('xpath=ancestor::a')).toHaveCount(0)
    }
  })

  test('has no detectable accessibility violations', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/admin', { waitUntil: 'networkidle' })
    const results = await new AxeBuilder({ page }).analyze()
    expect(JSON.stringify(results.violations, null, 2)).toBe('[]')
  })

  test('has no horizontal overflow at any supported width', async ({ page }) => {
    for (const width of [320, 375, 768, 1024, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 })
      await page.goto('/admin')
      const overflows = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      )
      expect(overflows, `overflow at ${width}px`).toBe(false)
    }
  })
})
