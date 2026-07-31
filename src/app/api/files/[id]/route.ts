import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { audit } from '@/lib/audit'
import { getSessionUser } from '@/lib/auth/session'
import { can, departmentScope } from '@/lib/auth/rbac'
import { storage } from '@/lib/storage'

/**
 * Authorised file delivery.
 *
 * Uploads are never exposed at a guessable public URL. Every read passes through
 * this handler, which checks that the caller either owns the document or holds a
 * role that may view the owning application — and, for department heads, that
 * the application belongs to one of their departments.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) return new NextResponse('Unauthorised', { status: 401 })

  const { id } = await params
  const document = await db.volunteerDocument.findUnique({
    where: { id },
    include: { application: { select: { departmentId: true } } },
  })

  if (!document) return new NextResponse('Not found', { status: 404 })

  const isOwner = document.userId === user.id
  let allowed = isOwner

  if (!allowed && can(user, 'application:view_all')) allowed = true

  if (!allowed && can(user, 'application:view_department')) {
    const scope = departmentScope(user)
    allowed = Boolean(document.application?.departmentId && scope?.includes(document.application.departmentId))
  }

  if (!allowed) return new NextResponse('Forbidden', { status: 403 })

  try {
    const body = await storage.get(document.storageKey)

    if (!isOwner) {
      await audit({
        action: 'document.downloaded',
        entityType: 'VolunteerDocument',
        entityId: document.id,
        actorId: user.id,
      })
    }

    return new NextResponse(new Uint8Array(body), {
      headers: {
        'Content-Type': document.mimeType,
        'Content-Length': String(body.byteLength),
        // Never render an upload inline: an attachment cannot execute in the
        // page's origin even if it slipped past the content checks.
        'Content-Disposition': `${document.mimeType.startsWith('image/') ? 'inline' : 'attachment'}; filename="${encodeURIComponent(document.originalName)}"`,
        'Cache-Control': 'private, max-age=3600',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; img-src 'self'; sandbox",
      },
    })
  } catch (error) {
    console.error('[files] read failed', { id, error })
    return new NextResponse('File unavailable', { status: 502 })
  }
}
