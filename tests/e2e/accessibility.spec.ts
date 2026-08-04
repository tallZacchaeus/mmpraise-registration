import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { clearRateLimits, unlockAccounts } from './rate-limit'
import { continueStep, newVolunteer, signUp } from './helpers'

/**
 * Automated WCAG 2.1 AA checks.
 *
 * Automated tooling catches roughly a third of accessibility defects; these
 * complement the manual keyboard and screen-reader checks listed in
 * docs/TESTING.md rather than replacing them.
 */
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']

/**
 * Scan a page once it has stopped changing.
 *
 * `goto` resolves on `load`, which is before React has hydrated. Scanning then
 * catches elements mid-transition and reports contrast against a blended
 * colour — greys reading 2.54:1 that measure 6.90:1 once settled. Waiting for
 * the network to go idle is what makes the result reproducible.
 */
async function visit(page: import('@playwright/test').Page, path: string) {
  // Nothing animates under this setting, so every element is at its final
  // opacity from the first frame — and it is a real user preference the page
  // must be fully accessible in, so it is the right state to assert.
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto(path, { waitUntil: 'networkidle' })
  /*
   * A short settle on top of `networkidle`.
   *
   * Under a loaded development server the idle window can open while React is
   * still hydrating, and axe then measures a colour blended against the page
   * background — `text-muted` reading 4.35:1 where it measures 6.90:1 once
   * settled. Verified directly: with reduced motion on a quiet server every
   * animated block reports opacity 1 immediately and there are no violations.
   */
  await page.waitForTimeout(400)
}

async function scan(page: import('@playwright/test').Page) {
  return new AxeBuilder({ page }).withTags(TAGS).analyze()
}

/**
 * Scanned with reduced motion requested.
 *
 * Sections fade in from `opacity: 0`, and axe measuring mid-flight reads the
 * blended colour against the page background — grey-on-white at 4.42:1, or
 * near-white at 1.09:1 — and reports contrast failures that do not exist once
 * the page has settled. Waiting for the animation is unreliable, because the
 * wait can succeed in the window between hydration and GSAP starting.
 *
 * Under `prefers-reduced-motion` nothing animates at all, so every element is
 * at its final opacity from the first frame. That is deterministic, and it is
 * a real user setting the page must be fully accessible in — so this is the
 * state worth asserting, not a compromise.
 */
test.describe('accessibility', () => {
  // Rate limiting is per IP; the whole suite shares one.
  test.beforeEach(async () => {
    await clearRateLimits()
    await unlockAccounts()
  })

  test('public pages have no detectable violations', async ({ page }) => {
    for (const path of ['/', '/login', '/register', '/forgot-password', '/terms', '/privacy']) {
      await visit(page, path)
      const results = await scan(page)
      expect(results.violations, `${path}: ${JSON.stringify(results.violations, null, 2)}`).toEqual([])
    }
  })

  test('every wizard step has no detectable violations', async ({ page }) => {
    await signUp(page, newVolunteer('a11y'))

    for (const step of [
      'personal',
      'location',
      'professional',
      'church',
      'department',
      'availability',
      'motivation',
      'review',
    ]) {
      await page.goto(`/apply/${step}`)
      const results = await scan(page)
      expect(results.violations, `${step}: ${JSON.stringify(results.violations, null, 2)}`).toEqual([])
    }
  })

  test('the volunteer dashboard has no detectable violations', async ({ page }) => {
    await signUp(page, newVolunteer('a11y-dash'))

    /*
     * `visit`, not a bare `goto`. The dashboard hero now has a GSAP entrance,
     * and a scan that lands mid-tween measures the status pill blended against
     * the dark band behind it — 1.53:1 for a colour pairing that settles at
     * 12.27:1. Reduced motion applies the final state on the first frame, which
     * is both reproducible and a state the page genuinely has to be accessible
     * in.
     */
    await visit(page, '/dashboard')
    expect((await scan(page)).violations).toEqual([])

    await visit(page, '/dashboard/account')
    expect((await scan(page)).violations).toEqual([])
  })

  test('the wizard is operable by keyboard alone', async ({ page }) => {
    await signUp(page, newVolunteer('keyboard'))
    await page.goto('/apply/personal')

    // Tab into the form and confirm focus is always visible somewhere sensible.
    await page.keyboard.press('Tab')
    const firstFocused = await page.evaluate(() => document.activeElement?.tagName)
    expect(firstFocused).toBeTruthy()

    // The skip link is the first stop and moves focus to the main region.
    await page.goto('/apply/personal')
    await page.keyboard.press('Tab')
    const skip = page.getByRole('link', { name: /skip to main content/i })
    await expect(skip).toBeFocused()
  })

  test('validation errors are announced and linked to their fields', async ({ page }) => {
    await signUp(page, newVolunteer('a11y-errors'))
    await page.goto('/apply/personal')
    await continueStep(page)

    const summary = page.getByRole('alert').first()
    await expect(summary).toBeVisible()

    // Each message links to the field it refers to.
    const links = summary.getByRole('link')
    expect(await links.count()).toBeGreaterThan(0)
    const href = await links.first().getAttribute('href')
    expect(href).toMatch(/^#field-/)
  })
})
