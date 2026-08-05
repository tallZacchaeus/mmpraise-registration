import { expect, test } from '@playwright/test'
import { signIn } from './helpers'
import { clearRateLimits, unlockAccounts } from './rate-limit'
import { expireSeededAnnouncements, seedAnnouncement, seedVolunteer } from './seed-user'

/**
 * The announcement lifecycle.
 *
 * Drafting, editing and publishing run through the real UI; awkward pre-states
 * (a schedule whose moment has already passed) are seeded directly. The publish
 * test closes the loop by signing in as a volunteer and reading the dashboard —
 * the audience the whole feature exists for.
 */
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@mmpraise.org'
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe!2026'

test.describe('announcement lifecycle', () => {
  // Published fixtures broadcast to every volunteer; retire them so the
  // dashboard suite's empty state stays empty.
  test.afterAll(async () => {
    await expireSeededAnnouncements()
  })

  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await clearRateLimits()
    await unlockAccounts()
    await signIn(page, ADMIN_EMAIL, ADMIN_PASSWORD)
    await expect(page).toHaveURL(/\/(dashboard|admin)/, { timeout: 30_000 })
  })

  test('a new announcement starts as a draft on its own page', async ({ page }) => {
    const title = `Stewards briefing ${Date.now().toString(36)}`

    await page.goto('/admin/announcements/new')
    await page.locator('#announcement-title').fill(title)
    await page
      .locator('#announcement-body')
      .fill('The stewards briefing moves to the north hall this year.')
    await page.getByRole('button', { name: /save draft/i }).click()

    // The draft gets its own page, holding the lifecycle controls.
    await expect(page).toHaveURL(/\/admin\/announcements\/[a-z0-9]+/, { timeout: 20_000 })
    await expect(page.getByRole('heading', { name: title })).toBeVisible()
    await expect(page.getByText('draft', { exact: true })).toBeVisible()

    await page.goto('/admin/announcements?status=DRAFT&q=' + encodeURIComponent(title))
    await expect(page.getByRole('link', { name: new RegExp(title) })).toBeVisible()
  })

  test('editing keeps the previous wording as a version', async ({ page }) => {
    const seeded = await seedAnnouncement({ body: 'Original wording, soon replaced.' })

    await page.goto(`/admin/announcements/${seeded.id}`)
    await page.locator('#announcement-title').fill(`${seeded.title} (corrected)`)
    await page.getByRole('button', { name: /save changes/i }).click()

    await expect(page.getByText(/^saved\./i)).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText('Version 1')).toBeVisible()
    // The old wording is behind the version's disclosure — scoped there, since
    // the body also sits in the editor textarea and the preview card.
    await page.getByText('Version 1').click()
    await expect(
      page.getByRole('group').getByText(/original wording, soon replaced/i),
    ).toBeVisible()
  })

  test('publishing states the audience count first, then reaches the dashboard', async ({
    page,
    browser,
  }) => {
    const volunteer = await seedVolunteer('reader')
    const seeded = await seedAnnouncement({ body: 'Rehearsal starts an hour earlier on Friday.' })

    await page.goto(`/admin/announcements/${seeded.id}`)
    await page.getByRole('button', { name: /publish now/i }).click()

    const dialog = page.getByRole('dialog')
    // The counted-dialog contract: it says who, and how many that is today.
    await expect(dialog).toContainText(/all volunteers/i)
    await expect(dialog).toContainText(/\d+ volunteers?/)
    await dialog.getByRole('button', { name: /^publish$/i }).click()

    await expect(page.getByText(/it is on volunteer dashboards now/i)).toBeVisible({
      timeout: 20_000,
    })
    await expect(page.getByText('published', { exact: true })).toBeVisible()

    // The other side of the fence: a volunteer sees it.
    const context = await browser.newContext()
    const volunteerPage = await context.newPage()
    try {
      await volunteerPage.emulateMedia({ reducedMotion: 'reduce' })
      await signIn(volunteerPage, volunteer.email, volunteer.password)
      await expect(volunteerPage).toHaveURL(/\/dashboard/, { timeout: 30_000 })
      await expect(volunteerPage.getByText(seeded.title)).toBeVisible()
    } finally {
      await context.close()
    }
  })

  test('a scheduled announcement goes live by itself once its moment passes', async ({ page }) => {
    const seeded = await seedAnnouncement({ status: 'SCHEDULED', scheduledInMinutes: -5 })

    // Nobody pressed publish; opening the list is what ticks the clock.
    await page.goto('/admin/announcements?q=' + encodeURIComponent(seeded.title))
    await expect(page.getByRole('link', { name: new RegExp(seeded.title) })).toBeVisible()
    await expect(page.getByText('published', { exact: true })).toBeVisible()
  })

  test('scheduling refuses a moment that has already passed', async ({ page }) => {
    const seeded = await seedAnnouncement({})

    await page.goto(`/admin/announcements/${seeded.id}`)
    await page.locator('#announcement-schedule').fill('2020-01-01T09:00')
    await page.getByRole('button', { name: /^schedule$/i }).click()
    await expect(page.getByText(/already passed/i)).toBeVisible({ timeout: 20_000 })
  })

  test('take down now retires a published announcement', async ({ page }) => {
    const seeded = await seedAnnouncement({ status: 'PUBLISHED', publishedMinutesAgo: 60 })

    await page.goto(`/admin/announcements/${seeded.id}`)
    await page.getByRole('button', { name: /take down now/i }).click()
    await expect(page.getByText(/volunteers no longer see it/i)).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText('expired', { exact: true })).toBeVisible()
  })

  test('clone opens a fresh draft with the same content', async ({ page }) => {
    const seeded = await seedAnnouncement({ status: 'PUBLISHED', publishedMinutesAgo: 60 })

    await page.goto(`/admin/announcements/${seeded.id}`)
    await page.getByRole('button', { name: /clone/i }).click()

    await expect(page).toHaveURL(new RegExp(`/admin/announcements/(?!${seeded.id})`), {
      timeout: 20_000,
    })
    await expect(page.getByRole('heading', { name: `Copy of ${seeded.title}` })).toBeVisible()
    await expect(page.getByText('draft', { exact: true })).toBeVisible()
  })
})
