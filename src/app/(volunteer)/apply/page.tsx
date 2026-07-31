import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth/rbac'
import { getOrCreateDraft } from '@/lib/applications/service'
import { stepByNumber } from '@/lib/validation/registration'

/** Entry point: send the volunteer to wherever they left off. */
export default async function ApplyPage() {
  const user = await requireUser()
  const application = await getOrCreateDraft(user.id)

  if (application.status !== 'DRAFT') redirect('/dashboard')

  const step = stepByNumber(Math.min(Math.max(application.currentStep, 1), 8))
  redirect(`/apply/${step.slug}`)
}
