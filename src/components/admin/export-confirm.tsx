'use client'

import { useState } from 'react'
import { Download, FileSpreadsheet } from 'lucide-react'
import { Button, buttonClass } from '@/components/ui/primitives'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

/**
 * A pause before personal data leaves the platform.
 *
 * The export itself already runs behind a permission and writes an audit
 * record; what was missing was the moment of intent. One click on a link that
 * downloads hundreds of people's contact details is too little ceremony — the
 * dialog states the row count, what the file contains and that the download is
 * recorded, and only then offers the formats.
 */
export function ExportConfirm({ total, exportQuery }: { total: number; exportQuery: string }) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm">
          <Download aria-hidden className="size-4" />
          Export
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>
          Export {total} application{total === 1 ? '' : 's'}?
        </DialogTitle>
        <DialogDescription asChild>
          <div className="mt-3 space-y-3 text-sm text-body">
            <p>
              The file contains names, email addresses, phone numbers and church details for
              everyone matching your current filters. Health information is never included.
            </p>
            <p>
              This download is recorded in the activity log with your name, the filters used and
              the row count.
            </p>
          </div>
        </DialogDescription>

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <DialogClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DialogClose>
          {/*
            Real links, so the browser downloads natively — the dialog closes on
            click and the audited route handler does the rest.
          */}
          <a
            href={`/api/admin/export?format=csv&${exportQuery}`}
            onClick={() => setOpen(false)}
            className={buttonClass({ variant: 'outline', size: 'sm' })}
          >
            <Download aria-hidden className="size-4" />
            CSV
          </a>
          <a
            href={`/api/admin/export?format=xlsx&${exportQuery}`}
            onClick={() => setOpen(false)}
            className={buttonClass({ size: 'sm' })}
          >
            <FileSpreadsheet aria-hidden className="size-4" />
            Excel
          </a>
        </div>
      </DialogContent>
    </Dialog>
  )
}
