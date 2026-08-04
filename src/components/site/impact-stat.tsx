'use client'

import { useCounter } from '@/lib/motion'
import type { ImpactStat as ImpactStatData } from '@/content/about'

/**
 * One impact figure on the About page.
 *
 * Two cases, deliberately:
 *
 *  - A countable number ("200") counts up as it scrolls into view.
 *  - Anything else — "Millions", or the null value used where the site's own
 *    sources disagree on the country count — is rendered as written. Animating
 *    a word is meaningless, and animating a disputed figure would lend it a
 *    confidence it has not earned.
 *
 * The final value is what the server renders and what reduced motion shows, so
 * the figure is correct before hydration and for crawlers.
 */
export function ImpactStat({ stat }: { stat: ImpactStatData }) {
  const numeric = stat.value !== null && /^\d+$/.test(stat.value) ? Number(stat.value) : null
  const { ref, value: counted } = useCounter(numeric ?? 0)

  return (
    <div className="card-lift rounded-card border border-line bg-surface p-6">
      <dt
        ref={numeric !== null ? (ref as React.Ref<HTMLElement>) : undefined}
        className="font-display text-3xl font-bold tabular-nums text-primary-active"
      >
        {/* Null means the sources contradict each other, so the label carries
            the claim instead of a disputed number. */}
        {numeric !== null ? counted : (stat.value ?? stat.label)}
      </dt>
      <dd className="mt-2">
        {stat.value && <p className="font-semibold text-ink">{stat.label}</p>}
        <p className="mt-1 text-sm text-muted">{stat.detail}</p>
      </dd>
    </div>
  )
}
