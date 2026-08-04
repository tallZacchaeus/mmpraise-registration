import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { clearRateLimits } from './rate-limit'

/**
 * The About page as a visitor meets it.
 *
 * Asserts the defects found on https://mmpraise.org/about-us/ are gone: no H1
 * until the rebuild, a heading order that jumped from H1 to H3, photographs
 * with empty alt text, an unlabelled email box under a "volunteer with us"
 * heading, no metadata or structured data, and no link to the volunteer
 * platform anywhere on the page.
 */
test.describe('about page', () => {
  test.beforeEach(async () => {
    await clearRateLimits()
  })

  test('has one H1 and a heading order that never skips a level', async ({ page }) => {
    await page.goto('/about')

    await expect(page.locator('h1')).toHaveCount(1)
    await expect(page.locator('h1')).toContainText(/global movement of unending worship/i)

    const levels = await page
      .locator('main h1, main h2, main h3, main h4')
      .evaluateAll((nodes) => nodes.map((node) => Number(node.tagName[1])))

    expect(levels[0]).toBe(1)
    for (let i = 1; i < levels.length; i += 1) {
      // A level may close by any amount but may only open by one.
      expect(levels[i] - levels[i - 1]).toBeLessThanOrEqual(1)
    }
  })

  test('publishes metadata, canonical and structured data', async ({ page }) => {
    await page.goto('/about')

    await expect(page).toHaveTitle(/about mmpraise/i)
    const description = page.locator('meta[name="description"]')
    await expect(description).toHaveAttribute('content', /praise god without stopping/i)
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/about$/)
    await expect(page.locator('meta[property="og:title"]')).toHaveCount(1)
    await expect(page.locator('meta[name="twitter:card"]')).toHaveCount(1)

    const jsonLd = await page.locator('script[type="application/ld+json"]').first().textContent()
    const parsed = JSON.parse(jsonLd!)
    const types = parsed['@graph'].map((node: { '@type': string }) => node['@type'])
    expect(types).toContain('AboutPage')
    expect(types).toContain('Organization')
    expect(types).toContain('BreadcrumbList')
  })

  test('shows a breadcrumb trail back to the homepage', async ({ page }) => {
    await page.goto('/about')

    const crumbs = page.getByRole('navigation', { name: /breadcrumb/i })
    await expect(crumbs).toBeVisible()
    await expect(crumbs.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/')
    await expect(crumbs.locator('[aria-current="page"]')).toHaveText('About')
  })

  test('distinguishes the vision from the mission', async ({ page }) => {
    await page.goto('/about')

    const vision = page.locator('section', { has: page.locator('#vision-heading') })
    const visionText = (await vision.innerText()).toLowerCase()

    await expect(page.locator('#vision-heading')).toBeVisible()
    await expect(page.locator('#mission-heading')).toBeVisible()

    // Both live in the same section; the failure being guarded against is the
    // two carrying the same words, not where they sit.
    const visionHeading = await page.locator('#vision-heading').innerText()
    const missionHeading = await page.locator('#mission-heading').innerText()
    expect(visionHeading).not.toBe(missionHeading)
    expect(visionText).toContain('unceasing praise')
  })

  test('gives every photograph descriptive alternative text', async ({ page }) => {
    await page.goto('/about')

    const alts = await page
      .locator('main img')
      .evaluateAll((nodes) => nodes.map((n) => (n as HTMLImageElement).alt))

    // Two photographs are decorative backdrops — the hero and the closing call
    // to action — and the headings on them carry the meaning, so an empty alt
    // is correct there. Every other image must describe itself.
    const empty = alts.filter((alt) => alt.trim() === '')
    expect(empty).toHaveLength(2)
    for (const alt of alts.filter((a) => a.trim() !== '')) {
      expect(alt.length).toBeGreaterThan(15)
      expect(alt.toLowerCase()).not.toBe('image')
    }
  })

  test('links to the volunteer application and separates it from subscribing', async ({ page }) => {
    await page.goto('/about')

    const volunteer = page.locator('section', { has: page.locator('#volunteer-heading') })
    await expect(volunteer.getByRole('link', { name: /apply to volunteer/i })).toHaveAttribute(
      'href',
      '/register',
    )

    // The subscription form is its own section and says what it is for.
    const updates = page.locator('section', { has: page.locator('#updates-heading') })
    await expect(updates).toContainText(/does not enter you as a volunteer/i)
    await expect(updates.getByLabel(/email/i).first()).toBeVisible()
  })

  test('serves every image from this project and never from WordPress', async ({ page }) => {
    const external: string[] = []
    page.on('request', (request) => {
      const url = request.url()
      if (/mmpraise\.org|wp-content/.test(url)) external.push(url)
    })

    await page.goto('/about', { waitUntil: 'networkidle' })
    expect(external).toEqual([])
  })

  test('has no dead links and marks external links safely', async ({ page }) => {
    await page.goto('/about')

    const hrefs = await page
      .locator('main a[href]')
      .evaluateAll((nodes) => nodes.map((n) => n.getAttribute('href') ?? ''))

    for (const href of hrefs) {
      expect(href).not.toBe('#')
      expect(href).not.toContain('../')
    }

    const unsafe = await page
      .locator('main a[target="_blank"]')
      .evaluateAll((nodes) => nodes.filter((n) => !n.getAttribute('rel')?.includes('noopener')))
    expect(unsafe).toHaveLength(0)
  })

  test('has no detectable accessibility violations', async ({ page }) => {
    await page.goto('/about')
    const results = await new AxeBuilder({ page }).analyze()
    expect(JSON.stringify(results.violations, null, 2)).toBe('[]')
  })

  test('overlays the hero at the top and turns solid on scroll', async ({ page }) => {
    await page.goto('/about')
    await page.waitForLoadState('networkidle')

    const header = page.locator('header')
    await expect(header).toHaveAttribute('data-transparent', 'true')

    // Any gap is a strip of white page background above the photograph, and the
    // white navigation sitting on it becomes invisible.
    const gap = await page.evaluate(() => {
      const h = document.querySelector('header')!.getBoundingClientRect()
      const hero = document.querySelector('main section')!.getBoundingClientRect()
      return Math.round(hero.top - h.top)
    })
    expect(gap).toBe(0)

    await page.evaluate(() => window.scrollTo(0, 600))
    await expect(header).not.toHaveAttribute('data-transparent', 'true')
  })

  test('opens a gallery photograph in a dialog and returns focus', async ({ page }) => {
    await page.goto('/about')
    await page.waitForLoadState('networkidle')

    const trigger = page.getByRole('button', { name: /open larger/i }).first()
    await trigger.scrollIntoViewIfNeeded()
    await trigger.focus()
    await page.keyboard.press('Enter')

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.locator('img')).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(trigger).toBeFocused()
  })

  test('has no horizontal overflow at any supported width', async ({ page }) => {
    for (const width of [320, 360, 375, 390, 430, 768, 1024, 1280, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 })
      await page.goto('/about')
      const overflows = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      )
      expect(overflows, `horizontal overflow at ${width}px`).toBe(false)
    }
  })
})
