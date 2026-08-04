'use client'

import type { ComponentPropsWithoutRef } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Dialog (shadcn/ui pattern, Radix behaviour).
 *
 * Radix handles the parts that are easy to get wrong: focus is trapped while
 * open and restored to the trigger on close, the rest of the page is hidden
 * from assistive technology, Escape closes, and body scroll is locked.
 */
const Dialog = DialogPrimitive.Root
const DialogTrigger = DialogPrimitive.Trigger
const DialogClose = DialogPrimitive.Close

function DialogContent({
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<typeof DialogPrimitive.Content>) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-night/70 data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in" />
      <DialogPrimitive.Content
        className={cn(
          'fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2',
          'max-h-[85vh] overflow-y-auto rounded-card border border-line bg-surface p-6 shadow-overlay',
          'data-[state=closed]:animate-fade-out data-[state=open]:animate-scale-in',
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          className="absolute right-4 top-4 inline-flex size-9 items-center justify-center rounded-pill text-muted transition-colors hover:bg-surface-sunken hover:text-ink motion-reduce:transition-none"
          aria-label="Close"
        >
          <X aria-hidden className="size-5" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}

function DialogTitle({ className, ...props }: ComponentPropsWithoutRef<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title className={cn('pr-10 text-2xl', className)} {...props} />
}

function DialogDescription({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof DialogPrimitive.Description>) {
  return <DialogPrimitive.Description className={cn('mt-1 text-sm text-muted', className)} {...props} />
}

export { Dialog, DialogTrigger, DialogClose, DialogContent, DialogTitle, DialogDescription }
