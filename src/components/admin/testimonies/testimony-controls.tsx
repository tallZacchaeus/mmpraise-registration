'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Bug, ShieldAlert, Star, UserCheck } from 'lucide-react'
import { assignTestimonyAction, setTestimonyFlagsAction } from '@/app/(admin)/admin/actions'
import { Alert, Button } from '@/components/ui/primitives'
import type { SubmissionStatus } from '@/generated/prisma/enums'

/**
 * Assignment and flags for one testimony.
 *
 * Assignment is advisory — it says who is looking after a submission so two
 * moderators do not both draft a reply, but it never locks anybody else out.
 * The flags are toggles with visible state words, not colour-only icons.
 */
export function TestimonyControls({
  id,
  status,
  isSpam,
  isTestData,
  featured,
  assignedToMe,
  assignedToName,
}: {
  id: string
  status: SubmissionStatus
  isSpam: boolean
  isTestData: boolean
  featured: boolean
  assignedToMe: boolean
  assignedToName: string | null
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null)
    startTransition(async () => {
      const result = await action()
      if (!result.ok) {
        setError(result.error ?? 'That did not work')
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="space-y-3">
      {error && <Alert tone="danger">{error}</Alert>}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          isLoading={pending}
          onClick={() => run(() => assignTestimonyAction(id, !assignedToMe))}
        >
          <UserCheck aria-hidden className="size-4" />
          {assignedToMe ? 'Hand back' : 'Take this one'}
        </Button>
        {assignedToName && !assignedToMe && (
          <p className="text-sm text-muted">
            {assignedToName} is looking after this — taking it hands it to you.
          </p>
        )}

        <Button
          variant="outline"
          size="sm"
          isLoading={pending}
          onClick={() => run(() => setTestimonyFlagsAction({ id, isSpam: !isSpam }))}
        >
          <ShieldAlert aria-hidden className="size-4" />
          {isSpam ? 'Not spam after all' : 'Mark as spam'}
        </Button>

        <Button
          variant="outline"
          size="sm"
          isLoading={pending}
          onClick={() => run(() => setTestimonyFlagsAction({ id, isTestData: !isTestData }))}
        >
          <Bug aria-hidden className="size-4" />
          {isTestData ? 'Not test data' : 'Tag as test data'}
        </Button>

        {status === 'APPROVED' && (
          <Button
            variant={featured ? 'secondary' : 'outline'}
            size="sm"
            isLoading={pending}
            onClick={() => run(() => setTestimonyFlagsAction({ id, featured: !featured }))}
          >
            {/*
              "Mark", not "publish": the homepage currently renders its
              testimony section from curated content, so featuring records the
              choice for when that section reads the database. The label must
              not promise a publication that does not yet happen.
            */}
            <Star aria-hidden className="size-4" />
            {featured ? 'Remove featured mark' : 'Mark as featured'}
          </Button>
        )}
      </div>
    </div>
  )
}
