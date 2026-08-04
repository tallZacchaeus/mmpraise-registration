import { describe, expect, it } from 'vitest'
import { contact, links, phoneHref } from '@/config/site'
import {
  contactCategories,
  contactChannels,
  contactDetails,
  contactFaqs,
  contactVolunteer,
} from '@/content/contact'

/**
 * Guards for the contact page content model.
 *
 * These lock in the corrections made during the rebuild so the specific defects
 * found on the WordPress contact page cannot come back — see
 * docs/CONTACT-AUDIT.md.
 */
describe('contact details', () => {
  it('publishes the real telephone number, never the placeholder', () => {
    // The source page shows "+234 703 385 3817" in the body and
    // "+234 XXX-XXXX-XXX" in the footer of the same page.
    expect(contact.phone).toBe('+234 703 385 3817')
    expect(contact.phone).not.toContain('X')
  })

  it('builds a dialable tel: link from the display number', () => {
    expect(phoneHref('+234 703 385 3817')).toBe('tel:+2347033853817')
    expect(phoneHref(contact.phone)).not.toMatch(/\s/)
  })

  it('keeps the visiting address the contact page publishes', () => {
    expect(contact.visitAddress).toMatch(/Redemption Camp/i)
    expect(contact.visitAddress).toMatch(/Ogun State/i)
    expect(contact.visitMapUrl).toMatch(/^https:\/\//)
  })

  it('hides any detail without a confirmed value rather than showing a placeholder', () => {
    for (const detail of contactDetails.items) {
      if (detail.value === null) continue
      expect(detail.value.trim().length).toBeGreaterThan(3)
      expect(detail.value).not.toContain('XXX')
      expect(detail.note.trim().length).toBeGreaterThan(10)
    }
  })

  it('does not invent departmental email addresses', () => {
    // Media and partnership are routed through the form's category list, because
    // the organisation publishes no press@ or partners@ address.
    const emails = contactDetails.items
      .map((detail) => detail.value ?? '')
      .filter((value) => value.includes('@'))
    expect(emails).toEqual([contact.email])
  })
})

describe('communication channels', () => {
  it('gives every channel a real destination or none at all', () => {
    for (const channel of contactChannels.items) {
      if (channel.href === null) continue
      expect(channel.href).not.toBe('#')
      expect(channel.href.length).toBeGreaterThan(1)
      expect(channel.description.trim().length).toBeGreaterThan(20)
      expect(channel.linkLabel.trim().length).toBeGreaterThan(2)
    }
  })

  it('keeps registering and volunteering separate from sending a message', () => {
    const byId = new Map(contactChannels.items.map((channel) => [channel.id, channel]))
    expect(byId.get('volunteer')?.href).toBe(links.volunteer)
    expect(byId.get('register')?.href).toBe(links.register)
    // The general channel points at the form on this page, not at a route.
    expect(byId.get('general')?.href).toBe('#send-message')
    expect(byId.get('general')?.onThisPage).toBe(true)
  })

  it('has a unique id for every channel', () => {
    const ids = contactChannels.items.map((channel) => channel.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('form categories', () => {
  it('offers the enquiry types the source form never asked about', () => {
    const values = contactCategories.map((category) => category.value)
    for (const expected of [
      'GENERAL',
      'EVENT_INFORMATION',
      'REGISTRATION_SUPPORT',
      'VOLUNTEER',
      'MEDIA',
      'PARTNERSHIP',
    ]) {
      expect(values).toContain(expected)
    }
  })

  it('has a unique value and a readable label for each', () => {
    const values = contactCategories.map((category) => category.value)
    expect(new Set(values).size).toBe(values.length)
    for (const category of contactCategories) {
      expect(category.label.trim().length).toBeGreaterThan(3)
      // Labels are prose, not shouted enum names.
      expect(category.label).not.toBe(category.value)
    }
  })
})

describe('volunteer section', () => {
  it('links to the volunteer application rather than collecting an email', () => {
    // The source page has a volunteer heading above a bare email box.
    expect(contactVolunteer.href).toBe(links.volunteer)
    expect(contactVolunteer.paragraphs.length).toBeGreaterThanOrEqual(2)
    expect(contactVolunteer.ctaLabel).toMatch(/volunteer/i)
  })
})

describe('faqs', () => {
  it('asks real questions and answers each of them', () => {
    expect(contactFaqs.length).toBeGreaterThanOrEqual(5)
    expect(new Set(contactFaqs.map((faq) => faq.id)).size).toBe(contactFaqs.length)
    for (const faq of contactFaqs) {
      expect(faq.question.trim().endsWith('?')).toBe(true)
      expect(faq.answer.trim().length).toBeGreaterThan(30)
    }
  })

  it('promises no response time the organisation has not published', () => {
    const answers = contactFaqs.map((faq) => faq.answer).join(' ').toLowerCase()
    for (const promise of [
      'within 24 hours',
      'within 48 hours',
      'same day',
      'within a week',
      'business days',
    ]) {
      expect(answers).not.toContain(promise)
    }
  })
})
