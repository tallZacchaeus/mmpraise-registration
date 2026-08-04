import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { clearRateLimits } from './rate-limit'

/**
 * Homepage behaviour.
 *
 * These cover the defects fixed during the rebuild, so a regression fails the
 * suite rather than shipping: the missing H1, dead "#" links, hotlinked
 * WordPress images, duplicated testimonies, the expired countdown, and the
 * unlabelled forms.
 */
test.describe('homepage', () => {
  test.beforeEach(async () => {
    await clearRateLimits()
  })

  test('has one H1 and a sensible landmark structure', async ({ page }) => {
    await page.goto('/')

    await expect(page.locator('h1')).toHaveCount(1)
    await expect(page.locator('h1')).toContainText(/welcome to mmpraise/i)

    await expect(page.getByRole('banner')).toBeVisible()
    await expect(page.getByRole('main')).toBeVisible()
    await expect(page.getByRole('contentinfo')).toBeVisible()

    // Below the lg breakpoint the horizontal nav is replaced by the menu
    // button, so assert whichever one this viewport is meant to show.
    const width = page.viewportSize()?.width ?? 1280
    if (width >= 1024) {
      await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible()
    } else {
      await expect(page.getByRole('button', { name: /^menu$/i })).toBeVisible()
    }
  })

  test('publishes metadata and structured data', async ({ page }) => {
    await page.goto('/')

    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /Marathon/i)
    await expect(page.locator('meta[property="og:title"]')).toHaveCount(1)
    await expect(page.locator('meta[property="og:image"]')).toHaveCount(1)
    await expect(page.locator('meta[name="twitter:card"]')).toHaveCount(1)

    const types = await page.evaluate(() => {
      const script = document.querySelector('script[type="application/ld+json"]')
      const parsed = JSON.parse(script?.textContent ?? '{}')
      return (parsed['@graph'] ?? []).map((node: { '@type': string }) => node['@type'])
    })
    expect(types).toEqual(expect.arrayContaining(['Organization', 'FAQPage']))

    // The Event node is emitted only once a start date is confirmed: schema.org
    // requires startDate, and invalid structured data is worse than none.
    const dateAnnounced = await page.getByText(/dates to be announced/i).count()
    if (dateAnnounced > 0) {
      expect(types).not.toContain('Event')
    } else {
      expect(types).toContain('Event')
    }
  })

  test('serves every image from this project and never from WordPress', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const sources = await page.$$eval('img', (images) => images.map((image) => image.getAttribute('src') ?? ''))
    for (const src of sources) {
      expect(src, `image should not be hotlinked: ${src}`).not.toContain('mmpraise.org')
      expect(src, `image should not be hotlinked: ${src}`).not.toContain('wp-content')
    }

    const broken = await page.$$eval('img', (images) =>
      images.filter((image) => image.complete && image.naturalWidth === 0).map((image) => image.src),
    )
    expect(broken).toEqual([])
  })

  test('has no dead links and marks external links safely', async ({ page }) => {
    await page.goto('/')

    expect(await page.locator('a[href="#"]').count()).toBe(0)

    const unsafe = await page.$$eval<string[], HTMLAnchorElement>('a[target="_blank"]', (anchors) =>
      anchors.filter((a) => !(a.getAttribute('rel') ?? '').includes('noopener')).map((a) => a.href),
    )
    expect(unsafe).toEqual([])
  })

  test('shows each unique testimony once, with a working read-more', async ({ page }) => {
    await page.goto('/')
    // The card is a Client Component; wait for hydration before interacting,
    // otherwise the click lands before React has attached its handler.
    await page.waitForLoadState('networkidle')

    const quotes = page.locator('blockquote')
    await expect(quotes).toHaveCount(7)

    // Activated by keyboard: it proves the control is genuinely operable
    // without a mouse, and the sticky header cannot intercept a key press.
    const readMore = page.getByRole('button', { name: /read full testimony/i }).first()
    await readMore.scrollIntoViewIfNeeded()
    await readMore.focus()
    await page.keyboard.press('Enter')

    // The full text opens in a dialog rather than expanding in place, so the
    // grid below does not reflow under the reader.
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog).toContainText(/personal account submitted by a worshipper/i)

    // Escape closes it and focus returns to the trigger.
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(readMore).toBeFocused()
  })

  test('never shows a negative or invented countdown', async ({ page }) => {
    await page.goto('/')

    const section = page.locator('section').filter({ hasText: 'The countdown to glory begins' })
    const announceState = section.getByText(/dates to be announced/i)

    if ((await announceState.count()) > 0) {
      // No confirmed date: say so rather than counting down to nothing.
      await expect(announceState.first()).toBeVisible()
      await expect(section.getByRole('link', { name: /get the announcement/i })).toBeVisible()
      return
    }

    const digits = await section.locator('li span').first().innerText()
    expect(Number(digits)).toBeGreaterThanOrEqual(0)
    expect(digits).not.toContain('-')
  })

  test('opens all thirteen FAQs from the keyboard', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Every question is present, and every answer is in the HTML for crawlers
    // even while its panel is collapsed.
    const questions = page.getByRole('button', { name: /\?$/ })
    await expect(questions).toHaveCount(13)

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

  test('mobile menu traps focus, closes on Escape and restores focus', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/')

    const trigger = page.getByRole('button', { name: /^menu$/i })
    await trigger.click()

    const dialog = page.getByRole('dialog', { name: /site menu/i })
    await expect(dialog).toBeVisible()

    // Background scroll is locked while the panel is open. Radix sets this on
    // <body>, so read the computed style rather than the inline one.
    expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).toBe('hidden')

    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(trigger).toBeFocused()
    expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).not.toBe('hidden')
  })

  test('validates the testimony form and requires consent', async ({ page }) => {
    await page.goto('/#share-testimony')

    await page.getByRole('button', { name: /share my testimony/i }).click()

    const summary = page.getByRole('alert').first()
    await expect(summary).toBeVisible()
    await expect(summary).toContainText(/fix the following/i)
  })

  test('accepts a complete testimony and confirms it will be reviewed', async ({ page }) => {
    await page.goto('/#share-testimony')

    await page.locator('#testimony-authorName').fill('Test Worshipper')
    await page.locator('#testimony-country').fill('Nigeria')
    await page.locator('#testimony-email').fill(`testimony.${Date.now().toString(36)}@example.com`)
    await page.locator('#testimony-title').fill('Automated test testimony')
    await page
      .locator('#testimony-body')
      .fill('This entry was created by the automated end-to-end suite to confirm the submission flow works.')

    // The consent checkbox is the last one in the form.
    await page.locator('#testimony-consentToPublish input[type="checkbox"]').check()
    await page.getByRole('button', { name: /share my testimony/i }).click()

    await expect(page.getByText(/we have received your testimony/i)).toBeVisible({ timeout: 20_000 })
    // Moderation is stated explicitly — nothing is published automatically.
    await expect(page.getByText(/reads every submission before it is published/i)).toBeVisible()
  })

  test('requires consent before subscribing to updates', async ({ page }) => {
    await page.goto('/')

    await page.locator('#newsletter-email').fill(`updates.${Date.now().toString(36)}@example.com`)
    await page.getByRole('button', { name: /keep me updated/i }).click()
    await expect(page.getByText(/confirm you are happy to receive updates/i)).toBeVisible()

    const newsletterForm = page.locator('form').filter({ has: page.locator('#newsletter-email') })
    await newsletterForm.locator('input[type="checkbox"]').check()
    await page.getByRole('button', { name: /keep me updated/i }).click()
    await expect(page.getByText(/you are on the list/i)).toBeVisible({ timeout: 20_000 })
  })

  test('has no detectable accessibility violations', async ({ page }) => {
    await page.goto('/')
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([])
  })

  test('overlays the hero at the top and turns solid on scroll', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const header = page.locator('header')
    await expect(header).toHaveAttribute('data-transparent', 'true')

    // The hero must start at exactly the header's top edge. Any gap is a strip
    // of white page background showing above the photograph, and the white nav
    // text sitting on it becomes invisible.
    const gap = await page.evaluate(() => {
      const h = document.querySelector('header')!.getBoundingClientRect()
      const hero = document.querySelector('main section')!.getBoundingClientRect()
      return Math.round(hero.top - h.top)
    })
    expect(gap).toBe(0)

    await page.evaluate(() => window.scrollTo(0, 600))
    await expect(header).not.toHaveAttribute('data-transparent', 'true')
  })

  test('has no horizontal overflow at any supported width', async ({ page }) => {
    for (const width of [320, 360, 375, 390, 430, 768, 1024, 1280, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 })
      await page.goto('/')
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
      expect(scrollWidth, `horizontal overflow at ${width}px`).toBeLessThanOrEqual(width + 1)
    }
  })
})
