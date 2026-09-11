import { expect, test } from '@playwright/test'
import { signIn } from './helpers'
import { clearRateLimits, unlockAccounts } from './rate-limit'
import { seedSubmittedVolunteer, type SeededVolunteer } from './seed-user'

/**
 * Bulk approval — the confirmed requirement of the one-time-approval model.
 *
 * The fixture is one freshly seeded SUBMITTED application, and the test filters
 * the list down to exactly that row before approving "all" — so the flow under
 * test is the real one, while the dev database's other reviewable rows are
 * never touched.
 */
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@mmpraise.org'
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe!2026'

let volunteer: SeededVolunteer

test.describe('bulk approval', () => {
  test.beforeAll(async () => {
    volunteer = await seedSubmittedVolunteer()
  })

  test.beforeEach(async ({ page }) => {
    /*
     * Reduced motion, as every animation-adjacent spec in this suite sets.
     *
     * On touch emulation each retried tap re-triggers the primary button's
     * hover/active transform transition, so Playwright's stability check sees
     * an element that never stops moving and the click times out after 15s of
     * retries — a loop a human finger never experiences. With the transition
     * at 0.01ms the element is stable on the first sample.
     */
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await clearRateLimits()
    await unlockAccounts()
    await signIn(page, ADMIN_EMAIL, ADMIN_PASSWORD)
    await expect(page).toHaveURL(/\/(dashboard|admin)/, { timeout: 30_000 })
  })

  test('shows review ageing for a waiting application', async ({ page }) => {
    await page.goto(`/admin/applications?q=${encodeURIComponent(volunteer.email)}`)

    const row = page.locator('tbody tr').first()
    await expect(row).toContainText(volunteer.mmpCode)
    // Seeded 10 days ago, so it renders amber with the over-a-week note.
    await expect(row).toContainText(/10 days/)
    await expect(row.getByText(/waiting more than a week/i)).toBeAttached()
  })

  test('has no horizontal overflow at any supported width', async ({ page }) => {
    /*
     * Guards the applicants page against the document growing wider than the
     * viewport — the failure that used to zoom phones out and drop taps on the
     * confirm dialog's overlay. The filtered single-row view is the load-bearing
     * case: the fixture is 10 days old, so its row renders the sr-only "waiting
     * more than a week" note whose escape from the table's scroll box caused
     * exactly that. Checked two ways because the symptoms differ by platform:
     * on desktop the document just scrolls sideways (scrollWidth > innerWidth),
     * while a phone browser instead zooms out, expanding innerWidth itself past
     * the device width.
     */
    for (const width of [320, 375, 412, 768, 1024, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 })
      await page.goto(`/admin/applications?q=${encodeURIComponent(volunteer.email)}`)
      await expect(page.locator('tbody tr').first()).toBeVisible()
      const geometry = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
      }))
      expect(geometry.scrollWidth, `document overflow at ${width}px`).toBeLessThanOrEqual(
        geometry.innerWidth,
      )
      expect(geometry.innerWidth, `zoomed-out layout viewport at ${width}px`).toBeLessThanOrEqual(
        width,
      )
    }
  })

  test('approves everything in the filtered view, with a counted confirmation', async ({ page }) => {
    await page.goto(`/admin/applications?q=${encodeURIComponent(volunteer.email)}`)

    // The button names the number it will act on.
    const trigger = page.getByRole('button', { name: /approve all 1/i })
    await expect(trigger).toBeVisible()
    await trigger.click()

    // The dialog restates the count and the one-time nature of the decision.
    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText(/approve 1 volunteer\?/i)
    await expect(dialog).toContainText(/will not be reviewed again/i)

    await dialog.getByRole('button', { name: /^approve 1$/i }).click()

    await expect(page.getByText(/approved 1 volunteer/i)).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText(/audit record of its own/i)).toBeVisible()

    // The row itself now shows the standing, and the button is gone — there is
    // nothing reviewable left in this view.
    await expect(page.locator('tbody tr').first()).toContainText(/approved/i)
    await expect(page.getByRole('button', { name: /approve all/i })).toHaveCount(0)
  })

  test('export asks before personal data leaves, and names the row count', async ({ page }) => {
    await page.goto(`/admin/applications?q=${encodeURIComponent(volunteer.email)}`)

    await page.getByRole('button', { name: /^export$/i }).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText(/export 1 application\?/i)
    await expect(dialog).toContainText(/recorded in the activity log/i)
    await expect(dialog).toContainText(/health information is never included/i)

    /*
     * Two files, scoped by their section. Asking for "the CSV link" stopped
     * being a single question when the contact list arrived, and a locator
     * that silently matched either one would assert nothing.
     */
    const fullRecord = dialog.locator('section', {
      has: page.getByRole('heading', { name: /full record/i }),
    })
    await expect(fullRecord.getByRole('link', { name: /csv/i })).toHaveAttribute(
      'href',
      /\/api\/admin\/export\?format=csv/,
    )
    await expect(fullRecord.getByRole('link', { name: /excel/i })).toHaveAttribute(
      'href',
      /\/api\/admin\/export\?format=xlsx/,
    )
  })

  test('offers a contact list, and is honest about what the consent covers', async ({ page }) => {
    await page.goto(`/admin/applications?q=${encodeURIComponent(volunteer.email)}`)
    await page.getByRole('button', { name: /^export$/i }).click()

    const dialog = page.getByRole('dialog')
    const contacts = dialog.locator('section', {
      has: page.getByRole('heading', { name: /contact list/i }),
    })

    await expect(contacts.getByRole('link', { name: /csv/i })).toHaveAttribute(
      'href',
      /\/api\/admin\/export\/contacts\?format=csv/,
    )

    /*
     * The consent this export reports is compulsory to take part, so it is
     * evidence of agreement to service email and not a marketing opt-in.
     * Saying so in the dialog is the difference between an administrator
     * knowing what they may send and assuming everyone opted in.
     */
    await expect(contacts).toContainText(/not a marketing opt-in/i)
  })

  test('the contact list carries the segment it was opened from', async ({ page }) => {
    // Downloading from a filtered list must return that filter's people, so a
    // drilled-through segment is what lands in the file.
    const query = `q=${encodeURIComponent(volunteer.email)}`
    const response = await page.request.get(`/api/admin/export/contacts?format=csv&${query}`)

    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toContain('text/csv')
    expect(response.headers()['content-disposition']).toMatch(/mmpraise-contacts-\d{4}-\d{2}-\d{2}\.csv/)

    const body = await response.text()
    const [header, ...rows] = body.split('\r\n')
    expect(header).toContain('Email')
    expect(header).toContain('Consented to volunteer communication')
    // The full record's church and emergency detail has no business here.
    expect(header).not.toContain('Emergency')
    expect(header).not.toContain('Parish')

    expect(rows).toHaveLength(1)
    expect(rows[0]).toContain(volunteer.email)
  })
})
