import { ImageResponse } from 'next/og'
import { eventConfig, siteConfig } from '@/config/site'

/**
 * Social share card, generated at request time.
 *
 * The current site ships no Open Graph image at all, so links shared to
 * WhatsApp, Facebook or X render as bare text. Generating it here keeps the card
 * in step with the configured edition and duration automatically.
 *
 * Drawn with system fonts and flat brand colours — no gradients, no network
 * fetches, so it renders fast and never fails on a missing asset.
 */
export const runtime = 'nodejs'
export const alt = `${siteConfig.name} — ${eventConfig.durationHours} hours of non-stop praise`
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          backgroundColor: '#140b06',
          padding: 72,
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 999,
              backgroundColor: '#f34402',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              fontSize: 26,
              fontWeight: 700,
            }}
          >
            MM
          </div>
          <div
            style={{
              display: 'flex',
              color: '#ffffff',
              fontSize: 30,
              fontWeight: 700,
              letterSpacing: 2,
              textTransform: 'uppercase',
            }}
          >
            MMPraise
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              display: 'flex',
              alignSelf: 'flex-start',
              backgroundColor: '#d63a02',
              color: '#ffffff',
              padding: '10px 24px',
              borderRadius: 999,
              fontSize: 24,
              fontWeight: 700,
              letterSpacing: 2,
              textTransform: 'uppercase',
              marginBottom: 28,
            }}
          >
            {eventConfig.durationHours} Hours · {eventConfig.edition}
          </div>

          <div
            style={{
              display: 'flex',
              color: '#ffffff',
              fontSize: 84,
              fontWeight: 800,
              lineHeight: 1.05,
              textTransform: 'uppercase',
              maxWidth: 980,
            }}
          >
            Marathon Messiah’s Praise
          </div>

          <div style={{ display: 'flex', color: 'rgba(255,255,255,0.78)', fontSize: 32, marginTop: 24, maxWidth: 900 }}>
            Non-stop praise from {eventConfig.nationsCount} nations. Attend, watch online, volunteer or give.
          </div>
        </div>

        <div style={{ display: 'flex', color: 'rgba(255,255,255,0.6)', fontSize: 26 }}>
          {eventConfig.venue.name} · mmpraise.org
        </div>
      </div>
    ),
    size,
  )
}
