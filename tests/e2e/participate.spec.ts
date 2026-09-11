import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { signIn } from './helpers'
import { clearRateLimits, unlockAccounts } from './rate-limit'
import { seedReturningVolunteer, type SeededVolunteer } from './seed-user'

/**
 * The returning volunteer's edition confirmation.
 *
 * The fixture is someone who registered and served in 2026 and has no row at
 * all for the current edition — exactly the state every one of the 13,969
 * migrated volunteers will be in when a new edition opens. The whole promise of
 * the registration/participation split is that this person confirms in one
 * short form and never re-enters their profile.
 */
let volunteer: SeededVolunteer

test.describe('edition confirmation', () => {
  test.beforeAll(async () => {
    volunteer = await seedReturningVolunteer()
  })

  test.beforeEach(async ({ page }) => {
    await clearRateLimits()
    await unlockAccounts()
    await signIn(page, volunteer.email, volunteer.password)
    await expect(page).toHaveURL(/\/(dashboard|apply|participate)/, { timeout: 30_000 })
  })

  test('the dashboard leads with confirming, and only confirming', async ({ page }) => {
    await page.goto('/dashboard')

    const hero = page.locator('section[aria-labelledby="dashboard-heading"]')
    const actions = hero.locator('[data-hero-action]')
    // One button, one answer to "what now?" — nothing shares the row with it.
    await expect(actions).toHaveCount(1)
    await expect(actions.first()).toHaveAttribute('href', '/participate')
    await expect(actions.first()).toContainText(/confirm your availability/i)
  })

  test('the wizard entry point routes a registered volunteer to the short form', async ({
    page,
  }) => {
    // A returning volunteer who bookmarks /apply must never see the wizard.
    await page.goto('/apply')
    await expect(page).toHaveURL(/\/participate/, { timeout: 30_000 })
  })

  test('confirms an edition in one form, profile untouched', async ({ page }) => {
    await page.goto('/participate')

    // The page says what carries over rather than asking for it again.
    await expect(page.getByText(/carry over from your registration/i)).toBeVisible()
    // No profile fields anywhere — this is the split, visibly.
    await expect(page.locator('#signup-firstName, [name="firstName"], [name="email"]')).toHaveCount(0)

    // Their 2026 department is preselected; keep it.
    await expect(page.locator('input[name="departmentId"]:checked')).toHaveCount(1)

    /*
     * Answer the department's own questions generically — first option of each
     * control. The set is admin-configured, so pinning specific keys here
     * would break the moment somebody edits a question in the admin screen.
     *
     * Dropdowns are answered as well as radio groups. Answering only radios
     * passed for as long as the one conditional dropdown in the seed data
     * happened to be retired, and failed the moment it was asked again — which
     * is precisely the fragility the generic approach exists to avoid.
     *
     * A `SELECT` question is **not** a native <select>: `QuestionField` renders
     * it with the searchable `Combobox` (an input[role=combobox] over a
     * ul[role=listbox]). An earlier attempt at this reached for
     * `locator('select')`, which matches nothing on this page, so the required
     * conditional question was silently left unanswered and the form — quite
     * correctly — refused the submission. Drive the real control instead.
     */
    const questionSection = page
      .locator('section', {
        has: page.getByRole('heading', { name: /department questions/i }),
      })
      .first()
    /*
     * Answer-then-recount inside expect.poll: a conditional follow-up mounts
     * *asynchronously* after its parent is answered, so a fixed number of
     * passes races the render — under load, the follow-up can appear after
     * the last pass has already looked. Polling settles by definition: each
     * retry answers whatever is unanswered right now, and the loop only ends
     * when a look finds nothing left.
     */
    await expect
      .poll(
        async () => {
          const unanswered = await questionSection
            .locator('input[type="radio"]')
            .evaluateAll((nodes) => [
              ...new Set(
                (nodes as HTMLInputElement[])
                  .filter(
                    (n) =>
                      !nodes.some(
                        (m) =>
                          (m as HTMLInputElement).name === n.name &&
                          (m as HTMLInputElement).checked,
                      ),
                  )
                  .map((n) => n.name),
              ),
            ])
          // Positions rather than names: the answer inputs are named
          // `answers.<key>`, and a dot is not a valid CSS id selector.
          // A combobox reads back its chosen option's label, so an empty value
          // is an unanswered question.
          const comboboxes = questionSection.locator('input[role="combobox"]')
          const emptyCombos = await comboboxes.evaluateAll((nodes) =>
            (nodes as HTMLInputElement[])
              .map((node, index) => (node.value ? -1 : index))
              .filter((index) => index >= 0),
          )

          for (const name of unanswered) {
            await questionSection.locator(`input[type="radio"][name="${name}"]`).first().check()
          }
          for (const index of emptyCombos) {
            // Focusing opens the listbox; the options carry role=option, so the
            // first one is the generic answer without knowing the question.
            const combobox = comboboxes.nth(index)
            await combobox.click()
            await questionSection.getByRole('option').first().click()
            // The listbox closes on choose; waiting for that keeps the next
            // pass from reading a value mid-transition.
            await expect(combobox).toHaveAttribute('aria-expanded', 'false')
          }
          return unanswered.length + emptyCombos.length
        },
        { timeout: 20_000 },
      )
      .toBe(0)

    // Dates, periods, overnight.
    const dateBoxes = page.locator('input[name="availableDates"]')
    await expect(dateBoxes.first()).toBeVisible()
    await dateBoxes.first().check()
    await dateBoxes.nth(1).check()
    await page.locator('input[name="preferredPeriods"][value="MORNING"]').check()
    await page.locator('input[name="availableOvernight"][value="no"]').check()

    // Submitting without consents is refused, accessibly, losing nothing.
    await page.getByRole('button', { name: /confirm my availability/i }).click()
    await expect(page.locator('#participate-errors')).toBeVisible()
    await expect(page.locator('input[name="availableDates"]').first()).toBeChecked()

    // Give this edition's consents and confirm.
    for (const name of [
      'consentAccurate',
      'consentTerms',
      'consentDataProcessing',
      'consentCommunication',
    ]) {
      await page.locator(`input[name="${name}"]`).check()
    }
    await page.getByRole('button', { name: /confirm my availability/i }).click()

    await expect(page).toHaveURL(/\/dashboard\?confirmed=1/, { timeout: 30_000 })
    await expect(page.getByText(/you are confirmed for the \d{4} edition/i)).toBeVisible()

    // The hero no longer asks them to confirm.
    const hero = page.locator('section[aria-labelledby="dashboard-heading"]')
    await expect(hero.getByRole('link', { name: /confirm your availability/i })).toHaveCount(0)
  })

  test('reopening after confirming offers an update, not a re-registration', async ({ page }) => {
    await page.goto('/participate')
    await expect(page.getByRole('heading', { name: /update your availability/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /save my changes/i })).toBeVisible()
  })

  test('has no detectable accessibility violations', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/participate', { waitUntil: 'networkidle' })
    const results = await new AxeBuilder({ page }).analyze()
    expect(JSON.stringify(results.violations, null, 2)).toBe('[]')
  })

  test('has no horizontal overflow at any supported width', async ({ page }) => {
    for (const width of [320, 375, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      await page.goto('/participate')
      const overflows = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      )
      expect(overflows, `overflow at ${width}px`).toBe(false)
    }
  })
})
