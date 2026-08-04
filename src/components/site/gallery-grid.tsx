'use client'

import Image from 'next/image'
import { Expand } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import type { GalleryImage } from '@/content/about'

/**
 * Photographs from previous editions, each opening full size in a dialog.
 *
 * The trigger is a real button wrapping the thumbnail, so the lightbox is
 * reachable by keyboard and announced as a control rather than as an image that
 * mysteriously does something when clicked. Radix returns focus to that button
 * on close.
 *
 * The caption is visible on the card and repeated as the dialog's title, so the
 * enlarged view is never an unlabelled photograph.
 */
export function GalleryGrid({ images }: { images: GalleryImage[] }) {
  return (
    <ul className="mt-10 grid gap-6 md:grid-cols-3">
      {images.map((image) => (
        <li key={image.id}>
          <Dialog>
            <DialogTrigger className="group block w-full text-left">
              <figure>
                <span className="relative block overflow-hidden rounded-card border border-line">
                  <Image
                    src={image.src}
                    alt={image.alt}
                    width={image.width}
                    height={image.height}
                    loading="lazy"
                    sizes="(min-width: 768px) 33vw, 100vw"
                    className="h-auto w-full object-cover transition-transform duration-500 ease-[var(--ease-out-soft)] group-hover:scale-[1.04] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                  />
                  {/* Says the thumbnail enlarges, rather than leaving it to be
                      discovered. Hidden from assistive tech — the button's own
                      label already carries that meaning. */}
                  <span
                    aria-hidden
                    className="absolute right-3 top-3 inline-flex size-9 items-center justify-center rounded-pill bg-night/70 text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none"
                  >
                    <Expand className="size-4" />
                  </span>
                </span>
                <figcaption className="mt-3 text-sm text-muted">
                  {image.caption}
                  <span className="sr-only"> — open larger</span>
                </figcaption>
              </figure>
            </DialogTrigger>

            <DialogContent className="max-w-3xl">
              <DialogTitle>{image.caption}</DialogTitle>
              <DialogDescription>{image.alt}</DialogDescription>
              <Image
                src={image.src}
                alt={image.alt}
                width={image.width}
                height={image.height}
                sizes="(min-width: 768px) 720px, 100vw"
                className="mt-4 h-auto w-full rounded-card"
              />
            </DialogContent>
          </Dialog>
        </li>
      ))}
    </ul>
  )
}
