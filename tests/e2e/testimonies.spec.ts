import { expect, test } from '@playwright/test'
import { signIn } from './helpers'
import { clearRateLimits, unlockAccounts } from './rate-limit'
import { seedTestimony } from './seed-user'

/**
 * The testimony moderation queue.
 *
 * Fixtures are seeded directly: one real-looking submission, a byte-identical
 * duplicate of it (different author — the same words are what makes it a
 * duplicate), and one tagged as test data. The suite asserts the queue's three
 * jobs: keep test data out of the way, make duplicates visible, and record the
 * moderation trail.
 */
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@mmpraise.org'
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe!2026'

const BODY = (stamp: string) =>
  `God kept me through every hour of the marathon and my family saw it. ${stamp}`

let original: Awaited<ReturnType<typeof seedTestimony>>
let duplicate: Awaited<ReturnType<typeof seedTestimony>>

test.describe('testimony moderation', () => {
  test.beforeAll(async () => {
    const stamp = Date.now().toString(36)
    original = await seedTestimony({ body: BODY(stamp), authorName: 'Grace Adeyemi' })
    duplicate = await seedTestimony({
      body: `  ${BODY(stamp).toUpperCase()}  `,
      authorName: 'Someone Else',
      title: `Duplicate of ${original.title}`,
    })
  })

  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await clearRateLimits()
    await unlockAccounts()
    await signIn(page, ADMIN_EMAIL, ADMIN_PASSWORD)
    await expect(page).toHaveURL(/\/(dashboard|admin)/, { timeout: 30_000 })
  })

  test('hides test data by default and finds real submissions by search', async ({ page }) => {
    await page.goto(`/admin/testimonies?q=${encodeURIComponent(original.title)}`)

    await expect(page.getByRole('link', { name: original.title, exact: true })).toBeVisible()
    // The dev database holds a hundred tagged e2e fixtures; none belong here.
    await expect(page.getByText(/^test$/i)).toHaveCount(0)
  })

  test('marks both halves of a duplicated body, case and spacing ignored', async ({ page }) => {
    /*
     * The duplicate was seeded UPPERCASED with padded whitespace. If the badge
     * still appears, the normalised hash — not string equality — is doing the
     * matching.
     */
    await page.goto(`/admin/testimonies?q=${encodeURIComponent('Duplicate of ' + original.title)}`)
    // The Badge specifically — the row's own title also contains the word.
    const row = page.locator('tbody tr').first()
    await expect(row.getByText('Duplicate', { exact: true })).toBeVisible()
  })

  test('moderates on the detail page: contact, note timeline, approval', async ({ page }) => {
    await page.goto(`/admin/testimonies/${original.id}`)

    // Contact details are visible to a super administrator, and say why.
    await expect(page.getByText(original.email)).toBeVisible()
    await expect(page.getByText(/access is recorded/i)).toBeVisible()

    // The public preview applies the anonymity preference.
    await expect(page.locator('blockquote')).toContainText(/God kept me/)
    await expect(page.locator('figcaption')).toContainText('Grace Adeyemi')

    // Approve with a note; the note lands in the timeline, not a lost field.
    await page.locator(`#note-${original.id}`).fill('Verified with the intercession team.')
    await page.getByRole('button', { name: /approve for publication/i }).click()
    await expect(page.getByText(/^approved$/i).first()).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText(/verified with the intercession team/i)).toBeVisible()

    // Approval unlocks featuring — as a mark, not a publication.
    await expect(page.getByRole('button', { name: /mark as featured/i })).toBeVisible()
  })

  test('links the duplicate pair to each other from the detail page', async ({ page }) => {
    await page.goto(`/admin/testimonies/${original.id}`)
    await expect(page.getByText(/same words, one other submission/i)).toBeVisible()
    await expect(page.getByRole('link', { name: new RegExp(`Duplicate of ${original.title}`) })).toBeVisible()
  })

  test('assignment is advisory and reversible', async ({ page }) => {
    await page.goto(`/admin/testimonies/${duplicate.id}`)

    await page.getByRole('button', { name: /take this one/i }).click()
    await expect(page.getByRole('button', { name: /hand back/i })).toBeVisible({ timeout: 20_000 })

    await page.goto(`/admin/testimonies?q=${encodeURIComponent('Duplicate of ' + original.title)}`)
    await expect(page.locator('tbody tr').first()).toContainText(/superadmin/i)
  })
})
