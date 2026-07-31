'use client'

import { useState, useTransition } from 'react'
import { Pencil, Plus, Trash2, X } from 'lucide-react'
import { deleteQuestionAction, saveQuestionAction } from '@/app/(admin)/admin/manage-actions'
import { Alert, Badge, Button, Card, CardBody, CardHeader } from '@/components/ui/primitives'
import { Checkbox, Field, SelectInput, TextArea, TextInput } from '@/components/ui/form'
import type { QuestionDef } from '@/lib/questions/engine'
import type { FieldErrors } from '@/lib/actions/result'

/**
 * Department question editor.
 *
 * Lets an administrator add, edit, reorder, retire and conditionally chain
 * questions without touching application code — the wizard renders whatever is
 * saved here on the next page load.
 */
const TYPES: { value: QuestionDef['type']; label: string; hasOptions: boolean }[] = [
  { value: 'TEXT', label: 'Short text', hasOptions: false },
  { value: 'TEXTAREA', label: 'Long text', hasOptions: false },
  { value: 'EMAIL', label: 'Email address', hasOptions: false },
  { value: 'TEL', label: 'Phone number', hasOptions: false },
  { value: 'NUMBER', label: 'Number', hasOptions: false },
  { value: 'DATE', label: 'Date', hasOptions: false },
  { value: 'RADIO', label: 'Radio buttons (choose one)', hasOptions: true },
  { value: 'SELECT', label: 'Dropdown (choose one)', hasOptions: true },
  { value: 'CHECKBOX', label: 'Checkboxes (choose many)', hasOptions: true },
  { value: 'MULTISELECT', label: 'Multi-select (choose many)', hasOptions: true },
  { value: 'FILE', label: 'File upload', hasOptions: false },
  { value: 'RATING', label: 'Rating scale', hasOptions: false },
]

type Draft = {
  id?: string
  key: string
  label: string
  helpText: string
  type: QuestionDef['type']
  isRequired: boolean
  isActive: boolean
  sortOrder: number
  optionsText: string
  parentQuestionId: string
  parentOptionValues: string[]
  pattern: string
  patternMessage: string
  ratingMin: number
  ratingMax: number
}

function emptyDraft(sortOrder: number): Draft {
  return {
    key: '',
    label: '',
    helpText: '',
    type: 'RADIO',
    isRequired: true,
    isActive: true,
    sortOrder,
    optionsText: 'yes|Yes\nno|No',
    parentQuestionId: '',
    parentOptionValues: [],
    pattern: '',
    patternMessage: '',
    ratingMin: 0,
    ratingMax: 5,
  }
}

function toDraft(question: QuestionDef): Draft {
  return {
    id: question.id,
    key: question.key,
    label: question.label,
    helpText: question.helpText ?? '',
    type: question.type,
    isRequired: question.isRequired,
    isActive: true,
    sortOrder: question.sortOrder,
    optionsText: question.options.map((o) => `${o.value}|${o.label}`).join('\n'),
    parentQuestionId: question.parentQuestionId ?? '',
    parentOptionValues: question.parentOptionValues,
    pattern: question.pattern ?? '',
    patternMessage: question.patternMessage ?? '',
    ratingMin: question.ratingMin ?? 0,
    ratingMax: question.ratingMax ?? 5,
  }
}

export function QuestionEditor({
  departmentId,
  questions,
}: {
  departmentId: string
  questions: QuestionDef[]
}) {
  const [draft, setDraft] = useState<Draft | null>(null)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null)
  const [pending, startTransition] = useTransition()

  const typeMeta = TYPES.find((t) => t.value === draft?.type)
  const parentCandidates = questions.filter(
    (q) => q.id !== draft?.id && ['RADIO', 'SELECT', 'CHECKBOX', 'MULTISELECT'].includes(q.type),
  )
  const parentQuestion = parentCandidates.find((q) => q.id === draft?.parentQuestionId)

  function save(event: React.FormEvent) {
    event.preventDefault()
    if (!draft) return
    setMessage(null)

    startTransition(async () => {
      const result = await saveQuestionAction({
        ...draft,
        departmentId,
        helpText: draft.helpText || null,
        parentQuestionId: draft.parentQuestionId || null,
        pattern: draft.pattern || null,
        patternMessage: draft.patternMessage || null,
        ratingMin: draft.type === 'RATING' ? Number(draft.ratingMin) : null,
        ratingMax: draft.type === 'RATING' ? Number(draft.ratingMax) : null,
        sortOrder: Number(draft.sortOrder),
      })

      if (!result.ok) {
        setErrors(result.fieldErrors ?? {})
        setMessage({ tone: 'danger', text: result.error })
        return
      }
      setErrors({})
      setDraft(null)
      setMessage({ tone: 'success', text: 'Question saved.' })
    })
  }

  function remove(id: string) {
    startTransition(async () => {
      const result = await deleteQuestionAction(id)
      setMessage(
        result.ok
          ? { tone: 'success', text: 'Question removed. Questions that already have answers are retired instead of deleted.' }
          : { tone: 'danger', text: result.error },
      )
    })
  }

  return (
    <div className="space-y-5">
      {message && <Alert tone={message.tone}>{message.text}</Alert>}

      <Card>
        <CardHeader
          title="Questions"
          description={`${questions.length} active question${questions.length === 1 ? '' : 's'} for this department.`}
          action={
            !draft && (
              <Button type="button" size="sm" onClick={() => setDraft(emptyDraft(questions.length))}>
                <Plus aria-hidden className="size-4" />
                Add question
              </Button>
            )
          }
        />
        <CardBody>
          {questions.length === 0 ? (
            <p className="text-sm text-muted">No questions yet. Add the first one.</p>
          ) : (
            <ol className="space-y-3">
              {questions.map((question) => {
                const parent = questions.find((q) => q.id === question.parentQuestionId)
                return (
                  <li
                    key={question.id}
                    className="flex flex-wrap items-start justify-between gap-3 rounded-field border border-line p-3"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-ink">
                        {question.sortOrder + 1}. {question.label}
                      </p>
                      <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                        <code className="rounded bg-surface-sunken px-1.5 py-0.5">{question.key}</code>
                        <Badge tone="neutral">{TYPES.find((t) => t.value === question.type)?.label}</Badge>
                        {question.isRequired && <Badge tone="brand">Required</Badge>}
                        {parent && (
                          <Badge tone="info">
                            Shown when “{parent.label}” = {question.parentOptionValues.join(' or ')}
                          </Badge>
                        )}
                      </p>
                      {question.options.length > 0 && (
                        <p className="mt-1 text-xs text-muted">
                          Options: {question.options.map((o) => o.label).join(', ')}
                        </p>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <Button type="button" variant="ghost" size="sm" onClick={() => setDraft(toDraft(question))}>
                        <Pencil aria-hidden className="size-4" />
                        Edit
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        isLoading={pending}
                        onClick={() => remove(question.id)}
                      >
                        <Trash2 aria-hidden className="size-4" />
                        Remove
                      </Button>
                    </div>
                  </li>
                )
              })}
            </ol>
          )}
        </CardBody>
      </Card>

      {draft && (
        <Card>
          <CardHeader
            title={draft.id ? 'Edit question' : 'New question'}
            action={
              <Button type="button" variant="ghost" size="sm" onClick={() => setDraft(null)}>
                <X aria-hidden className="size-4" />
                Cancel
              </Button>
            }
          />
          <CardBody>
            <form onSubmit={save} className="space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Question" htmlFor="q-label" required error={errors.label}>
                  <TextInput
                    id="q-label"
                    value={draft.label}
                    onChange={(event) => setDraft({ ...draft, label: event.target.value })}
                    invalid={Boolean(errors.label)}
                  />
                </Field>

                <Field
                  label="Key"
                  htmlFor="q-key"
                  required
                  error={errors.key}
                  help="Stable identifier used in exports. Lowercase, underscores."
                >
                  <TextInput
                    id="q-key"
                    value={draft.key}
                    onChange={(event) => setDraft({ ...draft, key: event.target.value })}
                    invalid={Boolean(errors.key)}
                    className="font-mono"
                  />
                </Field>
              </div>

              <Field label="Help text" htmlFor="q-help" error={errors.helpText}>
                <TextInput
                  id="q-help"
                  maxLength={300}
                  value={draft.helpText}
                  onChange={(event) => setDraft({ ...draft, helpText: event.target.value })}
                />
              </Field>

              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Answer type" htmlFor="q-type" required>
                  <SelectInput
                    id="q-type"
                    value={draft.type}
                    onChange={(event) => setDraft({ ...draft, type: event.target.value as QuestionDef['type'] })}
                  >
                    {TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </SelectInput>
                </Field>

                <Field label="Position" htmlFor="q-order" help="Lower numbers appear first.">
                  <TextInput
                    id="q-order"
                    type="number"
                    min={0}
                    value={draft.sortOrder}
                    onChange={(event) => setDraft({ ...draft, sortOrder: Number(event.target.value) })}
                  />
                </Field>
              </div>

              {typeMeta?.hasOptions && (
                <Field
                  label="Options"
                  htmlFor="q-options"
                  required
                  error={errors.optionsText}
                  help='One per line, as "value|Label". An option labelled "Other" automatically reveals a text box.'
                >
                  <TextArea
                    id="q-options"
                    value={draft.optionsText}
                    onChange={(event) => setDraft({ ...draft, optionsText: event.target.value })}
                    className="font-mono"
                    invalid={Boolean(errors.optionsText)}
                  />
                </Field>
              )}

              {draft.type === 'RATING' && (
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Lowest value" htmlFor="q-rating-min">
                    <TextInput
                      id="q-rating-min"
                      type="number"
                      value={draft.ratingMin}
                      onChange={(event) => setDraft({ ...draft, ratingMin: Number(event.target.value) })}
                    />
                  </Field>
                  <Field label="Highest value" htmlFor="q-rating-max">
                    <TextInput
                      id="q-rating-max"
                      type="number"
                      value={draft.ratingMax}
                      onChange={(event) => setDraft({ ...draft, ratingMax: Number(event.target.value) })}
                    />
                  </Field>
                </div>
              )}

              {draft.type === 'TEXT' && (
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Validation pattern" htmlFor="q-pattern" help="Optional regular expression, e.g. a URL format.">
                    <TextInput
                      id="q-pattern"
                      value={draft.pattern}
                      onChange={(event) => setDraft({ ...draft, pattern: event.target.value })}
                      className="font-mono"
                    />
                  </Field>
                  <Field label="Message when it does not match" htmlFor="q-pattern-message">
                    <TextInput
                      id="q-pattern-message"
                      value={draft.patternMessage}
                      onChange={(event) => setDraft({ ...draft, patternMessage: event.target.value })}
                    />
                  </Field>
                </div>
              )}

              <fieldset className="rounded-field border border-line p-4">
                <legend className="px-1 font-display text-sm font-bold uppercase text-ink">
                  Show this question conditionally
                </legend>

                <Field label="Only show when this question is answered" htmlFor="q-parent" error={errors.parentQuestionId}>
                  <SelectInput
                    id="q-parent"
                    value={draft.parentQuestionId}
                    onChange={(event) =>
                      setDraft({ ...draft, parentQuestionId: event.target.value, parentOptionValues: [] })
                    }
                  >
                    <option value="">Always show</option>
                    {parentCandidates.map((question) => (
                      <option key={question.id} value={question.id}>
                        {question.label}
                      </option>
                    ))}
                  </SelectInput>
                </Field>

                {parentQuestion && (
                  <div className="mt-4">
                    <p className="mb-2 text-sm font-semibold text-ink">…with one of these answers</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {parentQuestion.options.map((option) => (
                        <Checkbox
                          key={option.id}
                          checked={draft.parentOptionValues.includes(option.value)}
                          onChange={(checked) =>
                            setDraft({
                              ...draft,
                              parentOptionValues: checked
                                ? [...draft.parentOptionValues, option.value]
                                : draft.parentOptionValues.filter((v) => v !== option.value),
                            })
                          }
                          label={option.label}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </fieldset>

              <Checkbox
                checked={draft.isRequired}
                onChange={(checked) => setDraft({ ...draft, isRequired: checked })}
                label="This question is required"
              />

              <Button type="submit" isLoading={pending}>
                Save question
              </Button>
            </form>
          </CardBody>
        </Card>
      )}
    </div>
  )
}
