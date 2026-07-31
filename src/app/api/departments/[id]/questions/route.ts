import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth/session'
import { getDepartmentQuestions } from '@/lib/reference'

/**
 * Question definitions for one department.
 * Loaded on demand so the wizard never ships every department's questions.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { id } = await params

  try {
    const items = await getDepartmentQuestions(id)
    return NextResponse.json({ items }, { headers: { 'Cache-Control': 'private, max-age=300' } })
  } catch (error) {
    console.error('[questions] load failed', { id, error })
    return NextResponse.json({ error: 'Could not load questions' }, { status: 500 })
  }
}
