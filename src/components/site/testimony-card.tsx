'use client'

import { Quote } from 'lucide-react'
import { Card, CardBody } from '@/components/ui/primitives'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import type { Testimony } from '@/content/homepage'
import { cn } from '@/lib/utils'

const PREVIEW_LENGTH = 240

/**
 * One testimony.
 *
 * The current site repeats several entries inside an auto-rotating slider. Here
 * each appears once in a static grid, and a long one opens in a dialog rather
 * than expanding in place — expanding reflowed the grid and pushed every card
 * below it down the page, which is disorienting if you were reading one of them.
 *
 * Radix supplies the dialog behaviour: focus trapped and restored to the
 * trigger, Escape to close, the rest of the page hidden from assistive
 * technology.
 */
export function TestimonyCard({
  testimony,
  featured = false,
}: {
  testimony: Testimony
  /** The lead testimony gets more room and is never truncated. */
  featured?: boolean
}) {
  const isLong = testimony.body.length > PREVIEW_LENGTH
  const preview =
    !isLong || featured ? testimony.body : `${testimony.body.slice(0, PREVIEW_LENGTH).trimEnd()}…`

  const attribution = [testimony.author, testimony.country].filter(Boolean).join(', ')

  return (
    <Card className={cn('card-lift h-full', featured && 'border-white/12 bg-night text-white')}>
      <CardBody className="flex h-full flex-col">
        <Quote
          aria-hidden
          className={cn('shrink-0', featured ? 'size-8 text-gold' : 'size-6 text-primary')}
        />

        <h3 className={cn('mt-3', featured ? 'text-xl text-white sm:text-2xl' : 'text-base')}>
          {testimony.title}
        </h3>

        <blockquote className="mt-2 flex-1">
          <p className={cn(featured ? 'text-white/85' : 'text-sm text-body')}>{preview}</p>
        </blockquote>

        {isLong && !featured && (
          <Dialog>
            <DialogTrigger className="mt-3 self-start text-sm font-semibold text-primary underline underline-offset-4 hover:text-primary-hover">
              Read full testimony
              <span className="sr-only"> — {testimony.title}</span>
            </DialogTrigger>

            <DialogContent>
              <DialogTitle>{testimony.title}</DialogTitle>
              <DialogDescription>{attribution}</DialogDescription>
              <blockquote className="mt-4">
                <p className="whitespace-pre-line text-body">{testimony.body}</p>
              </blockquote>
              <p className="mt-6 border-t border-line pt-4 text-xs text-muted">
                A personal account submitted by a worshipper.
              </p>
            </DialogContent>
          </Dialog>
        )}

        <p
          className={cn(
            'mt-4 font-display text-sm font-bold uppercase',
            featured ? 'text-gold' : 'text-ink',
          )}
        >
          {attribution}
        </p>
      </CardBody>
    </Card>
  )
}
