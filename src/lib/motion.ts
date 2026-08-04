'use client'

import { useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

/**
 * The MMPraise motion system.
 *
 * Three rules hold everywhere:
 *
 *  1. Motion is opt-in per element, never global. Nothing moves that does not
 *     earn it.
 *  2. `prefers-reduced-motion` is honoured by not animating at all — the final
 *     state is applied immediately. Content is never hidden behind an animation
 *     that will not run.
 *  3. Every timeline and ScrollTrigger is reverted on unmount. GSAP holds
 *     references to DOM nodes, so a missed cleanup is a memory leak and, on a
 *     client-navigated route change, a crash.
 *
 * Elements start visible in the markup and are hidden by GSAP only once we know
 * the animation will run. That way a visitor with JavaScript disabled, or one
 * who arrives before hydration, still sees everything.
 */

let registered = false

/**
 * Register ScrollTrigger exactly once, and never on the server.
 *
 * Exported because components that build their own `gsap.context` still need
 * it: a `scrollTrigger` given to a tween before the plugin is registered is
 * silently ignored, so the animation simply never fires.
 */
export function ensureScrollTrigger() {
  if (registered || typeof window === 'undefined') return
  gsap.registerPlugin(ScrollTrigger)
  registered = true
}

/** True when the visitor has asked for reduced motion. */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return true
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

type RevealOptions = {
  /** Distance travelled, in pixels. Small by design. */
  y?: number
  /** Seconds before the animation starts. */
  delay?: number
  duration?: number
  /** Where in the viewport the element must reach before it plays. */
  start?: string
  /** Animate direct children in sequence instead of the element itself. */
  stagger?: number
  /** CSS selector for the children to stagger. Defaults to direct children. */
  selector?: string
}

/**
 * Fade and lift an element — or stagger its children — as it scrolls into view.
 *
 * Returns a ref to attach to the container.
 */
export function useReveal<T extends HTMLElement = HTMLDivElement>(options: RevealOptions = {}) {
  const ref = useRef<T>(null)
  const {
    y = 24,
    delay = 0,
    duration = 0.7,
    start = 'top 85%',
    stagger,
    selector,
  } = options

  useEffect(() => {
    const element = ref.current
    if (!element || prefersReducedMotion()) return

    ensureScrollTrigger()

    // Scoping to the element means the selectors below can never reach into
    // another section, and everything created here is reverted together.
    const ctx = gsap.context(() => {
      const targets =
        stagger === undefined
          ? element
          : selector
            ? element.querySelectorAll(selector)
            : element.children

      gsap.from(targets, {
        opacity: 0,
        y,
        duration,
        delay,
        ease: 'power2.out',
        stagger: stagger ?? 0,
        scrollTrigger: { trigger: element, start, once: true },
      })
    }, element)

    return () => ctx.revert()
  }, [y, delay, duration, start, stagger, selector])

  return ref
}

/**
 * Count a number up as it scrolls into view.
 *
 * Returns the value to render and a ref for the element to watch. The final
 * value is what renders under reduced motion, and it is also the server-rendered
 * value — so the number is correct before, during and after hydration, and is
 * never wrong for a crawler.
 */
export function useCounter(target: number, options: { duration?: number } = {}) {
  const ref = useRef<HTMLElement>(null)
  const [value, setValue] = useState(target)
  const { duration = 1.6 } = options

  useEffect(() => {
    const element = ref.current
    if (!element || prefersReducedMotion()) return

    ensureScrollTrigger()

    const ctx = gsap.context(() => {
      const counter = { value: 0 }
      gsap.to(counter, {
        value: target,
        duration,
        ease: 'power2.out',
        onUpdate: () => setValue(Math.round(counter.value)),
        scrollTrigger: { trigger: element, start: 'top 85%', once: true },
      })
    }, element)

    return () => {
      ctx.revert()
      // The tween is gone; make sure the rendered number is not left mid-count.
      setValue(target)
    }
  }, [target, duration])

  return { ref, value }
}

/**
 * A GSAP timeline that runs once on mount, for orchestrated entrances such as
 * the hero. The callback receives the timeline and the scope element.
 *
 * Under reduced motion the callback never runs, so nothing is hidden and the
 * markup is shown exactly as rendered.
 */
export function useIntroTimeline<T extends HTMLElement = HTMLDivElement>(
  build: (timeline: gsap.core.Timeline, scope: T) => void,
  deps: unknown[] = [],
) {
  const ref = useRef<T>(null)

  useEffect(() => {
    const element = ref.current
    if (!element || prefersReducedMotion()) return

    const ctx = gsap.context(() => {
      const timeline = gsap.timeline({ defaults: { ease: 'power3.out' } })
      build(timeline, element)
    }, element)

    return () => ctx.revert()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return ref
}

export { gsap, ScrollTrigger }
