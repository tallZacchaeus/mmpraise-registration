'use client'

import type { ReactNode } from 'react'
import Image from 'next/image'
import { useIntroTimeline } from '@/lib/motion'

/**
 * Homepage hero.
 *
 * Layered so the photograph reads as atmosphere rather than as a backdrop with
 * text dropped on it:
 *
 *   photograph → flat scrim → dot texture → content
 *
 * The scrim is a flat colour, not a gradient: a gradient over a photograph with
 * a bright area in the wrong place produces unreadable type at some viewport
 * widths, and there is no width at which a flat scrim fails.
 *
 * The entrance is one GSAP timeline. Every animated element is visible in the
 * markup and only hidden once GSAP has confirmed it will run, so nothing
 * disappears for a visitor who prefers reduced motion, has JavaScript off, or
 * arrives before hydration.
 */
export function Hero({
  image,
  children,
  stats,
}: {
  image: { src: string; alt: string }
  children: ReactNode
  /** The floating figures. Stacked below the copy on small screens. */
  stats: { value: string; label: string }[]
}) {
  const ref = useIntroTimeline<HTMLElement>((timeline, scope) => {
    /**
     * Adds a tween only when the selector actually matches something.
     *
     * Not every page passes every slot — the contact hero has no facts list, for
     * instance — and GSAP logs "target not found" for an empty selection, which
     * fills the console on every page load.
     */
    const step = (selector: string, vars: gsap.TweenVars, at: number) => {
      const targets = scope.querySelectorAll<HTMLElement>(selector)
      if (targets.length > 0) timeline.from(targets, vars, at)
    }

    // A slow push on the photograph. 6 seconds and 4% — felt, not watched.
    step('[data-hero-image]', { scale: 1.06, duration: 6, ease: 'power1.out' }, 0)
    step('[data-hero-badge]', { opacity: 0, scale: 0.92, duration: 0.5 }, 0.15)
    // Lines rise in sequence, which is what gives the heading its weight.
    step('[data-hero-line]', { opacity: 0, yPercent: 40, duration: 0.7, stagger: 0.1 }, 0.3)
    step('[data-hero-standfirst]', { opacity: 0, y: 16, duration: 0.6 }, 0.7)
    step('[data-hero-fact]', { opacity: 0, y: 12, duration: 0.5, stagger: 0.07 }, 0.85)
    step('[data-hero-cta]', { opacity: 0, y: 18, duration: 0.55, stagger: 0.08 }, 1.0)
    step('[data-hero-stat]', { opacity: 0, y: 24, duration: 0.6, stagger: 0.12 }, 1.2)
  })

  return (
    /*
     * The hero pulls itself up by the transparent header's height so the
     * photograph runs behind the bar rather than starting below it. Without
     * this the header is transparent over the white page background and its
     * white text vanishes. Both sides read --spacing-header-overlay, so they
     * cannot drift.
     */
    <section
      ref={ref}
      className="relative isolate -mt-header-overlay overflow-hidden pt-header-overlay"
    >
      {/* Layer 1 — the photograph. */}
      <div data-hero-image className="absolute inset-0 -z-30">
        <Image src={image.src} alt={image.alt} fill priority sizes="100vw" className="object-cover" />
      </div>

      {/* Layer 2 — flat scrim, dark enough for display type over any frame. */}
      <div aria-hidden className="absolute inset-0 -z-20 bg-night/76" />

      {/* Layer 3 — texture, so a large dark area does not read as a flat fill. */}
      <div aria-hidden className="texture-grain absolute inset-0 -z-10 opacity-60" />

      <div className="container-content relative px-4 py-20 text-center sm:px-6 sm:py-28">
        {children}

        {stats.length > 0 && (
          <ul className="mx-auto mt-14 grid max-w-3xl grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
            {stats.map((stat) => (
              <li
                key={stat.label}
                data-hero-stat
                className="rounded-card border border-white/15 bg-white/8 px-4 py-4 backdrop-blur-sm"
              >
                <p className="font-display text-2xl font-bold text-white sm:text-3xl">{stat.value}</p>
                <p className="mt-1 text-sm text-white/80">{stat.label}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
