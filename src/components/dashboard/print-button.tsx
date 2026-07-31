'use client'

import { Printer } from 'lucide-react'
import { Button } from '@/components/ui/primitives'

/**
 * Opens the browser's print dialogue, which also covers "save as PDF" on every
 * major platform — no PDF library or server round trip needed.
 */
export function PrintButton() {
  return (
    <Button type="button" size="sm" onClick={() => window.print()}>
      <Printer aria-hidden className="size-4" />
      Print or save as PDF
    </Button>
  )
}
