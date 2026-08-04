import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  eventConfig,
  eventEndsAt,
  eventStartsAt,
  eventSummarySentence,
  formatEventDate,
  formatEventDateLong,
  formatEventDateTime,
  formatEventTime,
  isEventScheduled,
} from '@/config/site'

/**
 * The confirmed 2027 edition, and a guard against the old wording returning.
 *
 * Confirmed: 85 hours, from 02:00 West Africa Time on Monday 1 March 2027, at
 * the RCCG Prayer Foyer, New Arena, Redemption City.
 */
describe('current edition', () => {
  it('is the 85-hour 2027 edition', () => {
    expect(eventConfig.durationHours).toBe(85)
    expect(eventConfig.edition).toBe('2027')
    expect(eventConfig.editionName).toBe('85 Hours Marathon Messiah’s Praise')
    expect(eventConfig.editionLabel).toBe('85 Hours · 2027 edition')
  })

  it('starts at the confirmed instant, expressed with its offset', () => {
    // The offset is what makes this unambiguous — the same instant everywhere.
    expect(eventConfig.startsAt).toBe('2027-03-01T02:00:00+01:00')
    expect(new Date(eventConfig.startsAt).toISOString()).toBe('2027-03-01T01:00:00.000Z')
    expect(isEventScheduled()).toBe(true)
  })

  it('treats Africa/Lagos as authoritative', () => {
    expect(eventConfig.timezone).toBe('Africa/Lagos')
    expect(eventConfig.timezoneLabel).toBe('WAT')
  })

  it('records the confirmed venue', () => {
    expect(eventConfig.venue.name).toBe('RCCG Prayer Foyer, New Arena')
    expect(eventConfig.venue.city).toBe('Redemption City')
    expect(eventConfig.venue.country).toBe('Nigeria')
    expect(eventConfig.venue.fullAddress).toBe(
      'RCCG Prayer Foyer, New Arena, Redemption City, Nigeria',
    )
  })

  it('derives the end from the start plus 85 hours', () => {
    const start = eventStartsAt()!
    const end = eventEndsAt()!
    expect(end.getTime() - start.getTime()).toBe(85 * 3_600_000)
    // 02:00 on 1 March + 85h = 15:00 on 4 March, in Lagos.
    expect(formatEventDate(end)).toBe('4 March 2027')
  })
})

describe('formatting', () => {
  const start = eventStartsAt()!

  it('renders the confirmed date and time', () => {
    expect(formatEventDateLong(start)).toBe('Monday, 1 March 2027')
    expect(formatEventDate(start)).toBe('1 March 2027')
    expect(formatEventTime(start)).toBe('2:00 AM WAT')
    expect(formatEventDateTime(start)).toBe('1 March 2027 · 2:00 AM WAT')
  })

  it('never renders an ambiguous numeric date', () => {
    for (const rendered of [formatEventDate(start), formatEventDateLong(start)]) {
      expect(rendered).not.toMatch(/^\d{2}\/\d{2}\/\d{4}$/)
      expect(rendered).toMatch(/March/)
    }
  })

  it('shows 2:00 AM WAT whatever timezone the reader is in', () => {
    // The formatters pin timeZone, so the process timezone cannot shift it.
    const original = process.env.TZ
    for (const tz of ['UTC', 'America/New_York', 'Asia/Tokyo', 'Pacific/Kiritimati']) {
      process.env.TZ = tz
      expect(formatEventTime(start), tz).toBe('2:00 AM WAT')
      expect(formatEventDateLong(start), tz).toBe('Monday, 1 March 2027')
    }
    process.env.TZ = original
  })

  it('spells out the timezone in the accessible summary', () => {
    const summary = eventSummarySentence()
    expect(summary).toContain('85 Hours Marathon Messiah’s Praise')
    expect(summary).toContain('Monday, 1 March 2027')
    expect(summary).toContain('2:00 AM')
    // "WAT" is read as a word by screen readers; the full name is not.
    expect(summary).toContain('West Africa Time')
  })
})

/**
 * Repository guard.
 *
 * Fails if superseded current-edition wording reappears in active source.
 * Historical references are legitimate — testimonies about the 80-hour edition,
 * the audit documents recording what the old WordPress site said, and the seed
 * comment explaining why the duration increments — so only active application
 * code is scanned, and the two files that legitimately mention past editions
 * are listed explicitly.
 */
describe('no superseded edition wording in active source', () => {
  const root = path.resolve(process.cwd(), 'src')

  /**
   * Per-pattern exemptions.
   *
   * Broad file allowlists hide regressions, so each exemption names the one
   * pattern it excuses and why. Everything else in those files is still
   * checked.
   */
  const BANNED: { pattern: RegExp; allow?: string[] }[] = [
    /*
     * The migration upload form asks which *past* edition a list of people
     * served at, and shows one as a placeholder. That is a historical
     * reference by definition — the field would be meaningless filled in with
     * the current edition — so it is exempted from both edition-name patterns
     * rather than being rewritten into something nobody would recognise.
     */
    {
      pattern: /84\s*Hours\s+Marathon/i,
      allow: ['config/site.ts', 'components/admin/migration/upload-form.tsx'],
    },
    {
      pattern: /Marathon Messiah’?s Praise 2026/i,
      allow: ['components/admin/migration/upload-form.tsx'],
    },
    { pattern: /\b2026 edition\b/i },
    {
      pattern: /dates? to be announced/i,
      /**
       * These hold the fallback branch for a start time that is not
       * configured. It is unreachable while `eventConfig.startsAt` has a value
       * — asserted below — but deleting it would mean a cleared environment
       * variable rendered an empty date rather than an honest message.
       */
      allow: [
        'app/(admin)/admin/page.tsx',
        'app/(auth)/layout.tsx',
        'app/(volunteer)/dashboard/page.tsx',
        'app/page.tsx',
        'components/site/event-countdown.tsx',
        'components/volunteer/countdown-compact.tsx',
      ],
    },
  ]

  function walk(dir: string): string[] {
    return readdirSync(dir).flatMap((entry) => {
      const full = path.join(dir, entry)
      if (entry === 'generated' || entry === 'node_modules') return []
      return statSync(full).isDirectory()
        ? walk(full)
        : /\.(ts|tsx)$/.test(entry)
          ? [full]
          : []
    })
  }

  it('contains no superseded current-edition strings', () => {
    const offenders: string[] = []

    for (const file of walk(root)) {
      const relative = path.relative(root, file)
      // Testimonies quote worshippers describing the 80-hour edition verbatim
      // and must never be rewritten.
      if (relative === path.join('content', 'homepage.ts')) continue

      const text = readFileSync(file, 'utf8')
      for (const { pattern, allow } of BANNED) {
        if (allow?.some((allowed) => relative === allowed.split('/').join(path.sep))) continue
        if (pattern.test(text)) {
          offenders.push(`${path.relative(process.cwd(), file)} matches ${pattern}`)
        }
      }
    }

    expect(offenders).toEqual([])
  })

  it('never renders the unscheduled fallback, because a date is configured', () => {
    // What makes the exemption above safe: the branch exists but cannot run.
    expect(isEventScheduled()).toBe(true)
    expect(eventStartsAt()).not.toBeNull()
  })

  it('still allows genuine historical references', () => {
    // The 80-hour testimonies are real accounts and must never be rewritten.
    const homepage = readFileSync(path.join(root, 'content', 'homepage.ts'), 'utf8')
    expect(homepage).toContain('80 Hours Marathon Messiah’s Praise')
  })
})
