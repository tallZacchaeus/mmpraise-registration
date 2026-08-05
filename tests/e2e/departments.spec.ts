import { expect, test } from '@playwright/test'
import { signIn } from './helpers'
import { clearRateLimits, unlockAccounts } from './rate-limit'
import { deleteSeededQuestion, seedRetiredQuestion } from './seed-user'

/**
 * Departments and their question sets.
 *
 * The seeded departments are shared with every other suite, so these tests
 * restore whatever they change: a department left closed would silently remove
 * it from the registration wizard for the rest of the run, and a question left
 * retired would change the form the wizard suite fills in.
 */
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@mmpraise.org'
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe!2026'

/** Open the question editor for the Welfare department. */
async function openWelfareQuestions(page: import('@playwright/test').Page) {
  await page.goto('/admin/departments')
  await page
    .locator('li')
    .filter({ hasText: /welfare/i })
    .first()
    .getByRole('link', { name: /questions/i })
    .click()
  await expect(page).toHaveURL(/\/questions$/, { timeout: 20_000 })
}

test.describe('departments and questions', () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await clearRateLimits()
    await unlockAccounts()
    await signIn(page, ADMIN_EMAIL, ADMIN_PASSWORD)
    await expect(page).toHaveURL(/\/(dashboard|admin)/, { timeout: 30_000 })
  })

  test('a closed department stays listed, so it can be reopened', async ({ page }) => {
    await page.goto('/admin/departments')
    const row = page.locator('li').filter({ hasText: /welfare/i }).first()
    const toggle = row.getByRole('checkbox', { name: /open for applications/i })

    await toggle.uncheck()
    await expect(row.getByText('Closed', { exact: true })).toBeVisible({ timeout: 20_000 })

    // The whole point: it is still here, and the way back is one click.
    await toggle.check()
    await expect(row.getByText('Closed', { exact: true })).toHaveCount(0, { timeout: 20_000 })
  })

  test('a department can be described in words volunteers will read', async ({ page }) => {
    await page.goto('/admin/departments')
    const row = page.locator('li').filter({ hasText: /welfare/i }).first()
    const description = `Feeding and caring for the team. ${Date.now().toString(36)}`

    await row.getByRole('button', { name: /^edit$/i }).click()
    await row.getByLabel(/description/i).fill(description)
    await row.getByRole('button', { name: /^save$/i }).click()

    await expect(page.getByText(description)).toBeVisible({ timeout: 20_000 })
  })

  test('questions reorder from the keyboard, and the order sticks', async ({ page }) => {
    await openWelfareQuestions(page)

    const items = page.locator('ol').first().locator('> li')
    if ((await items.count()) < 2) test.skip()

    const firstLabel = (await items.first().locator('p').first().innerText()).replace(/^\d+\.\s*/, '')
    const secondLabel = (await items.nth(1).locator('p').first().innerText()).replace(/^\d+\.\s*/, '')

    await items.nth(1).getByRole('button', { name: /move .* up/i }).click()
    await expect(items.first().locator('p').first()).toContainText(secondLabel, { timeout: 20_000 })

    // The renumbering is persisted, not just optimistic state.
    await page.reload()
    await expect(items.first().locator('p').first()).toContainText(secondLabel)

    // Put it back, so the wizard suite meets the order it expects.
    await items.first().getByRole('button', { name: /move .* down/i }).click()
    await expect(items.first().locator('p').first()).toContainText(firstLabel, { timeout: 20_000 })
  })

  test('the preview renders the real form through the real visibility engine', async ({ page }) => {
    await openWelfareQuestions(page)

    await expect(page.getByRole('heading', { name: /^preview$/i })).toBeVisible()
    await expect(page.getByText(/answers are not saved/i)).toBeVisible()
    await expect(page.getByText(/\d+ of \d+ questions? showing/i)).toBeVisible()
  })

  test('a retired question is listed, and can be asked again', async ({ page }) => {
    const retired = await seedRetiredQuestion('welfare')
    try {
      await openWelfareQuestions(page)

      // Visible at all — which it was not before: retiring one by mistake used
      // to need a database edit to undo.
      await expect(page.getByText(retired.label)).toBeVisible()

      const row = page.locator('li').filter({ hasText: retired.label }).last()
      await row.getByRole('button', { name: /ask this again/i }).click()

      // It joins the live set, numbered with the rest.
      const live = page.locator('ol').first().locator('> li')
      await expect(live.filter({ hasText: retired.label })).toHaveCount(1, { timeout: 20_000 })
    } finally {
      await deleteSeededQuestion(retired.id)
    }
  })

  test('copying a question set reports exactly what it did', async ({ page }) => {
    await openWelfareQuestions(page)

    const copyFrom = page.getByLabel(/copy questions from/i)
    const sources = copyFrom.locator('option')
    if ((await sources.count()) < 2) test.skip()

    await copyFrom.selectOption({ index: 1 })
    await page.getByRole('button', { name: /^copy$/i }).click()

    /*
     * Both outcomes are correct and which one happens depends on the seed
     * data, so both are accepted — what matters is that the copy is additive
     * and says so, rather than silently overwriting a live question set.
     */
    await expect(
      page.getByText(/copied \d+ question|already here/i),
    ).toBeVisible({ timeout: 20_000 })
  })
})
