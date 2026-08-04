'use client'

import type { ComponentPropsWithoutRef } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Sheet (shadcn/ui pattern, Radix Dialog behaviour).
 *
 * A panel that slides in from the edge. Radix supplies the modal semantics —
 * focus trapped while open and returned to the trigger on close, the rest of
 * the page hidden from assistive technology, Escape to dismiss, and background
 * scroll locked — which is a large amount of subtle code not to have to own.
 */
const Sheet = DialogPrimitive.Root
const SheetTrigger = DialogPrimitive.Trigger
const SheetClose = DialogPrimitive.Close

function SheetContent({
  className,
  children,
  side = 'right',
  ...props
}: ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { side?: 'left' | 'right' }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-night/60 data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in" />
      <DialogPrimitive.Content
        className={cn(
          'fixed inset-y-0 z-50 flex w-full max-w-sm flex-col overflow-y-auto bg-surface shadow-overlay',
          side === 'right'
            ? 'right-0 data-[state=closed]:animate-slide-out-right data-[state=open]:animate-slide-in-right'
            : 'left-0 data-[state=closed]:animate-slide-out-left data-[state=open]:animate-slide-in-left',
          className,
        )}
        {...props}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}

function SheetTitle({ className, ...props }: ComponentPropsWithoutRef<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title className={cn(className)} {...props} />
}

function SheetDescription({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof DialogPrimitive.Description>) {
  return <DialogPrimitive.Description className={cn('text-sm text-muted', className)} {...props} />
}

/** The standard dismiss control, so every sheet closes the same way. */
function SheetCloseButton({ label = 'Close' }: { label?: string }) {
  return (
    <DialogPrimitive.Close className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-field px-3 text-sm font-semibold text-ink hover:bg-surface-sunken">
      <X aria-hidden className="size-5" />
      {label}
    </DialogPrimitive.Close>
  )
}

export { Sheet, SheetTrigger, SheetClose, SheetContent, SheetTitle, SheetDescription, SheetCloseButton }
