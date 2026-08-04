'use client'

import { useEffect, useRef } from 'react'
import { Card, CardBody } from '@/components/ui/primitives'
import type { Milestone } from '@/content/about'
import { gsap, prefersReducedMotion, ScrollTrigger } from '@/lib/motion'

/**
 * The origin story as a timeline.
 *
 * One markup tree, two layouts: a horizontal rail on wide screens and a
 * vertical one below `md`, switched by CSS rather than by rendering twice. The
 * connecting line is a single element whose axis changes with the breakpoint,
 * so there is no duplicated DOM and no layout-dependent JavaScript.
 *
 * The line draws itself as the section scrolls into view. It is decorative —
 * the milestones are an ordered list and read correctly with the line absent,
 * which is exactly what happens under reduced motion.
 */
export function HistoryTimeline({ milestones }: { milestones: Milestone[] }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = ref.current
    if (!element || prefersReducedMotion()) return

    gsap.registerPlugin(ScrollTrigger)

    const ctx = gsap.context(() => {
      const line = element.querySelector('[data-timeline-line]')
      const isWide = window.matchMedia('(min-width: 768px)').matches

      if (line) {
        gsap.from(line, {
          // Grow along whichever axis the line currently runs.
          [isWide ? 'scaleX' : 'scaleY']: 0,
          transformOrigin: isWide ? 'left center' : 'top center',
          duration: 1.1,
          ease: 'power2.out',
          scrollTrigger: { trigger: element, start: 'top 75%', once: true },
        })
      }

      gsap.from(element.querySelectorAll('[data-milestone]'), {
        opacity: 0,
        y: 24,
        duration: 0.6,
        stagger: 0.15,
        ease: 'power2.out',
        // Slightly behind the line, so the marks appear as it reaches them.
        delay: 0.25,
        scrollTrigger: { trigger: element, start: 'top 75%', once: true },
      })
    }, element)

    return () => ctx.revert()
  }, [])

  return (
    <div ref={ref} className="relative mt-12">
      {/*
        The rail. Sits behind the dots on wide screens and to their left on
        narrow ones. Decorative, so it is hidden from assistive technology.
      */}
      <span
        aria-hidden
        data-timeline-line
        className="absolute left-[0.4375rem] top-2 h-[calc(100%-1rem)] w-0.5 bg-primary/25 md:left-0 md:top-[0.4375rem] md:h-0.5 md:w-full"
      />

      <ol className="grid gap-8 md:grid-cols-3 md:gap-6">
        {milestones.map((milestone) => (
          <li key={milestone.id} data-milestone className="relative pl-8 md:pl-0 md:pt-10">
            {/* The mark on the rail. */}
            <span
              aria-hidden
              className="absolute left-0 top-2 size-4 rounded-pill border-2 border-primary bg-surface md:top-0"
            />

            <Card className="card-lift h-full">
              <CardBody>
                <p className="font-display text-sm font-bold uppercase tracking-wide text-primary-active">
                  {milestone.date}
                </p>
                <h3 className="mt-2 text-xl">{milestone.title}</h3>
                <p className="mt-3 text-body">{milestone.body}</p>
              </CardBody>
            </Card>
          </li>
        ))}
      </ol>
    </div>
  )
}
