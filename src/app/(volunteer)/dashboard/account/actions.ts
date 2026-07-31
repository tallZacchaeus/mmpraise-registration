'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { audit } from '@/lib/audit'
import { requireUser } from '@/lib/auth/rbac'
import { fail, ok, type ActionResult } from '@/lib/actions/result'
import { deleteDocument, storeUpload } from '@/lib/files'

/** Replace the volunteer's profile photograph. */
export async function updateProfilePhotoAction(formData: FormData): Promise<ActionResult<{ documentId: string }>> {
  const user = await requireUser()
  const file = formData.get('file')
  if (!(file instanceof File)) return fail('No file was uploaded')

  const profile = await db.volunteerProfile.findUnique({
    where: { userId: user.id },
    select: { photoDocumentId: true },
  })

  const result = await storeUpload({ file, userId: user.id, kind: 'PROFILE_PHOTO' })
  if (!result.ok) return fail(result.error)

  await db.volunteerProfile.update({
    where: { userId: user.id },
    data: { photoDocumentId: result.documentId },
  })

  // Remove the old file once the new one is safely in place.
  if (profile?.photoDocumentId) await deleteDocument(profile.photoDocumentId)

  await audit({
    action: 'document.uploaded',
    entityType: 'VolunteerDocument',
    entityId: result.documentId,
    actorId: user.id,
    metadata: { kind: 'PROFILE_PHOTO', replaced: profile?.photoDocumentId ?? null },
  })

  revalidatePath('/dashboard')
  return ok({ documentId: result.documentId })
}

/**
 * Record a data-removal request.
 *
 * Deletion is not immediate: safeguarding records may need to be retained, and
 * an accidental click must not destroy an application. The request is flagged
 * for an administrator, who completes it within the published 30-day window.
 */
export async function requestAccountDeletionAction(): Promise<ActionResult> {
  const user = await requireUser()

  await db.user.update({
    where: { id: user.id },
    data: { deletionRequestedAt: new Date() },
  })

  await audit({
    action: 'user.deletion_requested',
    entityType: 'User',
    entityId: user.id,
    actorId: user.id,
  })

  revalidatePath('/dashboard/account')
  return ok()
}

export async function cancelAccountDeletionAction(): Promise<ActionResult> {
  const user = await requireUser()
  await db.user.update({ where: { id: user.id }, data: { deletionRequestedAt: null } })
  revalidatePath('/dashboard/account')
  return ok()
}
