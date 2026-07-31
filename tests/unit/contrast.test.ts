import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * WCAG 2.1 contrast checks on the design tokens.
 *
 * These read the real values out of globals.css, so a future palette change that
 * breaks accessibility fails the build rather than shipping quietly.
 */
function channel(value: number) {
  const c = value / 255
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

function luminance(hex: string) {
  const n = parseInt(hex.replace('#', ''), 16)
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
}

function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

const css = readFileSync(path.resolve(process.cwd(), 'src/app/globals.css'), 'utf8')

function token(name: string): string {
  const match = css.match(new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})`))
  if (!match) throw new Error(`Design token --color-${name} not found in globals.css`)
  return match[1]!
}

const WHITE = '#ffffff'

describe('design token contrast', () => {
  it('body text meets AA for normal text on white (4.5:1)', () => {
    expect(contrast(token('body'), WHITE)).toBeGreaterThanOrEqual(4.5)
  })

  it('heading ink meets AAA on white (7:1)', () => {
    expect(contrast(token('ink'), WHITE)).toBeGreaterThanOrEqual(7)
  })

  it('muted secondary text still meets AA on white', () => {
    expect(contrast(token('muted'), WHITE)).toBeGreaterThanOrEqual(4.5)
  })

  it('interactive primary meets AA for normal text, in both directions', () => {
    // Used for link text on white and for white label text on filled buttons.
    expect(contrast(token('primary'), WHITE)).toBeGreaterThanOrEqual(4.5)
  })

  it('primary hover stays at least as readable as the resting state', () => {
    expect(contrast(token('primary-hover'), WHITE)).toBeGreaterThanOrEqual(contrast(token('primary'), WHITE))
  })

  it('status colours meet AA on white', () => {
    for (const name of ['success', 'warning', 'danger', 'info']) {
      expect(contrast(token(name), WHITE), `${name} on white`).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('white text on the dark section background meets AA', () => {
    expect(contrast(WHITE, token('night'))).toBeGreaterThanOrEqual(4.5)
  })

  it('section eyebrow labels meet AA on the tinted background', () => {
    // 14px text, so the 4.5:1 threshold applies rather than the large-text 3:1.
    expect(contrast(token('primary-active'), token('primary-subtle'))).toBeGreaterThanOrEqual(4.5)
  })

  it('documents that the decorative brand orange is not AA for normal text', () => {
    // This is why --color-primary exists separately: the brand orange is
    // reserved for large display type, where 3:1 is the AA threshold.
    const brandOnWhite = contrast(token('brand'), WHITE)
    expect(brandOnWhite).toBeLessThan(4.5)
    expect(brandOnWhite).toBeGreaterThanOrEqual(3)
  })
})
