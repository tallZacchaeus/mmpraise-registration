/**
 * Legacy department name → current department name.
 *
 * Decision (2026-08-05): every legacy name continues as a team of its own —
 * the 2022–2026 records are not folded into broader departments. The single
 * exception is "Security/Protocol", which maps to **Protocol**: protocol (VIP
 * reception and hosting) was never the same job as security, and the compound
 * name was the old system's limitation, not the organisation's structure.
 *
 * Matching is case-insensitive and whitespace-tolerant. An unknown name maps
 * to nothing rather than to a guess — the import keeps the legacy text
 * verbatim either way (`previousDepartment`), so history survives any gap
 * here.
 */
const ALIASES: Record<string, string> = {
  'security/protocol': 'Protocol',
}

const CURRENT_NAMES = [
  'Volunteers Praise Team',
  'Welfare',
  'Soteria',
  'Sanitation',
  'Medical',
  'Logistics',
  'Security',
  'Registration Team',
  'Media',
  'Ushering',
  'Protocol',
  'Accommodation Logistics',
  'Transportation Logistics',
  'Registration Unit',
  'Medical Officer',
]

function normalise(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase()
}

/** The current department name for a legacy one, or null when unknown. */
export function currentDepartmentName(legacyName: string | null | undefined): string | null {
  if (!legacyName) return null
  const key = normalise(legacyName)
  if (ALIASES[key]) return ALIASES[key]
  return CURRENT_NAMES.find((name) => normalise(name) === key) ?? null
}
