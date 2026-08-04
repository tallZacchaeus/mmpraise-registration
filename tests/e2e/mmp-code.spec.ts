import { expect, test } from '@playwright/test'
import { signIn } from './helpers'
import { clearRateLimits, unlockAccounts } from './rate-limit'
import { seedVolunteer, type SeededVolunteer } from './seed-user'

/**
 * Signing in with the MMP number.
 *
 * This is the route 13,969 migrated volunteers are most likely to take: many
 * will not remember which address they registered with four years ago, but the
 * number is on everything the organisation has ever handed them.
 */
let volunteer: SeededVolunteer

test.describe('MMP number', () => {
  test.beforeAll(async () => {
    volunteer = await seedVolunteer('mmp')
  })

  test.beforeEach(async () => {
    await clearRateLimits()
    await unlockAccounts()
  })

  test('signs a volunteer in, however they type it', async ({ page }) => {
    // The canonical form, then the two ways somebody actually types it.
    for (const identifier of [
      volunteer.mmpCode,
      volunteer.mmpCode.toLowerCase(),
      volunteer.mmpCode.slice(3), // bare digits, no prefix
    ]) {
      await clearRateLimits()
      await signIn(page, identifier, volunteer.password)
      await expect(page, `signing in with "${identifier}"`).toHaveURL(/\/(dashboard|apply)/, {
        timeout: 30_000,
      })

      await page.getByRole('button', { name: /sign out/i }).click()
      await expect(page).toHaveURL(/\/login/, { timeout: 30_000 })
    }
  })

  test('shows the volunteer their number on the dashboard', async ({ page }) => {
    await signIn(page, volunteer.email, volunteer.password)
    /*
     * Wait for the redirect before navigating.
     *
     * Signing in redirects client-side, so a `goto` issued immediately after
     * the click races it and lands the assertions on the login page — which
     * fails as "MMP number not found" rather than as anything resembling the
     * real cause.
     */
    await expect(page).toHaveURL(/\/(dashboard|apply)/, { timeout: 30_000 })
    await page.goto('/dashboard')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 30_000 })

    await expect(page.getByText(volunteer.mmpCode).first()).toBeVisible()
    await expect(page.getByText(/your mmp number/i).first()).toBeVisible()

    /*
     * The per-edition reference is internal. Two identifiers that both begin
     * "MMP" is how a check-in desk looks up the wrong one, so only the
     * permanent number is ever shown.
     */
    const body = await page.locator('main').innerText()
    expect(body).not.toMatch(/MMP-\d{4}-\d{6}/)
  })

  test('names all three options on the sign-in form', async ({ page }) => {
    await page.goto('/login')

    const field = page.locator('#identifier')
    await expect(field).toBeVisible()

    const label = await page.evaluate(
      () => (document.querySelector('#identifier') as HTMLInputElement)?.labels?.[0]?.textContent ?? '',
    )
    expect(label).toMatch(/email/i)
    expect(label).toMatch(/username/i)
    expect(label).toMatch(/mmp number/i)
  })

  test('refuses a wrong password without revealing that the number is real', async ({ page }) => {
    await signIn(page, volunteer.mmpCode, 'NotThePassword123!')

    const error = page.getByText(/incorrect email, username, mmp number or password/i)
    await expect(error).toBeVisible({ timeout: 20_000 })

    /*
     * The same sentence a completely unknown number produces. A dense
     * sequential identifier is trivially enumerable, so the response must never
     * distinguish "no such volunteer" from "wrong password".
     */
    await clearRateLimits()
    await signIn(page, 'MMP9999999', 'NotThePassword123!')
    await expect(page.getByText(/incorrect email, username, mmp number or password/i)).toBeVisible({
      timeout: 20_000,
    })
  })

  test('does not treat the per-edition reference as a number', async ({ page }) => {
    // `MMP-2027-000123` must fall through to email/username matching and fail,
    // never resolve to whoever happens to hold MMP2027000.
    await signIn(page, 'MMP-2027-000123', volunteer.password)
    await expect(page.getByText(/incorrect email, username, mmp number or password/i)).toBeVisible({
      timeout: 20_000,
    })
  })
})
