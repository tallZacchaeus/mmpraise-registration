import 'server-only'
import { cache } from 'react'
import { db } from '@/lib/db'

/**
 * Application settings stored as key/value JSON so administrators can change
 * operational behaviour (registration open/closed, event dates, capacity policy)
 * without a deployment.
 */
export type SettingsMap = {
  registration_open: boolean
  registration_closed_message: string
  event_name: string
  event_dates: string[]
  support_email: string
  minor_age_ranges: string[]
}

const DEFAULTS: SettingsMap = {
  registration_open: true,
  registration_closed_message: 'Volunteer registration is currently closed. Please check back soon.',
  event_name: "84 Hours Marathon Messiah's Praise",
  event_dates: [],
  support_email: 'volunteers@mmpraise.org',
  minor_age_ranges: ['AGE_00_15'],
}

export const getSettings = cache(async (): Promise<SettingsMap> => {
  const rows = await db.setting.findMany()
  const map = { ...DEFAULTS }
  for (const row of rows) {
    if (row.key in map) {
      ;(map as Record<string, unknown>)[row.key] = row.value
    }
  }
  return map
})

export async function getSetting<K extends keyof SettingsMap>(key: K): Promise<SettingsMap[K]> {
  return (await getSettings())[key]
}

export async function setSetting<K extends keyof SettingsMap>(key: K, value: SettingsMap[K]): Promise<void> {
  await db.setting.upsert({
    where: { key },
    update: { value: value as never },
    create: { key, value: value as never },
  })
}

/** Age ranges that require guardian consent. */
export async function isMinorAgeRange(ageRange: string | null | undefined): Promise<boolean> {
  if (!ageRange) return false
  const minors = await getSetting('minor_age_ranges')
  return minors.includes(ageRange)
}
