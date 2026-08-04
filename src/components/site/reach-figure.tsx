'use client'

import { useCounter } from '@/lib/motion'

/**
 * A single statistic that counts up when it scrolls into view.
 *
 * The final value is what renders on the server and under reduced motion, so
 * the number is correct before hydration, correct for a crawler, and correct
 * for anyone who has asked for less movement. The animation is the only thing
 * that is conditional — never the content.
 */
export function ReachFigure({
  value,
  label,
  suffix,
  onDark = false,
  animate = true,
}: {
  value: number
  label: string
  suffix?: string
  onDark?: boolean
  /**
   * Off for years. Counting 0 → 2012 reads as a loading bug, not a flourish;
   * a year is an identifier, not a quantity.
   */
  animate?: boolean
}) {
  const { ref, value: counted } = useCounter(animate ? value : 0)
  const shown = animate ? counted : value

  return (
    <div>
      <dt className={onDark ? 'text-sm text-white/70' : 'text-sm text-muted'}>{label}</dt>
      <dd
        ref={ref as React.Ref<HTMLElement>}
        className={
          onDark
            ? 'font-display text-4xl font-bold tabular-nums text-gold sm:text-5xl'
            : 'font-display text-4xl font-bold tabular-nums text-ink sm:text-5xl'
        }
      >
        {shown}
        {suffix}
      </dd>
    </div>
  )
}
