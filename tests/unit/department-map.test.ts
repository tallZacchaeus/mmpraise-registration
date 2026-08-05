import { describe, expect, it } from 'vitest'
import { currentDepartmentName } from '@/lib/migration/department-map'

/**
 * The confirmed legacy mapping (2026-08-05): every legacy name is its own
 * team; Security/Protocol continues as Protocol.
 */
describe('currentDepartmentName', () => {
  it.each([
    ['Volunteers Praise Team', 'Volunteers Praise Team'],
    ['Welfare', 'Welfare'],
    ['Soteria', 'Soteria'],
    ['Sanitation', 'Sanitation'],
    ['Medical', 'Medical'],
    ['Logistics', 'Logistics'],
    ['Security', 'Security'],
    ['Registration Team', 'Registration Team'],
    ['Media', 'Media'],
    ['Ushering', 'Ushering'],
    ['Accommodation Logistics', 'Accommodation Logistics'],
    ['Transportation Logistics', 'Transportation Logistics'],
    ['Registration Unit', 'Registration Unit'],
    ['Medical Officer', 'Medical Officer'],
  ])('maps %s to itself', (legacy, current) => {
    expect(currentDepartmentName(legacy)).toBe(current)
  })

  it('maps Security/Protocol to Protocol — VIP handling was never security', () => {
    expect(currentDepartmentName('Security/Protocol')).toBe('Protocol')
    expect(currentDepartmentName('  security/protocol ')).toBe('Protocol')
  })

  it('tolerates the casing and spacing of a hand-typed export', () => {
    expect(currentDepartmentName(' welfare ')).toBe('Welfare')
    expect(currentDepartmentName('REGISTRATION   UNIT')).toBe('Registration Unit')
  })

  it('maps an unknown name to nothing, never to a guess', () => {
    expect(currentDepartmentName('Choir')).toBeNull()
    expect(currentDepartmentName('')).toBeNull()
    expect(currentDepartmentName(null)).toBeNull()
  })
})
