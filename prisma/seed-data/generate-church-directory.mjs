/**
 * Regenerate church-directory.ts from the organisation's spreadsheet.
 *
 *   node prisma/seed-data/generate-church-directory.mjs
 *
 * Run this rather than hand-editing the generated file, so the directory and
 * DIRECTORIES.xlsx cannot drift apart. Normalisation applied here — Title Case,
 * the two rows missing "Province", and the Nassarawa / Cross Rivers spellings —
 * is asserted by tests/unit/church-directory.test.ts.
 */
import ExcelJS from 'exceljs'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const SOURCE = path.resolve(here, '../../DIRECTORIES.xlsx')
const TARGET = path.resolve(here, 'church-directory.ts')

const titleCase = (s) => s.toLowerCase().replace(/\b([a-z])/g, (m, c) => c.toUpperCase())

const wb = new ExcelJS.Workbook()
await wb.xlsx.readFile(SOURCE)
const ws = wb.getWorksheet('Sheet1')

const rows = []
ws.eachRow({ includeEmpty: false }, (r, n) => {
  if (n === 1) return // header
  const v = r.values
  let province = String(v[3] ?? '').trim().toUpperCase().replace(/\s+/g, ' ')

  // Two rows omit the word "Province" entirely: "KWARA 2", "CROSS RIVERS 9".
  if (!/PROVINCE/.test(province)) province = province.replace(/^(.*?)\s+(\d+)$/, '$1 PROVINCE $2')

  // Nasarawa and Cross River are the correct state spellings.
  province = province.replace(/^NASSARAWA\b/, 'NASARAWA').replace(/^CROSS RIVERS\b/, 'CROSS RIVER')

  rows.push({
    region: titleCase(String(v[2] ?? '').trim().replace(/\s+/g, ' ')),
    province: titleCase(province),
  })
})

const byRegion = new Map()
for (const r of rows) {
  if (!byRegion.has(r.region)) byRegion.set(r.region, [])
  byRegion.get(r.region).push(r.province)
}

// Natural sort, so "Region 9" precedes "Region 10" rather than following it.
const natural = (a, b) => a.localeCompare(b, 'en', { numeric: true, sensitivity: 'base' })
const regions = [...byRegion.keys()].sort((a, b) => {
  if (a === 'Redemption City Region') return -1
  if (b === 'Redemption City Region') return 1
  return natural(a, b)
})

const body = regions
  .map((r) => {
    const provinces = [...new Set(byRegion.get(r))].sort(natural)
    return (
      '  {\n    name: ' + JSON.stringify(r) + ',\n    provinces: [\n' +
      provinces.map((p) => '      ' + JSON.stringify(p) + ',').join('\n') +
      '\n    ],\n  },'
    )
  })
  .join('\n')

const header = [
  '/**',
  ' * The RCCG regions and provinces MMPraise draws volunteers from.',
  ' *',
  " * Generated from DIRECTORIES.xlsx, the organisation's own directory, by",
  ' * generate-church-directory.mjs. Do not hand-edit — regenerate instead, so',
  ' * the two cannot drift apart.',
  ' *',
  ' * Two things about this hierarchy are easy to get wrong:',
  ' *',
  ' *  1. Regions are numbered, not geographic. The state name appears in the',
  ' *     province, never in the region — and ten regions span more than one',
  ' *     state (Region 18 covers Kebbi, Sokoto and Zamfara), so a volunteer’s',
  ' *     state cannot be inferred from their region.',
  ' *  2. "Youth Province n" is not a place. It occupies the same slot as a',
  ' *     geographic province and must never be parsed as one.',
  ' *',
  ' * Normalised on import: Title Case throughout; two rows missing the word',
  ' * "Province" completed (Kwara 2, Cross Rivers 9); and the misspellings',
  ' * Nassarawa and Cross Rivers corrected to Nasarawa and Cross River.',
  ' *',
  ' * Nigeria only. International regions are seeded separately under their own',
  ' * continents and are untouched by this directory.',
  ' */',
  'export type ChurchRegionSeed = { name: string; provinces: string[] }',
  '',
  'export const churchDirectory: ChurchRegionSeed[] = [',
].join('\n')

fs.writeFileSync(TARGET, header + '\n' + body + '\n]\n')
console.log(`church-directory.ts: ${regions.length} regions, ${rows.length} provinces`)
