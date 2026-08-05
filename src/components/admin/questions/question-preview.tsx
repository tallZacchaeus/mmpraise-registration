'use client'

import { useState } from 'react'
import { Eye } from 'lucide-react'
import { QuestionField } from '@/components/apply/question-field'
import { Alert, Button, EmptyState } from '@/components/ui/primitives'
import { validateAnswers, visibleQuestions } from '@/lib/questions/engine'
import type { AnswerMap, AnswerValue, QuestionDef } from '@/lib/questions/engine'

/**
 * The question set as a volunteer meets it.
 *
 * Renders through the same `QuestionField` and the same visibility and
 * validation engine the wizard uses — so a conditional chain that looks right
 * here is right, rather than right in a mock-up of it. Nothing is saved.
 */
export function QuestionPreview({ questions }: { questions: QuestionDef[] }) {
  const [answers, setAnswers] = useState<AnswerMap>({})
  const [errors, setErrors] = useState<Record<string, string>>({})

  const shown = visibleQuestions(questions, answers)

  function setAnswer(key: string, value: AnswerValue) {
    setAnswers((current) => ({ ...current, [key]: value }))
    setErrors({})
  }

  if (questions.length === 0) {
    return (
      <EmptyState
        icon={<Eye className="size-8" />}
        title="Nothing to preview"
        description="Add a question and it will appear here exactly as a volunteer sees it."
      />
    )
  }

  return (
    <div className="space-y-5">
      <Alert tone="info">
        A working copy of the real form. Answers are not saved, and no volunteer sees anything you
        do here.
      </Alert>

      {shown.map((question) => (
        <QuestionField
          key={question.id}
          question={question}
          value={answers[question.key]}
          onChange={(value) => setAnswer(question.key, value)}
          error={errors[question.key]}
        />
      ))}

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setErrors(validateAnswers(questions, answers))}
        >
          Check the answers
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setAnswers({})
            setErrors({})
          }}
        >
          Start again
        </Button>
        <p className="text-xs text-muted">
          {shown.length} of {questions.length} question{questions.length === 1 ? '' : 's'} showing
          with these answers.
        </p>
      </div>
    </div>
  )
}
