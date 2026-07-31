import { describe, expect, it } from 'vitest'
import {
  formatAnswer,
  isQuestionVisible,
  pruneHiddenAnswers,
  validateAnswers,
  visibleQuestions,
  type AnswerMap,
  type QuestionDef,
} from '@/lib/questions/engine'

/**
 * The question engine decides which department questions a volunteer sees and
 * whether their answers are acceptable. The same code runs in the browser and
 * on the server, so these tests cover the contract both rely on.
 */
function question(overrides: Partial<QuestionDef> & { key: string }): QuestionDef {
  return {
    id: overrides.id ?? overrides.key,
    key: overrides.key,
    label: overrides.label ?? overrides.key,
    helpText: null,
    type: overrides.type ?? 'TEXT',
    isRequired: overrides.isRequired ?? false,
    sortOrder: overrides.sortOrder ?? 0,
    maxLength: overrides.maxLength ?? null,
    minValue: overrides.minValue ?? null,
    maxValue: overrides.maxValue ?? null,
    ratingMin: overrides.ratingMin ?? null,
    ratingMax: overrides.ratingMax ?? null,
    allowedMimeTypes: overrides.allowedMimeTypes ?? [],
    maxFileSizeKb: overrides.maxFileSizeKb ?? null,
    placeholder: null,
    pattern: overrides.pattern ?? null,
    patternMessage: overrides.patternMessage ?? null,
    parentQuestionId: overrides.parentQuestionId ?? null,
    parentOptionValues: overrides.parentOptionValues ?? [],
    options: overrides.options ?? [],
  }
}

const option = (value: string, label = value, requiresText = false) => ({
  id: value,
  value,
  label,
  requiresText,
})

// Mirrors the seeded Volunteers Praise Team question set.
const PRAISE_TEAM: QuestionDef[] = [
  question({
    key: 'music_option',
    type: 'RADIO',
    isRequired: true,
    sortOrder: 0,
    options: [option('singer', 'Singer'), option('instrumentalist', 'Instrumentalist')],
  }),
  question({
    key: 'voice_role',
    type: 'RADIO',
    isRequired: true,
    sortOrder: 1,
    parentQuestionId: 'music_option',
    parentOptionValues: ['singer'],
    options: [option('soprano'), option('alto'), option('tenor')],
  }),
  question({
    key: 'instrument',
    type: 'SELECT',
    isRequired: true,
    sortOrder: 2,
    parentQuestionId: 'music_option',
    parentOptionValues: ['instrumentalist'],
    options: [option('drummer'), option('other', 'Other', true)],
  }),
]

describe('conditional visibility', () => {
  it('hides conditional questions until the parent is answered', () => {
    const visible = visibleQuestions(PRAISE_TEAM, {})
    expect(visible.map((q) => q.key)).toEqual(['music_option'])
  })

  it('shows only the branch matching the parent answer', () => {
    const singer: AnswerMap = { music_option: { options: [{ value: 'singer' }] } }
    expect(visibleQuestions(PRAISE_TEAM, singer).map((q) => q.key)).toEqual(['music_option', 'voice_role'])

    const instrumentalist: AnswerMap = { music_option: { options: [{ value: 'instrumentalist' }] } }
    expect(visibleQuestions(PRAISE_TEAM, instrumentalist).map((q) => q.key)).toEqual([
      'music_option',
      'instrument',
    ])
  })

  it('hides a grandchild when its grandparent no longer matches', () => {
    const questions = [
      ...PRAISE_TEAM,
      question({
        key: 'other_instrument',
        parentQuestionId: 'instrument',
        parentOptionValues: ['other'],
      }),
    ]
    const answers: AnswerMap = {
      music_option: { options: [{ value: 'singer' }] },
      instrument: { options: [{ value: 'other' }] },
    }
    const child = questions.find((q) => q.key === 'other_instrument')!
    expect(isQuestionVisible(child, questions, answers)).toBe(false)
  })

  it('drops answers to questions that are no longer visible', () => {
    const answers: AnswerMap = {
      music_option: { options: [{ value: 'singer' }] },
      // Left over from before the volunteer switched away from Instrumentalist.
      instrument: { options: [{ value: 'drummer' }] },
      voice_role: { options: [{ value: 'alto' }] },
    }
    expect(Object.keys(pruneHiddenAnswers(PRAISE_TEAM, answers)).sort()).toEqual([
      'music_option',
      'voice_role',
    ])
  })
})

describe('validation', () => {
  it('requires visible required questions and ignores hidden ones', () => {
    const errors = validateAnswers(PRAISE_TEAM, { music_option: { options: [{ value: 'singer' }] } })
    expect(errors).toHaveProperty('voice_role')
    expect(errors).not.toHaveProperty('instrument')
  })

  it('accepts a complete answer set', () => {
    const errors = validateAnswers(PRAISE_TEAM, {
      music_option: { options: [{ value: 'singer' }] },
      voice_role: { options: [{ value: 'alto' }] },
    })
    expect(errors).toEqual({})
  })

  it('demands free text when an "Other" option is chosen', () => {
    const answers: AnswerMap = {
      music_option: { options: [{ value: 'instrumentalist' }] },
      instrument: { options: [{ value: 'other' }] },
    }
    expect(validateAnswers(PRAISE_TEAM, answers)).toHaveProperty('instrument')

    answers.instrument = { options: [{ value: 'other', otherText: 'Cello' }] }
    expect(validateAnswers(PRAISE_TEAM, answers)).toEqual({})
  })

  it('rejects an option that does not belong to the question', () => {
    const answers: AnswerMap = { music_option: { options: [{ value: 'not_a_real_option' }] } }
    expect(validateAnswers(PRAISE_TEAM, answers)).toHaveProperty('music_option')
  })

  it('rejects multiple selections on a single-choice question', () => {
    const answers: AnswerMap = {
      music_option: { options: [{ value: 'singer' }, { value: 'instrumentalist' }] },
    }
    expect(validateAnswers(PRAISE_TEAM, answers)).toHaveProperty('music_option')
  })

  it('enforces rating bounds', () => {
    const rating = [question({ key: 'fitness', type: 'RATING', isRequired: true, ratingMin: 0, ratingMax: 5 })]
    expect(validateAnswers(rating, { fitness: { number: 7 } })).toHaveProperty('fitness')
    expect(validateAnswers(rating, { fitness: { number: -1 } })).toHaveProperty('fitness')
    expect(validateAnswers(rating, { fitness: { number: 3 } })).toEqual({})
    expect(validateAnswers(rating, { fitness: { number: 0 } })).toEqual({})
  })

  it('enforces number bounds and text length', () => {
    const questions = [
      question({ key: 'years', type: 'NUMBER', minValue: 0, maxValue: 60 }),
      question({ key: 'note', type: 'TEXTAREA', maxLength: 10 }),
    ]
    expect(validateAnswers(questions, { years: { number: 61 } })).toHaveProperty('years')
    expect(validateAnswers(questions, { note: { text: 'far too long to fit' } })).toHaveProperty('note')
  })

  it('applies a question pattern and its message', () => {
    const questions = [
      question({
        key: 'portfolio_link',
        type: 'TEXT',
        pattern: '^https?://[^\\s]+\\.[^\\s]{2,}$',
        patternMessage: 'Enter a full link',
      }),
    ]
    expect(validateAnswers(questions, { portfolio_link: { text: 'not-a-link' } })).toEqual({
      portfolio_link: 'Enter a full link',
    })
    expect(validateAnswers(questions, { portfolio_link: { text: 'https://example.com/work' } })).toEqual({})
  })

  it('does not block submission when a stored pattern is malformed', () => {
    const questions = [question({ key: 'broken', type: 'TEXT', pattern: '([unclosed' })]
    expect(validateAnswers(questions, { broken: { text: 'anything' } })).toEqual({})
  })

  it('requires a file for required file questions', () => {
    const questions = [question({ key: 'certificate', type: 'FILE', isRequired: true })]
    expect(validateAnswers(questions, {})).toHaveProperty('certificate')
    expect(validateAnswers(questions, { certificate: { documentId: 'doc_1' } })).toEqual({})
  })
})

describe('formatAnswer', () => {
  it('renders choices with their labels and "other" text', () => {
    const instrument = PRAISE_TEAM[2]!
    expect(formatAnswer(instrument, { options: [{ value: 'drummer' }] })).toBe('drummer')
    expect(formatAnswer(instrument, { options: [{ value: 'other', otherText: 'Cello' }] })).toBe('Other: Cello')
  })

  it('renders an em dash for a missing answer', () => {
    expect(formatAnswer(PRAISE_TEAM[0]!, undefined)).toBe('—')
  })
})
