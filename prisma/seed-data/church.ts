/**
 * RCCG church hierarchy reference data.
 *
 * IMPORTANT: this is a structured *starting point*, not the authoritative RCCG
 * directory. The application loads regions, provinces, zones, areas and parishes
 * from the database and exposes full CRUD to Registration Administrators, so the
 * MMPraise team can replace these records with the official structure without a
 * code change or deployment. See docs/SETUP.md ("Reference data").
 */

export const CONTINENTS = [
  'Africa',
  'Europe',
  'North America',
  'South America',
  'Asia',
  'Oceania',
] as const

type RegionSeed = {
  name: string
  continent: (typeof CONTINENTS)[number]
  provinces: string[]
}

/** Nigerian regions are numbered; international regions are named. */
export const REGIONS: RegionSeed[] = [
  { name: 'Region 1', continent: 'Africa', provinces: ['Lagos Province 1', 'Lagos Province 2', 'Lagos Province 3', 'Lagos Province 4'] },
  { name: 'Region 2', continent: 'Africa', provinces: ['Lagos Province 5', 'Lagos Province 6', 'Lagos Province 7', 'Lagos Province 8'] },
  { name: 'Region 3', continent: 'Africa', provinces: ['Ogun Province 1', 'Ogun Province 2', 'Ogun Province 3'] },
  { name: 'Region 4', continent: 'Africa', provinces: ['Oyo Province 1', 'Oyo Province 2', 'Ibadan Province 1'] },
  { name: 'Region 5', continent: 'Africa', provinces: ['Osun Province 1', 'Osun Province 2', 'Ekiti Province 1'] },
  { name: 'Region 6', continent: 'Africa', provinces: ['Ondo Province 1', 'Ondo Province 2'] },
  { name: 'Region 7', continent: 'Africa', provinces: ['Edo Province 1', 'Edo Province 2', 'Delta Province 1'] },
  { name: 'Region 8', continent: 'Africa', provinces: ['Rivers Province 1', 'Rivers Province 2', 'Bayelsa Province 1'] },
  { name: 'Region 9', continent: 'Africa', provinces: ['Abia Province 1', 'Imo Province 1', 'Anambra Province 1'] },
  { name: 'Region 10', continent: 'Africa', provinces: ['Enugu Province 1', 'Ebonyi Province 1'] },
  { name: 'Region 11', continent: 'Africa', provinces: ['Cross River Province 1', 'Akwa Ibom Province 1'] },
  { name: 'Region 12', continent: 'Africa', provinces: ['Abuja Province 1', 'Abuja Province 2', 'Abuja Province 3'] },
  { name: 'Region 13', continent: 'Africa', provinces: ['Kaduna Province 1', 'Kano Province 1'] },
  { name: 'Region 14', continent: 'Africa', provinces: ['Plateau Province 1', 'Benue Province 1'] },
  { name: 'Region 15', continent: 'Africa', provinces: ['Kwara Province 1', 'Kogi Province 1'] },
  { name: 'Region 16', continent: 'Africa', provinces: ['Borno Province 1', 'Adamawa Province 1'] },
  { name: 'Region 17', continent: 'Africa', provinces: ['Sokoto Province 1', 'Kebbi Province 1'] },
  { name: 'Region 18', continent: 'Africa', provinces: ['Niger Province 1', 'Nasarawa Province 1'] },
  { name: 'Region 19', continent: 'Africa', provinces: ['Ghana Province 1', 'Ghana Province 2'] },
  { name: 'Region 20', continent: 'Africa', provinces: ['Kenya Province 1', 'South Africa Province 1'] },
  { name: 'UK & Ireland Region', continent: 'Europe', provinces: ['London Province 1', 'London Province 2', 'Midlands Province', 'Northern Province'] },
  { name: 'Europe Mainland Region', continent: 'Europe', provinces: ['Netherlands Province', 'Germany Province', 'Italy Province'] },
  { name: 'North America Region', continent: 'North America', provinces: ['Texas Province', 'New York Province', 'Maryland Province', 'Canada Province'] },
  { name: 'South America Region', continent: 'South America', provinces: ['Brazil Province'] },
  { name: 'Asia Region', continent: 'Asia', provinces: ['UAE Province', 'India Province'] },
  { name: 'Oceania Region', continent: 'Oceania', provinces: ['Australia Province', 'New Zealand Province'] },
]

/** A small set of parishes so the parish selector has data to demonstrate. */
export const SAMPLE_PARISHES: Record<string, string[]> = {
  'Lagos Province 1': ['Throne of Grace', 'City of David', 'Rehoboth Cathedral'],
  'Lagos Province 2': ['Chapel of Christ the Light', 'Kings Court'],
  'Abuja Province 1': ['Grace Assembly', 'Solution Centre'],
  'London Province 1': ['Jesus House', 'House of Praise'],
  'Texas Province': ['Living Spring', 'Dominion Chapel'],
}
