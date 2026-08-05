import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { QuestionEditor } from '@/components/admin/question-editor'
import { CopyQuestions } from '@/components/admin/questions/copy-questions'
import { QuestionPreview } from '@/components/admin/questions/question-preview'
import { RetiredQuestions } from '@/components/admin/questions/retired-questions'
import { Alert, buttonClass, Card, CardBody, CardHeader } from '@/components/ui/primitives'
import { requirePermission } from '@/lib/auth/rbac'
import { db } from '@/lib/db'
import { getDepartmentQuestions } from '@/lib/reference'

export const metadata: Metadata = { title: 'Department questions' }

export default async function DepartmentQuestionsPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission('question:manage')
  const { id } = await params

  const department = await db.department.findUnique({ where: { id }, select: { id: true, name: true } })
  if (!department) notFound()

  const [questions, retired, answerRows, otherDepartments] = await Promise.all([
    getDepartmentQuestions(department.id),
    db.departmentQuestion.findMany({
      where: { departmentId: department.id, isActive: false },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      select: { id: true, label: true, key: true, _count: { select: { answers: true } } },
    }),
    /*
     * How often each question has actually been answered. It belongs next to
     * the retire button: retiring a question that 400 people answered and one
     * nobody has are very different acts, and the list used to look identical.
     */
    db.applicationAnswer.groupBy({
      by: ['questionId'],
      where: { question: { departmentId: department.id } },
      _count: { _all: true },
    }),
    db.department.findMany({
      where: { id: { not: department.id }, questions: { some: { isActive: true } } },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true },
    }),
  ])

  const answerCounts = Object.fromEntries(
    answerRows.map((row) => [row.questionId, row._count._all]),
  )

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
        New and edited questions appear in the registration wizard on the next page load. Questions
        that already have answers are retired rather than deleted, so existing applications keep
        their data — and retired questions can be brought back below.
      </Alert>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="space-y-5">
          <QuestionEditor
            departmentId={department.id}
            questions={questions}
            answerCounts={answerCounts}
          />

          <Card>
            <CardHeader
              title="Retired questions"
              description="No longer asked. Answers already given are kept."
            />
            <CardBody>
              <RetiredQuestions
                questions={retired.map((question) => ({
                  id: question.id,
                  label: question.label,
                  key: question.key,
                  answers: question._count.answers,
                }))}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Start from another department"
              description="Copies arrive retired, so nothing half-copied reaches a volunteer."
            />
            <CardBody>
              <CopyQuestions departmentId={department.id} departments={otherDepartments} />
            </CardBody>
          </Card>
        </div>

        <Card>
          <CardHeader title="Preview" description="The form as a volunteer meets it." />
          <CardBody>
            <QuestionPreview questions={questions} />
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
