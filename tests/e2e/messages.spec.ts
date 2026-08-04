import { expect, test } from '@playwright/test'
import { signIn } from './helpers'
import { clearRateLimits, unlockAccounts } from './rate-limit'
import { seedContactMessage, seedVolunteer } from './seed-user'

/**
 * The contact-inbox helpdesk.
 *
 * Fixtures are seeded directly, one per concern: an unread message, a message
 * from an address that belongs to a seeded volunteer, a duplicated enquiry
 * with mangled case and spacing, and one tagged as test data. Each test reads
 * the inbox the way the communication team will: list on the left, one
 * conversation on the right.
 */
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@mmpraise.org'
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe!2026'

test.describe('contact messages helpdesk', () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await clearRateLimits()
    await unlockAccounts()
    await signIn(page, ADMIN_EMAIL, ADMIN_PASSWORD)
    await expect(page).toHaveURL(/\/(dashboard|admin)/, { timeout: 30_000 })
  })

  test('a message is unread until somebody opens it', async ({ page }) => {
    const seeded = await seedContactMessage({
      prefix: 'unread',
      message: 'Please could you confirm whether the venue has step-free access?',
    })

    await page.goto(`/admin/messages?q=${encodeURIComponent(seeded.subject)}`)
    await expect(page.getByRole('link', { name: /Unread:/ })).toBeVisible()

    await page.getByRole('link', { name: new RegExp(seeded.subject) }).click()
    await expect(page.getByRole('heading', { name: seeded.subject })).toBeVisible()

    // The read mark is written as the detail renders; the next visit shows it.
    await page.goto(`/admin/messages?q=${encodeURIComponent(seeded.subject)}`)
    await expect(page.getByRole('link', { name: new RegExp(seeded.subject) })).toBeVisible()
    await expect(page.getByRole('link', { name: /Unread:/ })).toHaveCount(0)
  })

  test('recognises the sender as a registered volunteer, and replies by mailto', async ({
    page,
  }) => {
    const volunteer = await seedVolunteer('sender')
    const seeded = await seedContactMessage({
      prefix: 'known',
      email: volunteer.email,
      name: `${volunteer.firstName} ${volunteer.lastName}`,
      message: 'I registered last week but have not received my confirmation email.',
    })

    await page.goto(`/admin/messages?id=${seeded.id}`)

    await expect(page.getByText(/registered volunteer/i)).toBeVisible()
    await expect(page.getByText(new RegExp(volunteer.mmpCode))).toBeVisible()

    const reply = page.getByRole('link', { name: /reply by email/i })
    await expect(reply).toHaveAttribute(
      'href',
      `mailto:${seeded.email}?subject=${encodeURIComponent(`Re: ${seeded.subject}`)}`,
    )
  })

  test('groups the same words into one conversation, case and spacing ignored', async ({
    page,
  }) => {
    const words = `My church group of twelve would like to serve together. ${Date.now().toString(36)}`
    const first = await seedContactMessage({ prefix: 'dup', message: words })
    await seedContactMessage({ prefix: 'dup', message: `  ${words.toUpperCase()}  ` })

    await page.goto(`/admin/messages?id=${first.id}`)
    await expect(page.getByText(/same message, sent once more/i)).toBeVisible()
  })

  test('priority, spam tagging and assignment are one-click controls', async ({ page }) => {
    const seeded = await seedContactMessage({
      prefix: 'triage',
      message: 'A coach carrying forty volunteers has broken down on the way to the venue.',
    })

    await page.goto(`/admin/messages?q=${encodeURIComponent(seeded.subject)}&id=${seeded.id}`)
    const listRow = page.getByRole('link', { name: new RegExp(seeded.subject) })

    await page.getByLabel('Priority').selectOption('URGENT')
    await expect(listRow).toContainText(/urgent/i, { timeout: 20_000 })

    await page.getByRole('button', { name: /take this one/i }).click()
    await expect(page.getByRole('button', { name: /hand back/i })).toBeVisible({ timeout: 20_000 })

    await page.getByRole('button', { name: /mark as spam/i }).click()
    await expect(page.getByRole('button', { name: /not spam/i })).toBeVisible({ timeout: 20_000 })
    await expect(listRow).toContainText('Spam')
  })

  test('notes accumulate as a timeline, never overwriting', async ({ page }) => {
    const seeded = await seedContactMessage({
      prefix: 'notes',
      message: 'Could you tell me more about serving in the medical team?',
    })

    await page.goto(`/admin/messages?id=${seeded.id}`)
    await expect(page.getByText(/no notes yet/i)).toBeVisible()

    await page.getByLabel(/add a note/i).fill('Asked the medical lead; waiting to hear back.')
    await page.getByRole('button', { name: /add note/i }).click()
    await expect(page.getByText(/asked the medical lead/i)).toBeVisible({ timeout: 20_000 })

    await page.getByLabel(/add a note/i).fill('Medical lead says yes — replied with the details.')
    await page.getByRole('button', { name: /add note/i }).click()
    await expect(page.getByText(/medical lead says yes/i)).toBeVisible({ timeout: 20_000 })
    // The first note is still there: a timeline, not a field.
    await expect(page.getByText(/asked the medical lead/i)).toBeVisible()
  })

  test('bulk resolve for test data states its count before doing anything', async ({ page }) => {
    /*
     * The dialog is opened and dismissed rather than confirmed: three browser
     * projects share one database, and executing the counted action in all of
     * them at once would make the server's re-count refuse two — correctly.
     * The counted-execution contract itself is covered by bulk-approve.spec.ts.
     */
    await seedContactMessage({
      prefix: 'fixture',
      message: 'This is a rehearsal message from the launch checklist.',
      isTestData: true,
    })

    await page.goto('/admin/messages')
    await page.getByRole('button', { name: /resolve \d+ test message/i }).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText(/tagged test message/i)
    await expect(dialog).toContainText(/nothing is deleted/i)

    await dialog.getByRole('button', { name: /go back/i }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })
})
