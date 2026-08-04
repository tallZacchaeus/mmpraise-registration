import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { signIn } from './helpers'
import { clearRateLimits, unlockAccounts } from './rate-limit'
import { seedVolunteer, type SeededVolunteer } from './seed-user'

/**
 * The volunteer dashboard.
 *
 * The fixture account is written straight to the database rather than created
 * through the sign-up form — see tests/e2e/seed-user.ts for why. Each test then
 * signs in to it, so the state under test is the one a volunteer actually meets
 * first: a draft with nothing saved.
 *
 * The later phases of the journey — approved, assigned, rejected, finished —
 * are covered by tests/unit/volunteer-journey.test.ts, which can be driven to
 * any point in the event's life without putting the database into a particular
 * shape.
 */
/*
 * Assigned in `beforeAll`, not at module scope. Playwright runs this file once
 * per project, and a module-level fixture would be shared between them.
 */
let volunteer: SeededVolunteer

test.describe('volunteer dashboard', () => {
  test.beforeAll(async () => {
    volunteer = await seedVolunteer('dash')
  })

  test.beforeEach(async ({ page }) => {
    await clearRateLimits()
    await unlockAccounts()
    await signIn(page, volunteer.email, volunteer.password)
    await expect(page).toHaveURL(/\/(dashboard|apply)/, { timeout: 30_000 })
    await page.goto('/dashboard')
    /*
     * Wait for the dashboard itself, not just for `load`.
     *
     * Signing in redirects client-side, so a `goto` issued immediately after it
     * can race the redirect and leave assertions running against a document
     * that is being torn down — which surfaces as "main has no links" rather
     * than as anything resembling the real cause.
     */
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 30_000 })
  })

  test('opens with one heading, the phase and the single next action', async ({ page }) => {
    await expect(page.locator('h1')).toHaveCount(1)
    await expect(page.locator('h1')).toContainText(/welcome back/i)
    // The greeting and the phase headline are one accessible name; without the
    // trailing space they run together as "TestPick up where you left off".
    await expect(page.locator('h1')).toContainText(/welcome back, \w+ /i)

    // While the application is incomplete, registration is the only action in
    // the hero — a second button would be a second answer to "what now?".
    const hero = page.locator('section[aria-labelledby="dashboard-heading"]')
    const actions = hero.locator('[data-hero-action]')
    await expect(actions).toHaveCount(1)
    await expect(actions.first()).toHaveAttribute('href', '/apply')
    await expect(actions.first()).toContainText(/registration/i)
  })

  test('counts the sections finished and never claims more than were saved', async ({ page }) => {
    // Two bars, deliberately: a summary in the hero and the detailed one in the
    // registration card. Their accessible names say which is which.
    const summary = page.getByRole('progressbar', { name: /overall registration progress/i })
    const detail = page.getByRole('progressbar', { name: /registration sections complete/i })

    for (const bar of [summary, detail]) {
      await expect(bar).toBeVisible()
      // The account exists with an untouched draft, so the honest figure is 0.
      await expect(bar).toHaveAttribute('aria-valuenow', '0')
      await expect(bar).toHaveAttribute('aria-valuemax', '8')
    }

    await expect(page.getByText(/0 of 8 sections complete/i).first()).toBeVisible()
    // The section they are on, and the one after it.
    await expect(page.getByText(/section 1 · personal/i)).toBeVisible()
    await expect(page.getByText(/section 2 · location/i)).toBeVisible()
  })

  test('draws the journey as nine stages with a single current one', async ({ page }) => {
    const milestones = page.locator('li[data-milestone]')
    await expect(milestones).toHaveCount(9)
    await expect(page.locator('li[data-milestone][aria-current="step"]')).toHaveCount(1)

    // State is never carried by colour alone.
    await expect(milestones.first()).toContainText(/completed/i)
    await expect(milestones.nth(1)).toContainText(/in progress/i)
    await expect(milestones.nth(2)).toContainText(/not started yet/i)

    /*
     * Accommodation is not tracked by this platform at all. The stage must say
     * so rather than showing as "upcoming", which would promise a volunteer
     * that details are on their way to this page.
     */
    const accommodation = milestones.filter({ hasText: /accommodation/i })
    await expect(accommodation).toContainText(/not tracked here/i)
  })

  test('separates personal notifications from broadcast announcements', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /^notifications$/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: /^announcements$/i })).toBeVisible()

    // A brand-new account has real events already: it was created, and its
    // draft was saved. Those are derived from timestamps, not a second table.
    await expect(page.getByText(/account created/i).first()).toBeVisible()
    await expect(page.getByText(/no announcements yet/i)).toBeVisible()
  })

  test('hides cards that cannot mean anything yet', async ({ page }) => {
    // "No shifts assigned yet" tells someone with an unfinished form nothing
    // they can act on, so the card is not rendered at all before submission.
    await expect(page.getByRole('heading', { name: /your shifts/i })).toHaveCount(0)
  })

  test('answers the common questions from the keyboard alone', async ({ page }) => {
    const faqs = page.locator('#dashboard-faqs')
    await expect(faqs).toBeVisible()

    const questions = faqs.getByRole('button')
    await expect(questions).toHaveCount(6)

    const first = questions.first()
    await expect(first).toHaveAttribute('aria-expanded', 'false')
    await first.focus()
    await page.keyboard.press('Enter')
    await expect(first).toHaveAttribute('aria-expanded', 'true')

    // Opening one must not close another — they are independent.
    const second = questions.nth(1)
    await second.focus()
    await page.keyboard.press('Enter')
    await expect(first).toHaveAttribute('aria-expanded', 'true')
    await expect(second).toHaveAttribute('aria-expanded', 'true')
  })

  test('labels resources that do not exist yet instead of linking nowhere', async ({ page }) => {
    /*
     * The handbook and code of conduct have not been published. A volunteer is
     * better served knowing they are coming than by a row that 404s — or by no
     * row at all, which reads as "there is no handbook".
     */
    const handbook = page.getByText(/volunteer handbook/i).first()
    await expect(handbook).toBeVisible()
    await expect(page.getByText(/coming soon/i).first()).toBeVisible()
    await expect(page.getByRole('link', { name: /volunteer handbook/i })).toHaveCount(0)
  })

  test('counts down without duplicating the homepage clock', async ({ page }) => {
    const hero = page.locator('section[aria-labelledby="dashboard-heading"]')
    await expect(hero.getByText(/time until the first hour/i)).toBeVisible()

    // The digits tick, so they are hidden from assistive technology and one
    // sentence carries the same information instead.
    await expect(hero.locator('ul[aria-hidden="true"] li')).toHaveCount(4)
    await expect(
      hero.getByText(/begins on Monday, 1 March 2027 at 2:00 AM West Africa Time/i),
    ).toBeAttached()
  })

  test('keeps every control the previous dashboard offered', async ({ page }) => {
    await expect(page.getByRole('link', { name: /account settings/i }).first()).toHaveAttribute(
      'href',
      '/dashboard/account',
    )
    await expect(
      page.getByRole('link', { name: /continue registration/i }).first(),
    ).toHaveAttribute('href', /^\/apply\//)
    await expect(page.getByRole('link', { name: /contact support/i })).toHaveAttribute(
      'href',
      /^mailto:/,
    )
    // Nothing behind a launch flag is offered as a dead row.
    await expect(page.getByRole('link', { name: /about the marathon/i })).toBeVisible()
  })

  test('offers no link that goes nowhere, and marks the ones that leave', async ({ page }) => {
    const hrefs = await page
      .locator('main a[href]')
      .evaluateAll((nodes) => nodes.map((n) => n.getAttribute('href') ?? ''))
    expect(hrefs.length).toBeGreaterThan(0)
    for (const href of hrefs) {
      expect(href).not.toBe('#')
      expect(href).not.toBe('')
    }

    const unsafe = await page
      .locator('main a[target="_blank"]')
      .evaluateAll((nodes) => nodes.filter((n) => !n.getAttribute('rel')?.includes('noopener')))
    expect(unsafe).toHaveLength(0)
  })

  test('has no detectable accessibility violations', async ({ page }) => {
    // The entrance animation moves opacity through intermediate values, and a
    // contrast check that lands mid-tween reports a failure no real reader ever
    // sees. Reduced motion skips the animation entirely.
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/dashboard', { waitUntil: 'networkidle' })

    const results = await new AxeBuilder({ page }).analyze()
    expect(JSON.stringify(results.violations, null, 2)).toBe('[]')
  })

  test('has no horizontal overflow at any supported width', async ({ page }) => {
    for (const width of [320, 360, 375, 390, 430, 768, 1024, 1280, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 })
      await page.goto('/dashboard')
      const overflows = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      )
      expect(overflows, `horizontal overflow at ${width}px`).toBe(false)
    }
  })
})
