'use client'

import type { ElementType, ReactNode } from 'react'
import { useReveal } from '@/lib/motion'
import { cn } from '@/lib/utils'

/**
 * Declarative wrapper around `useReveal`, so a section can opt into motion
 * without becoming a client component itself beyond this boundary.
 *
 * Children are rendered normally in the HTML — GSAP only takes over once it has
 * confirmed the animation should run. Nothing is ever hidden by default.
 */
export function Reveal({
  children,
  as: Tag = 'div',
  className,
  y,
  delay,
  duration,
  start,
}: {
  children: ReactNode
  as?: ElementType
  className?: string
  y?: number
  delay?: number
  duration?: number
  start?: string
}) {
  const ref = useReveal<HTMLDivElement>({ y, delay, duration, start })
  return (
    <Tag ref={ref} className={className}>
      {children}
    </Tag>
  )
}

/**
 * Reveals its children one after another. Use for card grids and lists, where
 * a single fade would feel flat but a full per-card animation would be noise.
 */
export function RevealStagger({
  children,
  as: Tag = 'div',
  className,
  selector,
  stagger = 0.08,
  y = 20,
  start,
}: {
  children: ReactNode
  as?: ElementType
  className?: string
  /** Defaults to direct children. */
  selector?: string
  stagger?: number
  y?: number
  start?: string
}) {
  const ref = useReveal<HTMLDivElement>({ stagger, selector, y, start })
  return (
    <Tag ref={ref} className={cn(className)}>
      {children}
    </Tag>
  )
}
