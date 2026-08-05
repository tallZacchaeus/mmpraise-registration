import { describe, expect, it } from 'vitest'
import {
  actionsInCategory,
  CATEGORY_LABELS,
  describeAction,
  describeMetadata,
  securityActions,
} from '@/lib/audit/labels'
import { AUDIT_ACTIONS } from '@/lib/audit'

/**
 * The activity log's vocabulary.
 *
 * These assertions guard the two ways this feature fails quietly: an action
 * that renders as a raw code because nobody labelled it, and — worse — an
 * action that reads personal data but is missing from the security view, so a
 * compliance review looks complete while omitting it.
 */

describe('describeAction', () => {
  it('describes every action the system can record', () => {
    const unlabelled = AUDIT_ACTIONS.filter(
      (action) => describeAction(action).label === action.replace(/[._]/g, ' '),
    )
    expect(unlabelled).toEqual([])
  })

  it('still renders an action it has never seen, rather than hiding the row', () => {
    const described = describeAction('something.invented_later')
    expect(described.label).toBe('something invented later')
    expect(CATEGORY_LABELS[described.category]).toBeTruthy()
  })
})

describe('the security view', () => {
  it.each([
    'health.viewed',
    'testimony.contact_viewed',
    'document.downloaded',
    'application.exported',
    'user.role_changed',
    'settings.updated',
    'migration.invitations_sent',
  ])('includes %s — reading personal data or changing who can do what', (action) => {
    expect(securityActions()).toContain(action)
  })

  it('leaves out the ordinary traffic that would drown it', () => {
    expect(securityActions()).not.toContain('auth.login')
    expect(securityActions()).not.toContain('application.draft_saved')
  })
})

describe('categories', () => {
  it('puts every labelled action in exactly one category', () => {
    const counted = (Object.keys(CATEGORY_LABELS) as (keyof typeof CATEGORY_LABELS)[]).flatMap(
      (category) => actionsInCategory(category),
    )
    expect(new Set(counted).size).toBe(counted.length)
  })
})

describe('describeMetadata', () => {
  it('surfaces the numbers worth reading', () => {
    expect(describeMetadata({ count: 98, reason: 'Bulk approval' })).toBe(
      'count 98, reason Bulk approval',
    )
  })

  it('says nothing when there is nothing worth saying', () => {
    expect(describeMetadata(null)).toBeNull()
    expect(describeMetadata({ someInternalId: 'cm_123' })).toBeNull()
  })

  it('drops keys that are absent or false rather than printing them', () => {
    expect(describeMetadata({ isTest: false, count: 3 })).toBe('count 3')
  })
})
