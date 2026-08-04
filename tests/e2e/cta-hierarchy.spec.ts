import { expect, test } from '@playwright/test'
import { clearRateLimits } from './rate-limit'

/**
 * Volunteer is the primary call to action everywhere.
 *
 * Recruiting volunteers is the product's primary conversion goal. Wherever both
 * headline actions appear together, Volunteer must be the filled button and
 * "Register to attend" the outline beside it — and Volunteer must come first in
 * the document, so it is also first for a keyboard and first under the thumb on
 * a stacked mobile layout.
 */
const PAGES = ['/', '/about', '/contact'] as const

/** A filled button has an opaque background; an outline one does not. */
async function isFilled(locator: import('@playwright/test').Locator) {
  return locator.evaluate((el) => {
    const bg = getComputedStyle(el).backgroundColor
    const alpha = bg.startsWith('rgba') ? Number(bg.split(',')[3]?.replace(')', '') ?? '1') : 1
    return alpha > 0.8 && bg !== 'rgba(0, 0, 0, 0)'
  })
}

test.describe('call-to-action hierarchy', () => {
  test.beforeEach(async () => {
    await clearRateLimits()
  })

  for (const path of PAGES) {
    test(`volunteer is the filled action on ${path}`, async ({ page }) => {
      await page.goto(path)

      const volunteer = page.getByRole('link', { name: /^volunteer$/i }).first()
      await expect(volunteer).toBeVisible()
      expect(await isFilled(volunteer), 'Volunteer must be filled').toBe(true)
    })

    test(`register is the outline action on ${path}`, async ({ page }) => {
      await page.goto(path)

      const register = page.getByRole('link', { name: /register to attend/i }).first()
      if ((await register.count()) === 0) test.skip()

      await expect(register).toBeVisible()
      expect(await isFilled(register), 'Register must not be filled').toBe(false)
      // Outlined, not merely unfilled — the border is what makes it read as a
      // peer of the primary rather than as plain text.
      const borderWidth = await register.evaluate((el) => getComputedStyle(el).borderTopWidth)
      expect(parseFloat(borderWidth)).toBeGreaterThan(0)
    })
  }

  test('volunteer precedes register in the document order', async ({ page }) => {
    await page.goto('/')

    const order = await page.evaluate(() => {
      const links = [...document.querySelectorAll('main a')]
      const text = (el: Element) => (el.textContent ?? '').trim().toLowerCase()
      return {
        volunteer: links.findIndex((el) => text(el) === 'volunteer'),
        register: links.findIndex((el) => text(el).includes('register to attend')),
      }
    })

    expect(order.volunteer).toBeGreaterThanOrEqual(0)
    expect(order.register).toBeGreaterThanOrEqual(0)
    // First in the DOM is first for the keyboard, and first on a stacked phone.
    expect(order.volunteer).toBeLessThan(order.register)
  })

  test('the two never carry equal visual weight', async ({ page }) => {
    await page.goto('/')

    const volunteer = page.getByRole('link', { name: /^volunteer$/i }).first()
    const register = page.getByRole('link', { name: /register to attend/i }).first()

    const [volunteerBg, registerBg] = await Promise.all([
      volunteer.evaluate((el) => getComputedStyle(el).backgroundColor),
      register.evaluate((el) => getComputedStyle(el).backgroundColor),
    ])
    expect(volunteerBg).not.toBe(registerBg)
  })

  test('hierarchy holds on a phone, where the buttons stack', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/')

    const volunteer = page.getByRole('link', { name: /^volunteer$/i }).first()
    const register = page.getByRole('link', { name: /register to attend/i }).first()

    expect(await isFilled(volunteer)).toBe(true)
    expect(await isFilled(register)).toBe(false)

    // Stacked, with the primary above — and both still a comfortable size.
    const [v, r] = await Promise.all([volunteer.boundingBox(), register.boundingBox()])
    expect(v!.y).toBeLessThan(r!.y)
    expect(v!.height).toBeGreaterThanOrEqual(44)
    expect(r!.height).toBeGreaterThanOrEqual(44)
  })

  test('both actions keep a visible focus ring', async ({ page }) => {
    await page.goto('/')

    for (const name of [/^volunteer$/i, /register to attend/i]) {
      const link = page.getByRole('link', { name }).first()
      await link.focus()
      const outline = await link.evaluate((el) => getComputedStyle(el).outlineWidth)
      expect(parseFloat(outline), `${name} focus ring`).toBeGreaterThan(0)
    }
  })
})
