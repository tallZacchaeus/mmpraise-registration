'use client'

import { useId, useState } from 'react'
import { Quote } from 'lucide-react'
import { Card, CardBody } from '@/components/ui/primitives'
import type { Testimony } from '@/content/homepage'

const PREVIEW_LENGTH = 240

/**
 * One testimony, with an accessible "read full testimony" disclosure.
 *
 * The current site truncates nothing and repeats several entries inside an
 * auto-rotating slider. Here each testimony appears once, in a static grid, and
 * long entries expand in place — no carousel to fight with, and nothing hidden
 * from a keyboard or a screen reader.
 */
export function TestimonyCard({ testimony }: { testimony: Testimony }) {
  const [expanded, setExpanded] = useState(false)
  const bodyId = useId()

  const isLong = testimony.body.length > PREVIEW_LENGTH
  const shown = !isLong || expanded ? testimony.body : `${testimony.body.slice(0, PREVIEW_LENGTH).trimEnd()}…`

  const attribution = [testimony.author, testimony.country].filter(Boolean).join(', ')

  return (
    <Card className="h-full">
      <CardBody className="flex h-full flex-col">
        <Quote aria-hidden className="size-6 shrink-0 text-primary" />

        <h3 className="mt-3 text-base">{testimony.title}</h3>

        <blockquote className="mt-2 flex-1">
          <p id={bodyId} className="text-sm text-body">
            {shown}
          </p>
        </blockquote>

        {isLong && (
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
            aria-controls={bodyId}
            className="mt-3 self-start text-sm font-semibold text-primary underline underline-offset-4 hover:text-primary-hover"
          >
            {expanded ? 'Show less' : 'Read full testimony'}
            <span className="sr-only"> — {testimony.title}</span>
          </button>
        )}

        <p className="mt-4 font-display text-sm font-bold uppercase text-ink">{attribution}</p>
      </CardBody>
    </Card>
  )
}
