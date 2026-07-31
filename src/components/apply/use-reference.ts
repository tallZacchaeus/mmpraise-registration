'use client'

import { useEffect, useState } from 'react'

export type ReferenceItem = { id: string; name: string }

/**
 * Fetch a dependent reference list (states for a country, provinces for a
 * region, parishes for a province) only once its parent has been chosen.
 *
 * Results are memoised per parent id for the lifetime of the page, so moving
 * back and forth between steps does not re-request the same list. In-flight
 * requests are aborted when the parent changes, which prevents a slow earlier
 * response from overwriting a newer one.
 *
 * State is only ever set from an asynchronous callback — the cached value and
 * the loading flag are derived during render, which avoids the cascading
 * re-render that a synchronous setState inside an effect would cause.
 */
const cache = new Map<string, ReferenceItem[]>()

export function useReferenceList(resource: string, parentId: string | null | undefined) {
  const key = parentId ? `${resource}:${parentId}` : ''
  const [fetched, setFetched] = useState<Record<string, ReferenceItem[]>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})

  const items = key ? (fetched[key] ?? cache.get(key) ?? []) : []
  const error = key ? (errors[key] ?? null) : null
  const loading = Boolean(key) && !fetched[key] && !cache.has(key) && !error

  useEffect(() => {
    if (!key || !parentId) return
    if (cache.has(key)) return

    const controller = new AbortController()

    fetch(`/api/reference/${resource}?parentId=${encodeURIComponent(parentId)}`, {
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status))
        return response.json()
      })
      .then((data: { items: ReferenceItem[] }) => {
        cache.set(key, data.items)
        setFetched((current) => ({ ...current, [key]: data.items }))
      })
      .catch((cause) => {
        if (controller.signal.aborted) return
        console.error('[reference] fetch failed', resource, cause)
        setErrors((current) => ({
          ...current,
          [key]: 'We could not load this list. Check your connection and try again.',
        }))
      })

    return () => controller.abort()
  }, [resource, parentId, key])

  return { items, loading, error }
}
