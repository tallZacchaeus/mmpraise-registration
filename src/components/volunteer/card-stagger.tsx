'use client'

import type { ReactNode } from 'react'
import { useReveal } from '@/lib/motion'
import { cn } from '@/lib/utils'

/**
 * Reveals a column of cards one after another as it scrolls into view.
 *
 * Staggering the cards rather than fading the whole column tells the eye where
 * to start reading. The distance is small and the gap between cards is 60ms —
 * enough to register as sequence, not enough to make anyone wait.
 *
 * Children are rendered normally in the HTML; GSAP only hides them once it has
 * confirmed the animation will run, so nothing is missing before hydration, for
 * a reader with JavaScript off, or under `prefers-reduced-motion`.
 */
export function CardStagger({
  children,
  className,
  stagger = 0.06,
}: {
  children: ReactNode
  className?: string
  stagger?: number
}) {
  const ref = useReveal<HTMLDivElement>({ stagger, y: 18, start: 'top 92%' })
  return (
    <div ref={ref} className={cn(className)}>
      {children}
    </div>
  )
}
