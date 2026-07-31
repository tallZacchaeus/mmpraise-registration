'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/lib/db'
import { audit } from '@/lib/audit'
import { requirePermission } from '@/lib/auth/rbac'
import { fail, ok, parseOrFail, type ActionResult } from '@/lib/actions/result'
import { trimmedText } from '@/lib/validation/common'
import type { QuestionType, Role } from '@/generated/prisma/enums'

/**
 * Management of reference data, department questions and administrator roles.
 *
 * These actions are what make the system extensible without a deployment: a
 * Registration Administrator can add a department question, a new RCCG province
 * or a new parish, and the wizard picks it up on the next request.
 */

// --- Department questions -------------------------------------------------

const QUESTION_TYPES = [
  'TEXT',
  'TEXTAREA',
  'EMAIL',
  'TEL',
  'NUMBER',
  'DATE',
  'RADIO',
  'CHECKBOX',
  'SELECT',
  'MULTISELECT',
  'FILE',
  'RATING',
] as const

const questionSchema = z.object({
  id: z.string().optional(),
  departmentId: z.string().min(1),
  key: z
    .string()
    .transform((v) => v.trim().toLowerCase().replace(/\s+/g, '_'))
    .pipe(z.string().regex(/^[a-z][a-z0-9_]{1,50}$/, 'Use lowercase letters, numbers and underscores')),
  label: trimmedText(200).pipe(z.string().min(3, 'Write the question')),
  helpText: z.string().max(300).optional().nullable(),
  type: z.enum(QUESTION_TYPES),
  isRequired: z.boolean().default(false),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).default(0),
  maxLength: z.number().int().positive().nullable().optional(),
  minValue: z.number().int().nullable().optional(),
  maxValue: z.number().int().nullable().optional(),
  ratingMin: z.number().int().nullable().optional(),
  ratingMax: z.number().int().nullable().optional(),
  placeholder: z.string().max(120).optional().nullable(),
  pattern: z.string().max(300).optional().nullable(),
  patternMessage: z.string().max(200).optional().nullable(),
  parentQuestionId: z.string().nullable().optional(),
  parentOptionValues: z.array(z.string()).default([]),
  /** Newline-separated "value|Label" pairs, or plain labels. */
  optionsText: z.string().max(4000).optional().nullable(),
})

const CHOICE_TYPES: QuestionType[] = ['RADIO', 'CHECKBOX', 'SELECT', 'MULTISELECT']

function parseOptions(text: string | null | undefined) {
  if (!text) return []
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const [rawValue, rawLabel] = line.includes('|') ? line.split('|') : [line, line]
      const value = rawValue!.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
      const label = (rawLabel ?? rawValue)!.trim()
      return { value: value || `option_${index + 1}`, label, requiresText: /other/i.test(label), sortOrder: index }
    })
}

export async function saveQuestionAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requirePermission('question:manage')
  const parsed = parseOrFail(questionSchema, input)
  if (!parsed.ok) return parsed.result
  const data = parsed.data

  if (CHOICE_TYPES.includes(data.type as QuestionType)) {
    const options = parseOptions(data.optionsText)
    if (options.length < 2) {
      return fail('Choice questions need at least two options', {
        optionsText: 'Enter at least two options, one per line',
      })
    }
  }

  // A question cannot depend on itself, and its parent must be in the same department.
  if (data.parentQuestionId) {
    if (data.parentQuestionId === data.id) {
      return fail('A question cannot depend on itself', { parentQuestionId: 'Choose a different question' })
    }
    const parent = await db.departmentQuestion.findFirst({
      where: { id: data.parentQuestionId, departmentId: data.departmentId },
      select: { id: true, parentQuestionId: true },
    })
    if (!parent) {
      return fail('Choose a parent question from the same department', {
        parentQuestionId: 'That question belongs to another department',
      })
    }
    if (parent.parentQuestionId === data.id) {
      return fail('That would create a circular dependency', { parentQuestionId: 'Choose a different question' })
    }
  }

  const payload = {
    departmentId: data.departmentId,
    key: data.key,
    label: data.label,
    helpText: data.helpText || null,
    type: data.type as QuestionType,
    isRequired: data.isRequired,
    isActive: data.isActive,
    sortOrder: data.sortOrder,
    maxLength: data.maxLength ?? null,
    minValue: data.minValue ?? null,
    maxValue: data.maxValue ?? null,
    ratingMin: data.type === 'RATING' ? (data.ratingMin ?? 0) : null,
    ratingMax: data.type === 'RATING' ? (data.ratingMax ?? 5) : null,
    placeholder: data.placeholder || null,
    pattern: data.pattern || null,
    patternMessage: data.patternMessage || null,
    parentQuestionId: data.parentQuestionId || null,
    parentOptionValues: data.parentOptionValues,
  }

  const existingByKey = await db.departmentQuestion.findUnique({
    where: { departmentId_key: { departmentId: data.departmentId, key: data.key } },
    select: { id: true },
  })
  if (existingByKey && existingByKey.id !== data.id) {
    return fail('That key is already used in this department', { key: 'Choose a different key' })
  }

  const question = data.id
    ? await db.departmentQuestion.update({ where: { id: data.id }, data: payload })
    : await db.departmentQuestion.create({ data: payload })

  if (CHOICE_TYPES.includes(data.type as QuestionType)) {
    const options = parseOptions(data.optionsText)
    const keep = new Set(options.map((o) => o.value))

    // Options that have already been answered are deactivated rather than
    // deleted, so historic answers keep their labels.
    await db.questionOption.updateMany({
      where: { questionId: question.id, value: { notIn: [...keep] } },
      data: { isActive: false },
    })

    for (const option of options) {
      await db.questionOption.upsert({
        where: { questionId_value: { questionId: question.id, value: option.value } },
        update: { label: option.label, requiresText: option.requiresText, sortOrder: option.sortOrder, isActive: true },
        create: { questionId: question.id, ...option },
      })
    }
  }

  await audit({
    action: 'question.updated',
    entityType: 'DepartmentQuestion',
    entityId: question.id,
    actorId: user.id,
    metadata: { key: data.key, created: !data.id },
  })

  revalidatePath(`/admin/departments/${data.departmentId}/questions`)
  return ok({ id: question.id })
}

export async function deleteQuestionAction(id: string): Promise<ActionResult> {
  const user = await requirePermission('question:manage')

  const question = await db.departmentQuestion.findUnique({
    where: { id },
    select: { id: true, departmentId: true, key: true, _count: { select: { answers: true, children: true } } },
  })
  if (!question) return fail('Question not found')

  if (question._count.children > 0) {
    return fail('Other questions depend on this one. Remove those conditions first.')
  }

  // Answered questions are retired, never deleted — deleting would destroy the
  // answers volunteers have already given.
  if (question._count.answers > 0) {
    await db.departmentQuestion.update({ where: { id }, data: { isActive: false } })
    await audit({
      action: 'question.updated',
      entityType: 'DepartmentQuestion',
      entityId: id,
      actorId: user.id,
      metadata: { retired: true, reason: 'has answers' },
    })
    revalidatePath(`/admin/departments/${question.departmentId}/questions`)
    return ok()
  }

  await db.departmentQuestion.delete({ where: { id } })
  await audit({
    action: 'question.updated',
    entityType: 'DepartmentQuestion',
    entityId: id,
    actorId: user.id,
    metadata: { deleted: true, key: question.key },
  })
  revalidatePath(`/admin/departments/${question.departmentId}/questions`)
  return ok()
}

// --- Reference data -------------------------------------------------------

const referenceSchema = z.object({
  kind: z.enum(['region', 'province', 'parish']),
  id: z.string().optional(),
  name: trimmedText(120).pipe(z.string().min(2, 'Enter a name')),
  parentId: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
})

export async function saveReferenceAction(input: unknown): Promise<ActionResult> {
  const user = await requirePermission('reference:manage')
  const parsed = parseOrFail(referenceSchema, input)
  if (!parsed.ok) return parsed.result
  const { kind, id, name, parentId, isActive } = parsed.data

  if (kind === 'region') {
    if (id) await db.churchRegion.update({ where: { id }, data: { name, isActive } })
    else await db.churchRegion.create({ data: { name, isActive } })
  } else if (kind === 'province') {
    if (!parentId) return fail('Choose a region', { parentId: 'Choose the region this province belongs to' })
    if (id) await db.churchProvince.update({ where: { id }, data: { name, isActive, regionId: parentId } })
    else await db.churchProvince.create({ data: { name, isActive, regionId: parentId } })
  } else {
    if (!parentId) return fail('Choose a province', { parentId: 'Choose the province this parish belongs to' })
    if (id) await db.parish.update({ where: { id }, data: { name, isActive, provinceId: parentId } })
    else await db.parish.create({ data: { name, isActive, provinceId: parentId } })
  }

  await audit({
    action: 'reference.updated',
    entityType: kind,
    entityId: id ?? null,
    actorId: user.id,
    metadata: { name, created: !id },
  })

  revalidatePath('/admin/reference')
  return ok()
}

export async function deactivateReferenceAction(kind: 'region' | 'province' | 'parish', id: string): Promise<ActionResult> {
  const user = await requirePermission('reference:manage')

  // Records are deactivated rather than deleted so existing profiles that point
  // at them keep working.
  if (kind === 'region') await db.churchRegion.update({ where: { id }, data: { isActive: false } })
  else if (kind === 'province') await db.churchProvince.update({ where: { id }, data: { isActive: false } })
  else await db.parish.update({ where: { id }, data: { isActive: false } })

  await audit({ action: 'reference.updated', entityType: kind, entityId: id, actorId: user.id, metadata: { deactivated: true } })
  revalidatePath('/admin/reference')
  return ok()
}

// --- Administrator roles --------------------------------------------------

const ASSIGNABLE_ROLES = [
  'REGISTRATION_ADMIN',
  'DEPARTMENT_HEAD',
  'REVIEWER',
  'MEDICAL_INFO_OFFICER',
  'COMMUNICATION_OFFICER',
  'SUPER_ADMIN',
] as const

const roleSchema = z.object({
  email: z.string().email(),
  roles: z.array(z.enum(ASSIGNABLE_ROLES)).default([]),
  departmentIds: z.array(z.string()).default([]),
})

export async function updateUserRolesAction(input: unknown): Promise<ActionResult> {
  const actor = await requirePermission('user:manage')
  const parsed = parseOrFail(roleSchema, input)
  if (!parsed.ok) return parsed.result
  const { email, roles, departmentIds } = parsed.data

  const target = await db.user.findUnique({
    where: { email: email.toLowerCase() },
    select: { id: true, roles: true },
  })
  if (!target) return fail('No account with that email address', { email: 'No account with that email address' })

  // Guard against removing the last super administrator and locking everyone out.
  const wasSuper = target.roles.some((r) => r.role === 'SUPER_ADMIN')
  if (wasSuper && !roles.includes('SUPER_ADMIN')) {
    const superCount = await db.userRole.count({ where: { role: 'SUPER_ADMIN' } })
    if (superCount <= 1) return fail('You cannot remove the last Super Administrator')
  }

  await db.$transaction(async (tx) => {
    // VOLUNTEER is always retained: administrators can register too.
    await tx.userRole.deleteMany({ where: { userId: target.id, role: { not: 'VOLUNTEER' } } })
    for (const role of roles) {
      await tx.userRole.create({ data: { userId: target.id, role: role as Role } })
    }

    await tx.userDepartmentScope.deleteMany({ where: { userId: target.id } })
    if (roles.includes('DEPARTMENT_HEAD')) {
      for (const departmentId of departmentIds) {
        await tx.userDepartmentScope.create({ data: { userId: target.id, departmentId } })
      }
    }
  })

  await audit({
    action: 'user.role_changed',
    entityType: 'User',
    entityId: target.id,
    actorId: actor.id,
    metadata: { roles, departmentIds },
  })

  revalidatePath('/admin/users')
  return ok()
}
