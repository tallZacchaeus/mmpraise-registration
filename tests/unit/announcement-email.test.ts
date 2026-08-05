import { describe, expect, it } from 'vitest'
import { announcementEmail, announcementPreview } from '@/lib/mail/templates'

/**
 * The announcement email is a notification, never the announcement.
 *
 * Decision (2026-08-05): volunteers sign in to read the full message; the
 * email carries the title and a short preview only. These tests keep that
 * boundary — a regression that pastes the body back into the mail would
 * silently undo the decision.
 */

const LONG_BODY = [
  'The stewards briefing moves to the north hall this year, and every volunteer',
  'serving on the first two days should arrive an hour early for orientation.',
  'Parking arrangements have also changed; use the east gate and bring your',
  'volunteer pass. Full rota details are on your dashboard.',
].join(' ')

describe('announcementPreview', () => {
  it('returns a short body whole', () => {
    expect(announcementPreview('Gates open at six.')).toBe('Gates open at six.')
  })

  it('cuts a long body at a word, with an ellipsis', () => {
    const preview = announcementPreview(LONG_BODY)
    expect(preview.length).toBeLessThanOrEqual(161)
    expect(preview.endsWith('…')).toBe(true)
    // Never mid-word: the character before the ellipsis ends a word.
    expect(preview.at(-2)).not.toBe(' ')
    expect(LONG_BODY.startsWith(preview.slice(0, -1))).toBe(true)
  })

  it('flattens newlines rather than leaking formatting into a one-line preview', () => {
    expect(announcementPreview('line one\n\nline two')).toBe('line one line two')
  })
})

describe('announcementEmail', () => {
  const mail = announcementEmail({
    name: 'Grace',
    title: 'Stewards briefing moved',
    body: LONG_BODY,
    loginUrl: 'https://volunteers.example.org/dashboard',
  })

  it('carries the title and the preview', () => {
    expect(mail.subject).toContain('Stewards briefing moved')
    expect(mail.html).toContain('Stewards briefing moved')
    expect(mail.text).toContain(announcementPreview(LONG_BODY).slice(0, 40))
  })

  it('never carries the full announcement', () => {
    expect(mail.html).not.toContain('use the east gate')
    expect(mail.text).not.toContain('use the east gate')
  })

  it('sends the reader to the dashboard to read it', () => {
    expect(mail.html).toContain('https://volunteers.example.org/dashboard')
    expect(mail.text).toContain('Sign in to read the full announcement')
  })
})
