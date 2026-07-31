import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { PrintButton } from '@/components/dashboard/print-button'
import { Badge, buttonClass, Card, CardBody } from '@/components/ui/primitives'
import { requireUser } from '@/lib/auth/rbac'
import { loadWizardState } from '@/lib/applications/service'
import { STATUS_LABELS, STATUS_TONES } from '@/lib/applications/status'
import { buildReviewSections } from '@/lib/applications/review'
import { formatDate } from '@/lib/utils'

export const metadata: Metadata = { title: 'Registration summary' }

/**
 * Printable confirmation of a submitted registration.
 * Uses the same review builder as the wizard, so the printed record always
 * matches what the volunteer reviewed before submitting.
 */
export default async function SummaryPage() {
  const user = await requireUser()
  const state = await loadWizardState(user.id)

  if (state.application.status === 'DRAFT') redirect('/apply')

  const sections = await buildReviewSections(state)

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 no-print">
        <Link href="/dashboard" className={buttonClass({ variant: 'ghost', size: 'sm' })}>
          <ArrowLeft aria-hidden className="size-4" />
          Back to dashboard
        </Link>
        <PrintButton />
      </div>

      <Card>
        <CardBody className="space-y-6">
          <header className="border-b border-line pb-5">
            <h1 className="text-2xl">MMPraise volunteer registration</h1>
            <dl className="mt-4 grid gap-4 sm:grid-cols-3">
              <div>
                <dt className="text-sm text-muted">Registration ID</dt>
                <dd className="font-display text-lg font-bold text-ink">{state.application.registrationId}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted">Status</dt>
                <dd>
                  <Badge tone={STATUS_TONES[state.application.status]}>
                    {STATUS_LABELS[state.application.status]}
                  </Badge>
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted">Submitted</dt>
                <dd className="font-medium text-ink">{formatDate(state.application.submittedAt, true)}</dd>
              </div>
            </dl>
          </header>

          {sections.map((section) => (
            <section key={section.stepSlug} className="print-break-inside-avoid">
              <h2 className="border-b border-line pb-2 text-base">{section.title}</h2>
              <dl className="mt-3 grid gap-x-8 gap-y-3 sm:grid-cols-2">
                {section.items.map((item) => (
                  <div key={item.label} className="min-w-0">
                    <dt className="text-sm text-muted">{item.label}</dt>
                    <dd className="break-words font-medium text-ink">{item.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}

          <footer className="border-t border-line pt-4 text-xs text-muted">
            Generated on {formatDate(new Date(), true)}. Health information is deliberately excluded
            from this summary.
          </footer>
        </CardBody>
      </Card>
    </div>
  )
}
