import type { QuestionType } from '@/generated/prisma/enums'

/**
 * Department question engine.
 *
 * A pure, isomorphic module: the browser uses it to decide which questions to
 * show and to validate before submitting, and the server uses the *same*
 * functions to re-validate. Because there is one implementation, the client and
 * server can never disagree about whether an answer was required.
 */

export type QuestionOptionDef = {
  id: string
  value: string
  label: string
  requiresText: boolean
}

export type QuestionDef = {
  id: string
  key: string
  label: string
  helpText: string | null
  type: QuestionType
  isRequired: boolean
  sortOrder: number
  maxLength: number | null
  minValue: number | null
  maxValue: number | null
  ratingMin: number | null
  ratingMax: number | null
  allowedMimeTypes: string[]
  maxFileSizeKb: number | null
  placeholder: string | null
  pattern: string | null
  patternMessage: string | null
  parentQuestionId: string | null
  parentOptionValues: string[]
  options: QuestionOptionDef[]
}

/** Normalised answer, mapping one-to-one onto the application_answers table. */
export type AnswerValue = {
  text?: string | null
  number?: number | null
  bool?: boolean | null
  date?: string | null
  /** Chosen options, with free text for any option flagged requiresText. */
  options?: { value: string; otherText?: string | null }[]
  documentId?: string | null
}

export type AnswerMap = Record<string, AnswerValue>

export const CHOICE_TYPES: QuestionType[] = ['RADIO', 'SELECT', 'CHECKBOX', 'MULTISELECT']
export const MULTI_CHOICE_TYPES: QuestionType[] = ['CHECKBOX', 'MULTISELECT']

export function isChoiceQuestion(type: QuestionType): boolean {
  return CHOICE_TYPES.includes(type)
}

export function isMultiChoiceQuestion(type: QuestionType): boolean {
  return MULTI_CHOICE_TYPES.includes(type)
}

/**
 * Is this question currently shown?
 * A question with a parent appears only when the parent is itself visible and
 * the parent's selected option matches one of parentOptionValues.
 */
export function isQuestionVisible(question: QuestionDef, all: QuestionDef[], answers: AnswerMap): boolean {
  if (!question.parentQuestionId) return true

  const parent = all.find((q) => q.id === question.parentQuestionId)
  if (!parent) return true
  if (!isQuestionVisible(parent, all, answers)) return false

  const parentAnswer = answers[parent.key]
  if (!parentAnswer) return false

  const selected = (parentAnswer.options ?? []).map((o) => o.value)
  if (question.parentOptionValues.length === 0) return selected.length > 0
  return selected.some((value) => question.parentOptionValues.includes(value))
}

export function visibleQuestions(questions: QuestionDef[], answers: AnswerMap): QuestionDef[] {
  return questions
    .filter((q) => isQuestionVisible(q, questions, answers))
    .sort((a, b) => a.sortOrder - b.sortOrder)
}

/**
 * Drop answers belonging to questions that are no longer visible.
 * Prevents a stale answer (e.g. an instrument chosen before switching to Singer)
 * from being stored or validated.
 */
export function pruneHiddenAnswers(questions: QuestionDef[], answers: AnswerMap): AnswerMap {
  const visible = new Set(visibleQuestions(questions, answers).map((q) => q.key))
  const next: AnswerMap = {}
  for (const [key, value] of Object.entries(answers)) {
    if (visible.has(key)) next[key] = value
  }
  return next
}

function isBlank(question: QuestionDef, answer: AnswerValue | undefined): boolean {
  if (!answer) return true

  if (isChoiceQuestion(question.type)) return (answer.options ?? []).length === 0
  if (question.type === 'FILE') return !answer.documentId
  if (question.type === 'NUMBER' || question.type === 'RATING') {
    return answer.number === null || answer.number === undefined || Number.isNaN(answer.number)
  }
  return !answer.text || answer.text.trim().length === 0
}

export type AnswerErrors = Record<string, string>

/**
 * Validate a full answer set against the department's questions.
 * Returns a map of question key -> message; an empty object means valid.
 */
export function validateAnswers(questions: QuestionDef[], answers: AnswerMap): AnswerErrors {
  const errors: AnswerErrors = {}
  const visible = visibleQuestions(questions, answers)

  for (const question of visible) {
    const answer = answers[question.key]
    const blank = isBlank(question, answer)

    if (question.isRequired && blank) {
      errors[question.key] = isChoiceQuestion(question.type)
        ? 'Select an option'
        : question.type === 'FILE'
          ? 'Upload a file'
          : 'This answer is required'
      continue
    }

    if (blank || !answer) continue

    switch (question.type) {
      case 'TEXT':
      case 'TEXTAREA':
      case 'EMAIL':
      case 'TEL': {
        const text = answer.text ?? ''
        if (question.maxLength && text.length > question.maxLength) {
          errors[question.key] = `Must be ${question.maxLength} characters or fewer`
        } else if (question.type === 'EMAIL' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(text)) {
          errors[question.key] = 'Enter a valid email address'
        } else if (question.type === 'TEL' && !/^\+?[\d\s()-]{7,20}$/.test(text)) {
          errors[question.key] = 'Enter a valid phone number'
        } else if (question.pattern) {
          let matches = true
          try {
            matches = new RegExp(question.pattern).test(text)
          } catch {
            // A malformed pattern must not block a volunteer's submission.
            matches = true
          }
          if (!matches) errors[question.key] = question.patternMessage ?? 'Enter a valid value'
        }
        break
      }

      case 'NUMBER':
      case 'RATING': {
        const value = answer.number as number
        const min = question.type === 'RATING' ? (question.ratingMin ?? 0) : question.minValue
        const max = question.type === 'RATING' ? (question.ratingMax ?? 5) : question.maxValue
        if (!Number.isFinite(value)) errors[question.key] = 'Enter a number'
        else if (min !== null && min !== undefined && value < min) errors[question.key] = `Must be ${min} or more`
        else if (max !== null && max !== undefined && value > max) errors[question.key] = `Must be ${max} or less`
        break
      }

      case 'DATE': {
        const date = new Date(answer.date ?? '')
        if (Number.isNaN(date.getTime())) errors[question.key] = 'Enter a valid date'
        break
      }

      case 'RADIO':
      case 'SELECT':
      case 'CHECKBOX':
      case 'MULTISELECT': {
        const chosen = answer.options ?? []
        const valid = new Map(question.options.map((o) => [o.value, o]))

        if (!isMultiChoiceQuestion(question.type) && chosen.length > 1) {
          errors[question.key] = 'Select only one option'
          break
        }

        for (const choice of chosen) {
          const option = valid.get(choice.value)
          if (!option) {
            errors[question.key] = 'Select a valid option'
            break
          }
          if (option.requiresText && !choice.otherText?.trim()) {
            errors[question.key] = `Please specify your ${option.label.toLowerCase()} answer`
            break
          }
          if (option.requiresText && (choice.otherText?.length ?? 0) > 200) {
            errors[question.key] = 'Must be 200 characters or fewer'
            break
          }
        }
        break
      }

      case 'FILE':
        // Content is validated when the file is uploaded; here we only confirm a
        // document reference exists. Ownership is checked server-side on submit.
        break
    }
  }

  return errors
}

/** Human-readable answer text, used by the review screen, exports and emails. */
export function formatAnswer(question: QuestionDef, answer: AnswerValue | undefined): string {
  if (!answer) return '—'

  if (isChoiceQuestion(question.type)) {
    const chosen = answer.options ?? []
    if (chosen.length === 0) return '—'
    return chosen
      .map((choice) => {
        const option = question.options.find((o) => o.value === choice.value)
        const label = option?.label ?? choice.value
        return choice.otherText ? `${label}: ${choice.otherText}` : label
      })
      .join(', ')
  }

  if (question.type === 'FILE') return answer.documentId ? 'File uploaded' : '—'
  if (question.type === 'RATING' || question.type === 'NUMBER') {
    return answer.number === null || answer.number === undefined ? '—' : String(answer.number)
  }
  if (question.type === 'DATE') return answer.date ?? '—'

  return answer.text?.trim() ? answer.text : '—'
}
