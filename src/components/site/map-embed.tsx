'use client'

import { useState } from 'react'
import { ExternalLink, MapPin } from 'lucide-react'
import { Button } from '@/components/ui/primitives'

/**
 * Click-to-load map.
 *
 * An embedded map is a third-party iframe that ships scripts, sets cookies and
 * costs hundreds of kilobytes — on every visit, for the small share of visitors
 * who actually want it. Nothing is requested from Google until the button is
 * pressed, so the page carries no third-party weight by default and no visitor
 * is silently exposed to a tracker they did not ask for.
 *
 * The address and a plain link to it are always present, so the location is
 * available to anyone who cannot or will not load the map at all.
 */
export function MapEmbed({
  address,
  mapUrl,
  embedUrl,
}: {
  address: string
  mapUrl: string
  /** Same query as `mapUrl`, in Google's embeddable form. */
  embedUrl: string
}) {
  const [loaded, setLoaded] = useState(false)

  if (loaded) {
    return (
      <iframe
        title={`Map showing ${address}`}
        src={embedUrl}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        className="aspect-[16/9] w-full rounded-card border border-line"
      />
    )
  }

  return (
    <div className="flex aspect-[16/9] w-full flex-col items-center justify-center gap-4 rounded-card border border-line bg-surface-sunken p-6 text-center">
      <MapPin aria-hidden className="size-8 text-primary-active" />
      <div>
        <p className="font-semibold text-ink">{address}</p>
        <p className="mt-1 text-sm text-muted">
          The map is loaded from Google only when you ask for it, so nothing is requested from
          another site until then.
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="button" variant="secondary" onClick={() => setLoaded(true)}>
          <MapPin aria-hidden className="size-4" />
          Load the map
        </Button>
        <a
          href={mapUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 rounded-pill px-4 py-2 font-semibold text-primary-active underline-offset-4 hover:underline"
        >
          <ExternalLink aria-hidden className="size-4" />
          Open in Google Maps
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      </div>
    </div>
  )
}
