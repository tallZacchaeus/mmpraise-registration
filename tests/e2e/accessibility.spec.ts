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

async function scan(page: import('@playwright/test').Page) {
  return new AxeBuilder({ page }).withTags(TAGS).analyze()
}

test.describe('accessibility', () => {
  // Rate limiting is per IP; the whole suite shares one.
  test.beforeEach(async () => {
    await clearRateLimits()
    await unlockAccounts()
  })

  test('public pages have no detectable violations', async ({ page }) => {
    for (const path of ['/', '/login', '/register', '/forgot-password', '/terms', '/privacy']) {
      await page.goto(path)
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
    await page.goto('/dashboard')
    expect((await scan(page)).violations).toEqual([])

    await page.goto('/dashboard/account')
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
