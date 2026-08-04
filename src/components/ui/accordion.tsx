'use client'

import type { ComponentPropsWithoutRef } from 'react'
import * as AccordionPrimitive from '@radix-ui/react-accordion'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Accordion (shadcn/ui pattern, Radix behaviour).
 *
 * Radix supplies the roles, `aria-expanded`, `aria-controls` and the arrow-key
 * roving focus that a hand-rolled version usually gets wrong. The height
 * transition is CSS driven from the data attributes Radix sets, so it is
 * cancelled automatically by the reduced-motion rule in globals.css.
 *
 * Note: unlike <details>, this needs JavaScript to open. The FAQ's answers are
 * still emitted in the HTML and still published as FAQPage structured data, so
 * crawlers and no-JS readers lose the interaction but not the content.
 */
const Accordion = AccordionPrimitive.Root

function AccordionItem({ className, ...props }: ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>) {
  return <AccordionPrimitive.Item className={cn('border-b border-line', className)} {...props} />
}

function AccordionTrigger({
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger>) {
  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        className={cn(
          'group flex flex-1 items-center justify-between gap-4 py-5 text-left',
          'font-display text-lg font-bold uppercase tracking-wide text-ink',
          'transition-colors hover:text-primary-active motion-reduce:transition-none',
          className,
        )}
        {...props}
      >
        {children}
        <ChevronDown
          aria-hidden
          className="size-5 shrink-0 text-muted transition-transform duration-200 group-data-[state=open]:rotate-180 motion-reduce:transition-none"
        />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  )
}

function AccordionContent({
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<typeof AccordionPrimitive.Content>) {
  return (
    <AccordionPrimitive.Content
      className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down"
      {...props}
    >
      <div className={cn('pb-5 pr-9 text-body', className)}>{children}</div>
    </AccordionPrimitive.Content>
  )
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent }
