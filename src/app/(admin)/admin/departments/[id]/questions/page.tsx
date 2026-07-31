import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { QuestionEditor } from '@/components/admin/question-editor'
import { Alert, buttonClass } from '@/components/ui/primitives'
import { requirePermission } from '@/lib/auth/rbac'
import { db } from '@/lib/db'
import { getDepartmentQuestions } from '@/lib/reference'

export const metadata: Metadata = { title: 'Department questions' }

export default async function DepartmentQuestionsPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission('question:manage')
  const { id } = await params

  const department = await db.department.findUnique({ where: { id }, select: { id: true, name: true } })
  if (!department) notFound()

  const questions = await getDepartmentQuestions(department.id)

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/departments" className={buttonClass({ variant: 'ghost', size: 'sm' })}>
          <ArrowLeft aria-hidden className="size-4" />
          Back to departments
        </Link>
        <h1 className="mt-4 text-3xl">{department.name} questions</h1>
        <p className="mt-1 text-body">
          These questions appear only to volunteers who choose this department.
        </p>
      </div>

      <Alert tone="info" title="Changes take effect immediately">
        New and edited questions appear in the registration wizard on the next page load. Questions that
        already have answers are retired rather than deleted, so existing applications keep their data.
      </Alert>

      <QuestionEditor departmentId={department.id} questions={questions} />
    </div>
  )
}
