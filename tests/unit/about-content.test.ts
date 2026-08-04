import { describe, expect, it } from 'vitest'
import { links } from '@/config/site'
import {
  aboutHero,
  aboutOverview,
  aboutVolunteerCta,
  commitments,
  contributors,
  gallery,
  impact,
  milestones,
  mission,
  vision,
} from '@/content/about'

/**
 * Guards for the About page content model.
 *
 * These lock in the corrections made during the rebuild so the specific defects
 * found on the WordPress About page cannot come back unnoticed — see
 * docs/ABOUT-AUDIT.md.
 */
describe('vision and mission', () => {
  it('does not repeat the same copy under both headings', () => {
    // On the source site both sections carry byte-identical body text.
    const visionText = [vision.statement, ...vision.paragraphs].join(' ').toLowerCase()
    const missionText = [mission.statement, ...mission.points.map((p) => p.body)]
      .join(' ')
      .toLowerCase()

    expect(visionText).not.toBe(missionText)

    // Stronger than inequality: no whole sentence may appear in both.
    const sentencesOf = (text: string) =>
      text
        .split(/(?<=\.)\s+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 30)

    const shared = sentencesOf(visionText).filter((s) => missionText.includes(s))
    expect(shared, 'Vision and Mission must not share sentences').toEqual([])
  })

  it('states a future for the vision and activities for the mission', () => {
    expect(vision.statement.length).toBeGreaterThan(20)
    // The mission is expressed as things the organisation does, so it must
    // carry discrete actions rather than one restated aspiration.
    expect(mission.points.length).toBeGreaterThanOrEqual(4)
    for (const point of mission.points) {
      expect(point.title.trim().length).toBeGreaterThan(3)
      expect(point.body.trim().length).toBeGreaterThan(20)
    }
  })

  it('gives the two sections different headings', () => {
    expect(vision.heading).not.toBe(mission.heading)
  })
})

describe('impact figures', () => {
  it('never publishes the contradicted country count as a fact', () => {
    // The About page says 50 countries, the homepage prose says 82 and the map
    // graphic reads 80. Until the organisation settles it, no number is shown.
    const nations = impact.stats.find((stat) => stat.id === 'nations')!
    expect(nations.value).toBeNull()
    expect(nations.label).toMatch(/many nations/i)

    const allText = impact.stats
      .flatMap((stat) => [stat.value ?? '', stat.label, stat.detail])
      .join(' ')
    for (const disputed of ['50 countries', '80 countries', '82 countries', '82 nations']) {
      expect(allText.toLowerCase()).not.toContain(disputed)
    }
  })

  it('keeps the figures the source page does state', () => {
    const byId = new Map(impact.stats.map((stat) => [stat.id, stat]))
    // Present on the About page and contradicted nowhere.
    expect(byId.get('worship-leaders')?.value).toBe('200')
    expect(byId.get('live')?.value).toMatch(/millions/i)
    expect(byId.get('online')?.value).toMatch(/tens of millions/i)
  })

  it('explains every figure rather than showing a bare number', () => {
    for (const stat of impact.stats) {
      expect(stat.label.trim().length).toBeGreaterThan(5)
      expect(stat.detail.trim().length).toBeGreaterThan(20)
    }
    // The section must say the numbers are still being confirmed.
    expect(impact.note).toMatch(/confirm/i)
  })
})

describe('history', () => {
  it('keeps the founding date and the reason the event began', () => {
    const founding = milestones.find((milestone) => milestone.id === 'founded')!
    expect(founding.date).toContain('2012')
    expect(founding.body).toMatch(/Adeboye/)
    expect(founding.body).toMatch(/Redeemed Christian Church of God/)
  })

  it('invents no milestones beyond what the site states', () => {
    // Three verified entries: the founding, the growth into a movement, and the
    // current edition. Anything more would be fabricated history.
    expect(milestones).toHaveLength(3)
    expect(new Set(milestones.map((m) => m.id)).size).toBe(milestones.length)
  })
})

describe('content preservation', () => {
  it('keeps the themes the source About page communicates', () => {
    const page = [
      aboutHero.standfirst,
      ...aboutOverview.paragraphs,
      ...milestones.map((m) => m.body),
      vision.statement,
      ...vision.paragraphs,
      mission.statement,
      ...mission.points.map((p) => p.body),
      ...commitments.items.map((c) => c.body),
    ]
      .join(' ')
      .toLowerCase()

    for (const theme of [
      'annual',
      'praise',
      'worship',
      'nations',
      'adeboye',
      'redeemed christian church of god',
      'communities',
      'transformed',
      'gospel',
    ]) {
      expect(page, `About page must still communicate "${theme}"`).toContain(theme)
    }
  })

  it('does not assert leadership or staff profiles', () => {
    // The source site names nobody as part of the team. Groups, not people.
    for (const group of contributors.groups) {
      expect(group.title.trim().length).toBeGreaterThan(3)
      expect(group.body.trim().length).toBeGreaterThan(20)
    }
    expect(contributors.groups.length).toBeGreaterThanOrEqual(4)
  })
})

describe('assets and links', () => {
  it('serves every About image from this project, never from WordPress', () => {
    const sources = [
      aboutHero.image.src,
      aboutOverview.image.src,
      impact.image.src,
      aboutVolunteerCta.image.src,
      ...gallery.images.map((image) => image.src),
    ]
    for (const src of sources) {
      expect(src.startsWith('/landing/')).toBe(true)
      expect(src).not.toContain('mmpraise.org')
      expect(src).not.toContain('wp-content')
    }
  })

  it('gives every content image descriptive alternative text', () => {
    const described = [
      aboutOverview.image,
      impact.image,
      aboutVolunteerCta.image,
      ...gallery.images,
    ]
    for (const image of described) {
      // The source page ships all three photographs with alt="".
      expect(image.alt.trim().length).toBeGreaterThan(15)
      expect(image.alt.toLowerCase()).not.toBe('image')
      expect(image.width).toBeGreaterThan(0)
      expect(image.height).toBeGreaterThan(0)
    }
  })

  it('sends the volunteer call to action to the registration application', () => {
    // The source page has a "volunteer with us" heading above an email box and
    // no link to the volunteer platform anywhere on the page.
    expect(aboutVolunteerCta.href).toBe(links.volunteer)
    expect(aboutVolunteerCta.href.length).toBeGreaterThan(1)
  })

  it('gives every commitment a heading, body and icon', () => {
    expect(new Set(commitments.items.map((item) => item.id)).size).toBe(commitments.items.length)
    for (const item of commitments.items) {
      expect(item.title.trim().length).toBeGreaterThan(3)
      expect(item.body.trim().length).toBeGreaterThan(20)
      expect(item.icon.length).toBeGreaterThan(2)
    }
  })
})
