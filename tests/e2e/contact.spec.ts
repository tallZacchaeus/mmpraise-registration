import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { clearRateLimits } from './rate-limit'

/**
 * The contact page as a visitor meets it.
 *
 * Guards the defects found on https://mmpraise.org/contact-us/: four unlabelled
 * fields none of which are required, a message field named `prayer-request`, a
 * real telephone number in the body with a placeholder one in the footer of the
 * same page, no metadata or structured data, and a heading order that jumps.
 */
test.describe('contact page', () => {
  test.beforeEach(async () => {
    await clearRateLimits()
  })

  test('has one H1 and a heading order that never skips a level', async ({ page }) => {
    await page.goto('/contact')

    await expect(page.locator('h1')).toHaveCount(1)
    await expect(page.locator('h1')).toContainText(/stay connected with mmpraise/i)

    const levels = await page
      .locator('main h1, main h2, main h3, main h4')
      .evaluateAll((nodes) => nodes.map((node) => Number(node.tagName[1])))

    expect(levels[0]).toBe(1)
    for (let i = 1; i < levels.length; i += 1) {
      expect(levels[i] - levels[i - 1]).toBeLessThanOrEqual(1)
    }
  })

  test('publishes metadata, canonical and structured data', async ({ page }) => {
    await page.goto('/contact')

    await expect(page).toHaveTitle(/contact mmpraise/i)
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /get in touch/i)
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/contact$/)

    const jsonLd = await page.locator('script[type="application/ld+json"]').first().textContent()
    const types = JSON.parse(jsonLd!)['@graph'].map((n: { '@type': string }) => n['@type'])
    expect(types).toContain('ContactPage')
    expect(types).toContain('Organization')
    expect(types).toContain('BreadcrumbList')
    expect(types).toContain('FAQPage')
  })

  test('never shows the placeholder telephone number', async ({ page }) => {
    await page.goto('/contact')

    const body = await page.locator('body').innerText()
    // The current site publishes "+234 XXX-XXXX-XXX" in the footer of this very page.
    expect(body).not.toContain('XXX')
    expect(body).toContain('+234 703 385 3817')

    // The same number, in both the contact card and the shared footer.
    const shown = body.match(/\+234[\d\s]+/g) ?? []
    const unique = new Set(shown.map((s) => s.trim()))
    expect(unique.size).toBe(1)
  })

  test('labels every form field and marks what is required', async ({ page }) => {
    await page.goto('/contact')

    const unlabelled = await page.evaluate(() =>
      [...document.querySelectorAll('form input:not([type=hidden]), form textarea, form select')]
        .filter(
          (el) =>
            !(el as HTMLInputElement).labels?.length &&
            !el.getAttribute('aria-label') &&
            !el.closest('[aria-hidden]'),
        )
        .map((el) => el.id),
    )
    expect(unlabelled).toEqual([])

    for (const id of ['contact-name', 'contact-email', 'contact-subject', 'contact-message']) {
      await expect(page.locator(`#${id}`)).toBeVisible()
    }
    // The category selector is the fix for a form that never asked what it was about.
    await expect(page.locator('#contact-category')).toBeVisible()
  })

  test('reports validation errors accessibly and keeps what was typed', async ({ page }) => {
    await page.goto('/contact')

    await page.locator('#contact-name').fill('Adaeze Okonkwo')
    await page.locator('#contact-email').fill('not-an-email')
    await page.locator('#contact-subject').fill('Hi')
    await page.locator('#contact-message').fill('too short')
    await page.getByRole('button', { name: /send message/i }).click()

    const summary = page.locator('#contact-errors')
    await expect(summary).toBeVisible()
    await expect(summary).toHaveAttribute('role', 'alert')

    // Nothing entered is lost when validation fails.
    await expect(page.locator('#contact-name')).toHaveValue('Adaeze Okonkwo')
    await expect(page.locator('#contact-email')).toHaveValue('not-an-email')
  })

  test('accepts a complete message and confirms it is not published', async ({ page }) => {
    await page.goto('/contact')

    await page.locator('#contact-category').selectOption('MEDIA')
    await page.locator('#contact-name').fill('Adaeze Okonkwo')
    await page.locator('#contact-email').fill(`contact.${Date.now()}@example.com`)
    await page.locator('#contact-phone').fill('+2348039876543')
    await page.locator('#contact-subject').fill('Press accreditation for the marathon')
    await page
      .locator('#contact-message')
      .fill('I write for a national broadcaster and would like to request press accreditation.')

    await page.getByRole('button', { name: /send message/i }).click()

    // A success confirmation is role="status", not role="alert" — it reports
    // without interrupting whatever the screen reader is currently saying.
    const success = page.getByRole('status').filter({ hasText: /thank you for reaching out/i })
    await expect(success).toBeVisible({ timeout: 15_000 })
    await expect(success).toContainText(/not published anywhere/i)
  })

  test('separates volunteering from sending a message', async ({ page }) => {
    await page.goto('/contact')

    // The source page has a volunteer heading above a bare email box.
    const volunteer = page.locator('section', { has: page.locator('#volunteer-heading') })
    await expect(volunteer.getByRole('link', { name: /apply to volunteer/i })).toHaveAttribute(
      'href',
      '/register',
    )
    // No email field anywhere in the volunteer section.
    await expect(volunteer.locator('input[type="email"]')).toHaveCount(0)
  })

  test('requests nothing from a third party until the map is asked for', async ({ page }) => {
    const external: string[] = []
    page.on('request', (request) => {
      if (!request.url().includes('localhost')) external.push(request.url())
    })

    await page.goto('/contact', { waitUntil: 'networkidle' })
    expect(external).toEqual([])

    // The address and a plain link are available without loading anything.
    await expect(page.getByRole('link', { name: /open in google maps/i })).toBeVisible()
  })

  test('opens every FAQ from the keyboard', async ({ page }) => {
    await page.goto('/contact')
    await page.waitForLoadState('networkidle')

    const questions = page.getByRole('button', { name: /\?$/ })
    await expect(questions).toHaveCount(6)

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

  test('overlays the hero at the top and turns solid on scroll', async ({ page }) => {
    await page.goto('/contact')
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

    await page.evaluate(() => window.scrollTo(0, 700))
    await expect(header).not.toHaveAttribute('data-transparent', 'true')
  })

  test('has no dead links and marks external links safely', async ({ page }) => {
    await page.goto('/contact')

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
    await page.goto('/contact')
    const results = await new AxeBuilder({ page }).analyze()
    expect(JSON.stringify(results.violations, null, 2)).toBe('[]')
  })

  test('puts contact details before the routing hub', async ({ page }) => {
    await page.goto('/contact')

    const order = await page
      .locator('main section')
      .evaluateAll((nodes) => nodes.map((n) => n.getAttribute('aria-labelledby') ?? '(hero)'))

    /*
     * Someone who only wants a phone number should not have to choose a
     * "route" first. Details come immediately after the hero; the routing hub
     * follows for people who need something more specific.
     *
     * This is DOM order, so it is also the reading, keyboard and focus order.
     */
    expect(order).toEqual([
      '(hero)',
      'trust-heading',
      'details-heading',
      'channels-heading',
      'send-message-heading',
      'volunteer-heading',
      'social-heading',
      'faq-heading',
      'closing-heading',
    ])
  })

  test('alternates surfaces so adjacent sections stay distinct', async ({ page }) => {
    await page.goto('/contact')

    // Reordering swapped which section sits next to the tinted trust band, so
    // the two treatments had to swap with them or two tinted blocks would meet.
    const [details, channels, form] = await Promise.all(
      ['details-heading', 'channels-heading', 'send-message-heading'].map((id) =>
        page
          .locator(`[aria-labelledby="${id}"]`)
          .evaluate((el) => getComputedStyle(el).backgroundColor),
      ),
    )
    expect(details).not.toBe(channels)
    expect(channels).not.toBe(form)
  })

  test('has no horizontal overflow at any supported width', async ({ page }) => {
    for (const width of [320, 360, 375, 390, 430, 768, 1024, 1280, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 })
      await page.goto('/contact')
      const overflows = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      )
      expect(overflows, `horizontal overflow at ${width}px`).toBe(false)
    }
  })
})
