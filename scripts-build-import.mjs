import { readFileSync, writeFileSync } from 'node:fs'
import Papa from 'papaparse'

/**
 * Build the single previous-participant import file.
 *
 * t2024-export is a strict subset of users-export — all 8,390 of its rows
 * appear there with byte-identical values in every column — so the merge is
 * simply "use users-export". Nothing from t2024 is lost by dropping it.
 */
const load = f => Papa.parse(readFileSync(f,'utf8').replace(/^﻿/,''),{header:true,skipEmptyLines:'greedy',transformHeader:h=>h.trim(),transform:v=>(v??'').trim()}).data
const rows = load('users-export-2026-08-04.csv')

const EMAIL = /^[^\s@,;]+@[^\s@,;]+\.[a-z]{2,}$/i

/** First word is the given name; everything after it is the family name. */
function splitName(full) {
  const parts = (full || '').split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { first: '', middle: '', last: '' }
  if (parts.length === 1) return { first: parts[0], middle: '', last: '' }
  if (parts.length === 2) return { first: parts[0], middle: '', last: parts[1] }
  return { first: parts[0], middle: parts.slice(1, -1).join(' '), last: parts[parts.length - 1] }
}

const HEADERS = [
  'Email', 'First name', 'Middle name', 'Last name', 'Phone',
  'Country', 'State', 'Gender', 'Occupation',
  'Previous department', 'MMP number', 'Edition',
  // Columns the importer cannot map yet. Carried so the file is complete and
  // nothing has to be re-exported when those fields exist.
  'MMP username', 'Legacy user ID', 'Legacy UID', 'Age band',
  'Denomination', 'How you heard', 'Address', 'Accommodation',
]

const out = []
const rejected = []

for (const r of rows) {
  const { first, middle, last } = splitName(r.Name)
  const record = [
    r.Email, first, middle, last, r.Phone,
    r.Country, r.State, r.Gender, r.Occupation,
    r.Department, r['MMP Code'], r.Year,
    r.Username, r['User ID'], r.UID, r.Age,
    r.Denomination, r['How you heard'], r.Address, r.Accom,
  ]
  if (!EMAIL.test((r.Email || '').toLowerCase())) {
    rejected.push([r['MMP Code'], r.Email, r.Name, r.Phone])
    continue
  }
  out.push(record)
}

// `toCsv` from the app neutralises formula-leading values; reuse its rules.
const cell = v => {
  const text = v === null || v === undefined ? '' : String(v)
  const safe = /^[=+\-@\t\r]/.test(text) && !/^[+-]\d/.test(text) ? `'${text}` : text
  return `"${safe.replace(/"/g, '""')}"`
}
const toCsv = (headers, data) =>
  `﻿${[headers.map(cell).join(','), ...data.map(r => r.map(cell).join(','))].join('\r\n')}\r\n`

writeFileSync('mmpraise-previous-participants.csv', toCsv(HEADERS, out))
writeFileSync('mmpraise-participants-needing-correction.csv',
  toCsv(['MMP Code', 'Email as exported', 'Name', 'Phone'], rejected))

console.log('import file rows:', out.length)
console.log('held back for correction:', rejected.length)
console.log('emails unique:', new Set(out.map(r => r[0].toLowerCase())).size)
