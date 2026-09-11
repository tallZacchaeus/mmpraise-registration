import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

/**
 * The "I will be attending" share card.
 *
 * The whole feature is a canvas: a photograph drawn inside the artwork's
 * transparent window, the artwork painted over the top, and a JPEG handed back
 * to the volunteer. None of that is visible to a DOM assertion, so these tests
 * read the canvas pixels instead — the only way to prove the photograph landed
 * inside the window rather than over the wording, and that the frame is on top.
 *
 * The photograph is generated in the page rather than committed as a fixture,
 * so the corner markers can be primary colours that no artwork pixel shares.
 */

/** Measured from `public/landing/ugc/frame.png`. Keep in step with the component. */
const SLOT = { x: 345, y: 874, w: 1310, h: 993 }

/**
 * Put a known image into the file input the way a person picking a file does.
 * Yellow top-left and magenta bottom-right corners make cropping observable.
 */
async function choosePhoto(page: import('@playwright/test').Page) {
  await page.evaluate(async () => {
    const source = document.createElement('canvas')
    source.width = 1600
    source.height = 1200
    const context = source.getContext('2d')!

    /*
     * Narrow vertical stripes, not a flat fill.
     *
     * The photograph has to carry enough detail for a few pixels of movement
     * to be measurable: a flat colour slid past a sample point changes nothing
     * at all, so a broken pan would be indistinguishable from a working one.
     * Stripes give `windowSignature` something to see.
     *
     * Neither colour is white, so the "no gap in the window" assertion stays
     * meaningful.
     */
    for (let x = 0; x < 1600; x += 20) {
      context.fillStyle = (x / 20) % 2 === 0 ? '#0b3d91' : '#00a86b'
      context.fillRect(x, 0, 20, 1200)
    }

    // Primary-colour corners no artwork pixel shares, so cropping is visible.
    context.fillStyle = '#ffff00'
    context.fillRect(0, 0, 120, 120)
    context.fillStyle = '#ff00ff'
    context.fillRect(1480, 1080, 120, 120)

    const blob = await new Promise<Blob | null>((resolve) => source.toBlob(resolve, 'image/png'))
    const transfer = new DataTransfer()
    transfer.items.add(new File([blob!], 'photo.png', { type: 'image/png' }))
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!
    input.files = transfer.files
    input.dispatchEvent(new Event('change', { bubbles: true }))
  })
  // The card only redraws once the photograph has decoded.
  await expect(page.getByText(/photo added/i)).toBeVisible({ timeout: 20_000 })
}

/** One pixel of the rendered card, as `r,g,b`. */
function pixel(page: import('@playwright/test').Page, x: number, y: number) {
  return page.evaluate(
    ([px, py]) => {
      const canvas = document.querySelector('canvas')!
      const data = canvas.getContext('2d')!.getImageData(px, py, 1, 1).data
      return `${data[0]},${data[1]},${data[2]}`
    },
    [x, y],
  )
}

/**
 * A hash of one row of pixels across the window.
 *
 * Movement assertions need to detect a shift of a few pixels. Sampling a
 * single point cannot: a flat photo never changes, a smooth gradient changes
 * by less than one 8-bit step, and a striped one can land back on a stripe of
 * the same colour. Hashing a whole row changes whenever anything moves.
 */
function windowSignature(page: import('@playwright/test').Page) {
  return page.evaluate(
    ([x, y, w]) => {
      const canvas = document.querySelector('canvas')!
      const data = canvas.getContext('2d')!.getImageData(x, y, w, 1).data
      let hash = 0
      for (let i = 0; i < data.length; i += 4) {
        hash = (hash * 31 + data[i] + data[i + 1] * 7 + data[i + 2] * 13) >>> 0
      }
      return hash
    },
    [SLOT.x, SLOT.y + Math.floor(SLOT.h / 2), SLOT.w],
  )
}

test.describe('attending card', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/attending')
    await expect(page.getByRole('heading', { level: 1, name: /i will be attending/i })).toBeVisible({
      timeout: 30_000,
    })
  })

  test('says plainly that the photo never leaves the device', async ({ page }) => {
    // People are reasonably wary of giving a photograph of themselves to a
    // website. The claim is load-bearing, so it has to be on the page.
    await expect(page.getByText(/never leaves your device/i)).toBeVisible()
  })

  test('draws the photo inside the window and the frame over the top', async ({ page }) => {
    await choosePhoto(page)

    // The photo's own corner markers, proving the window is filled edge to edge
    // and the picture is not merely floating somewhere on the card.
    expect(await pixel(page, SLOT.x + 6, SLOT.y + 6)).toBe('255,255,0')
    expect(await pixel(page, SLOT.x + SLOT.w - 6, SLOT.y + SLOT.h - 6)).toBe('255,0,255')

    // Outside the window the artwork must survive — if the photograph were
    // drawn unclipped it would cover the wording and the date.
    const leftOfWindow = await pixel(page, SLOT.x - 40, SLOT.y + SLOT.h / 2)
    expect(leftOfWindow).not.toBe('255,255,0')
    expect(leftOfWindow).not.toBe('0,0,0')
  })

  test('zoom crops into the photo without exposing the window', async ({ page }) => {
    await choosePhoto(page)
    const before = await windowSignature(page)

    await page.getByLabel(/zoom/i).fill('2')

    await expect.poll(() => windowSignature(page), { timeout: 10_000 }).not.toBe(before)

    // The corner marker is cropped away, and no gap opens in the window.
    expect(await pixel(page, SLOT.x + 6, SLOT.y + 6)).not.toBe('255,255,0')
    expect(await pixel(page, SLOT.x + 6, SLOT.y + 6)).not.toBe('255,255,255')
  })

  test('exports a JPEG small enough to share', async ({ page }) => {
    await choosePhoto(page)

    const file = await page.evaluate(async () => {
      const canvas = document.querySelector('canvas')!
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', 0.92),
      )
      const head = new Uint8Array(await blob!.slice(0, 3).arrayBuffer())
      return { type: blob!.type, size: blob!.size, jpeg: head[0] === 0xff && head[1] === 0xd8 }
    })

    expect(file.jpeg).toBe(true)
    expect(file.type).toBe('image/jpeg')
    // Comfortably under the 5MB some share targets refuse. The PNG was 4.6MB.
    expect(file.size).toBeLessThan(3 * 1024 * 1024)
  })

  test('downloads the card', async ({ page }) => {
    await choosePhoto(page)
    const download = page.waitForEvent('download')
    await page.getByRole('button', { name: /download/i }).click()
    expect((await download).suggestedFilename()).toMatch(/\.jpg$/)
  })

  test('the photo can be repositioned from the keyboard alone', async ({ page }) => {
    await choosePhoto(page)

    /*
     * Zoom first. The fixture photo is 4:3 and so is the window, so at zoom 1
     * the picture covers it with about seven pixels to spare and panning is
     * correctly clamped to nearly nothing — there is no hidden photo to bring
     * into view. Zooming creates the overhang that makes moving meaningful.
     */
    await page.getByLabel(/zoom/i).fill('2')

    const canvas = page.locator('canvas')
    await canvas.focus()
    const before = await windowSignature(page)

    for (let press = 0; press < 12; press++) await page.keyboard.press('ArrowRight')
    await expect.poll(() => windowSignature(page), { timeout: 10_000 }).not.toBe(before)
  })

  test('panning against the edge does not bank movement to unwind', async ({ page }) => {
    await choosePhoto(page)
    await page.getByLabel(/zoom/i).fill('2')
    const canvas = page.locator('canvas')
    await canvas.focus()

    // Drive hard into the right-hand stop, far past what the overhang allows.
    for (let press = 0; press < 60; press++) await page.keyboard.press('ArrowRight')
    const atStop = await windowSignature(page)

    /*
     * A single press back must move the picture. Clamping only at draw time
     * stored every one of those presses, so coming back took as many presses
     * as went in and the control felt broken.
     */
    await page.keyboard.press('ArrowLeft')
    await expect.poll(() => windowSignature(page), { timeout: 10_000 }).not.toBe(atStop)
  })

  test('has no detectable accessibility violations', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    const results = await new AxeBuilder({ page }).analyze()
    expect(JSON.stringify(results.violations, null, 2)).toBe('[]')
  })

  test('has no horizontal overflow at any supported width', async ({ page }) => {
    for (const width of [320, 375, 768, 1024, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 })
      await page.goto('/attending')
      const overflows = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      )
      expect(overflows, `overflow at ${width}px`).toBe(false)
    }
  })
})
