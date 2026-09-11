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
          <div className="mt-3 text-sm text-body">
            <p>
              This download is recorded in the activity log with your name, the filters used and
              the row count. Health information is never included in either file.
            </p>
          </div>
        </DialogDescription>

        {/*
          Two files, because they answer different questions. Offering only the
          full record meant anyone who wanted an address list downloaded every
          church detail and emergency contact to get at one column.
        */}
        <div className="mt-5 space-y-4">
          <section className="rounded-card border border-line p-4">
            <h3 className="text-sm font-semibold text-ink">Full record</h3>
            <p className="mt-1 text-sm text-body">
              Names, contact details, church details, department and emergency contact for
              everyone matching your filters.
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              {/*
                Real links, so the browser downloads natively — the dialog
                closes on click and the audited route handler does the rest.
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
                className={buttonClass({ variant: 'outline', size: 'sm' })}
              >
                <FileSpreadsheet aria-hidden className="size-4" />
                Excel
              </a>
            </div>
          </section>

          <section className="rounded-card border border-line p-4">
            <h3 className="text-sm font-semibold text-ink">Contact list</h3>
            <p className="mt-1 text-sm text-body">
              For writing to this segment: name, MMP number, email, phone, department and country
              — plus whether each volunteer consented to volunteer communication and when.
            </p>
            <p className="mt-2 text-sm text-muted">
              That consent is required to take part, so it covers service email and is not a
              marketing opt-in.
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              <a
                href={`/api/admin/export/contacts?format=csv&${exportQuery}`}
                onClick={() => setOpen(false)}
                className={buttonClass({ size: 'sm' })}
              >
                <Download aria-hidden className="size-4" />
                CSV
              </a>
              <a
                href={`/api/admin/export/contacts?format=xlsx&${exportQuery}`}
                onClick={() => setOpen(false)}
                className={buttonClass({ variant: 'outline', size: 'sm' })}
              >
                <FileSpreadsheet aria-hidden className="size-4" />
                Excel
              </a>
            </div>
          </section>
        </div>

        <div className="mt-6 flex justify-end">
          <DialogClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  )
}
