import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth/session'
import {
  getChurchProvinces,
  getChurchRegions,
  getCountries,
  getParishes,
  getStates,
} from '@/lib/reference'

/**
 * Reference-data endpoints used by the wizard's searchable selects.
 *
 * Read-only and non-sensitive, but still behind a session so the full country,
 * region and parish tables are not an anonymous scraping target. Responses are
 * cached for an hour — these lists change rarely, and it keeps the registration
 * form fast on a slow connection.
 */
const CACHE_HEADER = 'private, max-age=3600, stale-while-revalidate=86400'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ resource: string }> },
) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { resource } = await params
  const url = new URL(request.url)
  const parentId = url.searchParams.get('parentId')
  const query = url.searchParams.get('q')?.slice(0, 60) ?? undefined

  try {
    switch (resource) {
      case 'countries': {
        const countries = await getCountries()
        return NextResponse.json({ items: countries }, { headers: { 'Cache-Control': CACHE_HEADER } })
      }

      case 'states': {
        if (!parentId) return NextResponse.json({ items: [] })
        const states = await getStates(parentId)
        return NextResponse.json({ items: states }, { headers: { 'Cache-Control': CACHE_HEADER } })
      }

      case 'church-regions': {
        const regions = await getChurchRegions()
        return NextResponse.json({ items: regions }, { headers: { 'Cache-Control': CACHE_HEADER } })
      }

      case 'church-provinces': {
        if (!parentId) return NextResponse.json({ items: [] })
        const provinces = await getChurchProvinces(parentId)
        return NextResponse.json({ items: provinces }, { headers: { 'Cache-Control': CACHE_HEADER } })
      }

      case 'parishes': {
        if (!parentId) return NextResponse.json({ items: [] })
        const parishes = await getParishes(parentId, query)
        // Not cached: results depend on the search term.
        return NextResponse.json({ items: parishes })
      }

      default:
        return NextResponse.json({ error: 'Unknown resource' }, { status: 404 })
    }
  } catch (error) {
    console.error('[reference] lookup failed', { resource, error })
    return NextResponse.json({ error: 'Could not load this list. Please try again.' }, { status: 500 })
  }
}
