import Link from 'next/link'
import { Rows3 } from 'lucide-react'
import { InviteExclusionToggle } from '@/components/admin/migration/invite-exclusion-toggle'
import { Badge, Card, CardBody, CardHeader, EmptyState, buttonClass } from '@/components/ui/primitives'
import { db } from '@/lib/db'
import {
  INVITATION_LABELS,
  INVITATION_TONES,
  ROW_ACTION_LABELS,
  ROW_STATUS_LABELS,
  ROW_STATUS_TONES,
} from '@/lib/migration/labels'

/**
 * The rows of one batch, filtered by outcome.
 *
 * Capped at 200 with the filter shown, rather than paginated: the reason to
 * open this table is almost always "show me the ones that did not work", which
 * is a short list. The full record set leaves through the CSV report, which is
 * what a spreadsheet is for.
 *
 * Email addresses appear here because matching is done on them and an
 * administrator resolving a duplicate has to see which address is which. They
 * are behind `migration:view`, which is not granted by default to any role
 * except super administrator and registration administrator.
 */
const PER_VIEW = 200

const FILTERS = [
  { key: 'problems', label: 'Problems', statuses: ['INVALID', 'FAILED'] },
  { key: 'skipped', label: 'Skipped', statuses: ['SKIPPED'] },
  { key: 'imported', label: 'Imported', statuses: ['IMPORTED'] },
  { key: 'ready', label: 'Ready', statuses: ['VALID', 'WARNING'] },
  { key: 'all', label: 'All', statuses: [] },
] as const

export type RowFilter = (typeof FILTERS)[number]['key']

/** Narrow an untrusted query parameter to a filter this table understands. */
export function isRowFilter(value: string | undefined): value is RowFilter {
  return FILTERS.some((filter) => filter.key === value)
}

export async function RowTable({
  batchId,
  filter = 'problems',
  canInvite,
}: {
  batchId: string
  filter?: RowFilter
  canInvite: boolean
}) {
  const active = FILTERS.find((f) => f.key === filter) ?? FILTERS[0]

  const [records, total] = await Promise.all([
    db.migratedUserRecord.findMany({
      where: {
        batchId,
        ...(active.statuses.length > 0 ? { status: { in: active.statuses as never } } : {}),
      },
      orderBy: { rowNumber: 'asc' },
      take: PER_VIEW,
    }),
    db.migratedUserRecord.count({
      where: {
        batchId,
        ...(active.statuses.length > 0 ? { status: { in: active.statuses as never } } : {}),
      },
    }),
  ])

  return (
    <Card>
      <CardHeader
        title="Rows"
        description={
          total > PER_VIEW
            ? `Showing the first ${PER_VIEW} of ${total}. Download the report for the rest.`
            : total > 0
              ? `${total} ${total === 1 ? 'row' : 'rows'}.`
              : undefined
        }
        action={
          <ul className="flex flex-wrap gap-2">
            {FILTERS.map((option) => (
              <li key={option.key}>
                <Link
                  href={`?rows=${option.key}`}
                  scroll={false}
                  aria-current={option.key === filter ? 'true' : undefined}
                  className={buttonClass({
                    variant: option.key === filter ? 'primary' : 'ghost',
                    size: 'sm',
                  })}
                >
                  {option.label}
                </Link>
              </li>
            ))}
          </ul>
        }
      />
      <CardBody className={records.length > 0 ? 'px-0 py-0 sm:px-0' : undefined}>
        {records.length === 0 ? (
          <EmptyState
            icon={<Rows3 className="size-8" />}
            title={
              filter === 'problems' ? 'No problems in this batch' : 'Nothing matches that filter'
            }
            description={
              filter === 'problems'
                ? 'Every row in this file could be read and matched. Choose another filter to see the rest.'
                : 'Try a different filter, or validate the batch if you have not yet.'
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[56rem] border-collapse text-sm">
              <caption className="sr-only">
                Rows in this import, with what happened to each and any problems found.
              </caption>
              <thead>
                <tr className="border-b border-line text-left">
                  <Th className="w-16 text-right">Row</Th>
                  <Th>Person</Th>
                  <Th>Outcome</Th>
                  <Th>Notes</Th>
                  <Th>Invitation</Th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => {
                  const messages = (record.validationMessages ?? []) as {
                    field: string
                    level: string
                    message: string
                  }[]

                  return (
                    <tr key={record.id} className="border-b border-line last:border-0 align-top">
                      <Td className="text-right tabular-nums text-muted">{record.rowNumber}</Td>
                      <Td>
                        <span className="block font-medium text-ink">
                          {[record.firstName, record.lastName].filter(Boolean).join(' ') || '—'}
                        </span>
                        <span className="block break-all text-xs text-muted">
                          {record.normalisedEmail}
                        </span>
                      </Td>
                      <Td>
                        <Badge tone={ROW_STATUS_TONES[record.status]}>
                          {ROW_STATUS_LABELS[record.status]}
                        </Badge>
                        <span className="mt-1 block text-xs text-muted">
                          {ROW_ACTION_LABELS[record.action]}
                        </span>
                      </Td>
                      <Td className="max-w-md">
                        {messages.length === 0 ? (
                          <span className="text-muted">—</span>
                        ) : (
                          <ul className="space-y-1">
                            {messages.map((message, index) => (
                              <li
                                key={`${record.id}-${index}`}
                                className={
                                  message.level === 'error' ? 'text-danger' : 'text-body'
                                }
                              >
                                <span className="font-medium">{message.field}:</span>{' '}
                                {message.message}
                              </li>
                            ))}
                          </ul>
                        )}
                      </Td>
                      <Td>
                        <Badge tone={INVITATION_TONES[record.invitationStatus]}>
                          {INVITATION_LABELS[record.invitationStatus]}
                        </Badge>
                        {canInvite &&
                          record.action === 'CREATE' &&
                          record.invitationStatus !== 'SENT' &&
                          record.invitationStatus !== 'DELIVERED' && (
                            <InviteExclusionToggle
                              recordId={record.id}
                              excluded={record.excludedFromInvites}
                              personLabel={record.normalisedEmail}
                            />
                          )}
                        {record.invitationError && (
                          <span className="mt-1 block text-xs text-danger">
                            {record.invitationError}
                          </span>
                        )}
                      </Td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardBody>
    </Card>
  )
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      scope="col"
      className={`px-5 py-3 font-display text-xs uppercase tracking-wide text-muted ${className ?? ''}`}
    >
      {children}
    </th>
  )
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-5 py-3 text-body ${className ?? ''}`}>{children}</td>
}
