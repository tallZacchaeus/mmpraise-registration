import { describe, expect, it } from 'vitest'
import {
  eventConfig,
  eventEndsAt,
  eventStartsAt,
  isEventScheduled,
  isExternal,
  links,
  socialLinks,
} from '@/config/site'
import { primaryNav } from '@/content/navigation'
import {
  artists,
  faqs,
  mediaResources,
  participationActions,
  testimonies,
} from '@/content/homepage'

/**
 * Guards for the homepage content model.
 *
 * These lock in the corrections made during the rebuild, so the specific
 * defects found on the WordPress homepage cannot come back unnoticed — see
 * docs/HOMEPAGE-AUDIT.md.
 */
describe('event configuration', () => {
  it('uses one duration everywhere, resolving the 82 vs 84 hours conflict', () => {
    expect(eventConfig.durationHours).toBeGreaterThan(0)

    // Every FAQ that mentions an hour count must use the configured one.
    const hourMentions = faqs
      .flatMap((faq) => [faq.question, faq.answer])
      .flatMap((text) => [...text.matchAll(/(\d{2})\s*Hours/gi)].map((match) => Number(match[1])))

    for (const mention of hourMentions) {
      expect(mention, 'FAQ hour count must match eventConfig.durationHours').toBe(
        eventConfig.durationHours,
      )
    }
  })

  it('derives the end time from the start and duration once a date is set', () => {
    const start = eventStartsAt()
    const end = eventEndsAt()

    if (!isEventScheduled()) {
      // The 2027 date is not confirmed yet, so nothing should be derived.
      expect(start).toBeNull()
      expect(end).toBeNull()
      return
    }

    expect(end!.getTime() - start!.getTime()).toBe(eventConfig.durationHours * 3_600_000)
  })

  it('never exposes an unparseable start time', () => {
    if (!eventConfig.startsAt) {
      expect(isEventScheduled()).toBe(false)
      return
    }
    expect(Number.isNaN(new Date(eventConfig.startsAt).getTime())).toBe(false)
  })

  it('does not state a date in the FAQ while the date is unconfirmed', () => {
    if (isEventScheduled()) return

    const dateAnswer = faqs.find((faq) => faq.id === 'when-does-it-begin')!.answer
    // No specific day/month should be asserted before the organisation confirms it.
    expect(dateAnswer).toMatch(/not been confirmed/i)
    expect(dateAnswer).not.toMatch(/\b\d{1,2}\s+(January|February|March|April|May|June|July|August|September|October|November|December)\b/i)
  })

  it('increments the duration by one hour per edition', () => {
    // 2026 ran for 84 hours; each edition adds an hour.
    const editionYear = Number(eventConfig.edition)
    if (!Number.isFinite(editionYear)) return
    expect(eventConfig.durationHours).toBe(84 + (editionYear - 2026))
  })
})

describe('links', () => {
  it('never exposes a dead "#" destination', () => {
    const navHrefs = primaryNav.flatMap((item) => [item.href, ...(item.children ?? []).map((c) => c.href)])
    for (const href of navHrefs) {
      expect(href === '#').toBe(false)
    }
  })

  it('marks menu items without a destination as coming soon rather than linking nowhere', () => {
    for (const item of primaryNav.flatMap((entry) => entry.children ?? [])) {
      if (!item.href) expect(item.comingSoon).toBe(true)
    }
  })

  it('sends registration and volunteering to the registration application', () => {
    // Same-origin routes keep the two systems feeling like one product.
    expect(isExternal(links.register)).toBe(false)
    expect(isExternal(links.volunteer)).toBe(false)
  })

  it('only lists social profiles that have a real URL', () => {
    for (const social of socialLinks) {
      expect(social.href).toMatch(/^https?:\/\//)
    }
  })

  it('gives every live participation action a destination and an outcome', () => {
    for (const action of participationActions) {
      // A null href means the feature is not live yet and the card renders
      // "Coming soon" instead of a link.
      if (action.href === null) continue
      expect(action.href.length).toBeGreaterThan(1)
      expect(action.href).not.toBe('#')
      // The card must say what happens after the click.
      expect(action.outcome.length).toBeGreaterThan(10)
    }
  })

  it('keeps registration and volunteering live regardless of launch flags', () => {
    // The homepage and the registration journey are the first release; these
    // two must never be gated off.
    const attend = participationActions.find((action) => action.id === 'attend')!
    const volunteer = participationActions.find((action) => action.id === 'volunteer')!
    expect(attend.href).toBe(links.register)
    expect(volunteer.href).toBe(links.volunteer)
    expect(attend.href).toBeTruthy()
    expect(volunteer.href).toBeTruthy()
  })

  it('marks media resources without a URL as coming soon', () => {
    for (const resource of mediaResources) {
      if (!resource.href) expect(resource.comingSoon).toBe(true)
    }
  })
})

describe('testimonies', () => {
  it('contains no duplicates — the live slider repeats five of seven', () => {
    const bodies = testimonies.map((testimony) => testimony.body.trim())
    expect(new Set(bodies).size).toBe(bodies.length)

    const ids = testimonies.map((testimony) => testimony.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('attributes each testimony to exactly one person', () => {
    // On the live site the same text appears under two different names.
    const byBody = new Map<string, Set<string>>()
    for (const testimony of testimonies) {
      const authors = byBody.get(testimony.body) ?? new Set<string>()
      authors.add(testimony.author)
      byBody.set(testimony.body, authors)
    }
    for (const [, authors] of byBody) expect(authors.size).toBe(1)
  })

  it('keeps every unique testimony from the source homepage', () => {
    expect(testimonies).toHaveLength(7)
  })

  it('gives each testimony an author and a country', () => {
    for (const testimony of testimonies) {
      expect(testimony.author.trim().length).toBeGreaterThan(1)
      expect(testimony.country.trim().length).toBeGreaterThan(1)
      expect(testimony.title.trim().length).toBeGreaterThan(1)
    }
  })
})

describe('faqs', () => {
  it('keeps all thirteen questions from the source homepage', () => {
    expect(faqs).toHaveLength(13)
  })

  it('has a unique id and a non-empty answer for every question', () => {
    expect(new Set(faqs.map((faq) => faq.id)).size).toBe(faqs.length)
    for (const faq of faqs) {
      expect(faq.question.trim().endsWith('?')).toBe(true)
      expect(faq.answer.trim().length).toBeGreaterThan(20)
    }
  })
})

describe('artists', () => {
  it('keeps all seven portraits and allows names to be added later', () => {
    expect(artists).toHaveLength(7)
    for (const artist of artists) {
      expect(artist.image.src).toMatch(/^\/landing\//)
      // Names are not published on the source site; the field exists so they can
      // be supplied without a component change.
      expect(artist).toHaveProperty('name')
      expect(artist).toHaveProperty('country')
      expect(artist).toHaveProperty('role')
    }
  })
})

describe('assets', () => {
  it('serves every homepage image from this project, never from WordPress', () => {
    const sources = [
      ...artists.map((artist) => artist.image.src),
    ]
    for (const src of sources) {
      expect(src.startsWith('/landing/')).toBe(true)
      expect(src).not.toContain('mmpraise.org')
      expect(src).not.toContain('wp-content')
    }
  })
})
