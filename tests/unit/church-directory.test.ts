import { describe, expect, it } from 'vitest'
import { churchDirectory } from '../../prisma/seed-data/church-directory'

/**
 * The RCCG directory, as supplied in DIRECTORIES.xlsx.
 *
 * These lock in the shape of the hierarchy and the normalisation decisions, so
 * a regenerated file that silently loses rows or reintroduces a misspelling
 * fails here rather than in front of a volunteer.
 */
describe('church directory', () => {
  const provinces = churchDirectory.flatMap((r) => r.provinces)

  it('carries every region and province from the directory', () => {
    expect(churchDirectory).toHaveLength(66)
    expect(provinces).toHaveLength(469)
  })

  it('names every province uniquely', () => {
    expect(new Set(provinces).size).toBe(provinces.length)
    const regions = churchDirectory.map((r) => r.name)
    expect(new Set(regions).size).toBe(regions.length)
  })

  it('numbers regions rather than naming them after places', () => {
    // The state lives in the province name, never in the region.
    for (const region of churchDirectory) {
      expect(region.name, region.name).toMatch(/^(Region \d+|Redemption City Region)$/)
    }
  })

  it('keeps regions that span several states, because state is not derivable', () => {
    const stateOf = (province: string) => province.replace(/\s+Province.*$/i, '')
    const region18 = churchDirectory.find((r) => r.name === 'Region 18')!
    expect(new Set(region18.provinces.map(stateOf))).toEqual(
      new Set(['Kebbi', 'Sokoto', 'Zamfara']),
    )

    const multiState = churchDirectory.filter(
      (r) => new Set(r.provinces.map(stateOf)).size > 1,
    )
    // Ten in the source. If this drops to zero someone has "tidied" the data
    // by assuming one region equals one state, which it does not.
    expect(multiState.length).toBeGreaterThanOrEqual(5)
  })

  it('is written in title case throughout', () => {
    for (const name of [...churchDirectory.map((r) => r.name), ...provinces]) {
      expect(name, name).not.toBe(name.toUpperCase())
      expect(name.trim(), name).toBe(name)
      expect(name, name).not.toMatch(/\s{2,}/)
    }
  })

  it('corrects the two misspelled state names', () => {
    for (const name of provinces) {
      expect(name, name).not.toMatch(/Nassarawa/i)
      expect(name, name).not.toMatch(/Cross Rivers/i)
    }
    expect(provinces.filter((p) => p.startsWith('Nasarawa'))).toHaveLength(6)
    expect(provinces.filter((p) => p.startsWith('Cross River '))).toHaveLength(9)
  })

  it('completes the two rows that were missing the word "Province"', () => {
    expect(provinces).toContain('Kwara Province 2')
    expect(provinces).toContain('Cross River Province 9')
    // Every entry is a province; none was left as a bare "Kwara 2".
    for (const name of provinces) expect(name, name).toMatch(/Province/)
  })

  it('keeps Youth provinces, which are not places', () => {
    const youth = provinces.filter((p) => p.startsWith('Youth Province'))
    expect(youth).toHaveLength(20)
  })

  it('gives every region at least one province', () => {
    for (const region of churchDirectory) {
      expect(region.provinces.length, region.name).toBeGreaterThan(0)
    }
  })
})
