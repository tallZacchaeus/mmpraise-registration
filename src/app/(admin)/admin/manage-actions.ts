'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/lib/db'
import { audit } from '@/lib/audit'
import { PERMISSIONS, requirePermission } from '@/lib/auth/rbac'
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

/**
 * Move one question up or down among its siblings.
 *
 * Positions are rewritten for the whole department in one transaction rather
 * than swapping two rows: legacy sets have duplicate and gapped `sortOrder`
 * values, and a swap between two questions that both say `0` moves nothing.
 * Renumbering makes the order the list shows and the order the wizard renders
 * the same thing, permanently.
 */
export async function reorderQuestionAction(
  id: string,
  direction: 'up' | 'down',
): Promise<ActionResult> {
  const user = await requirePermission('question:manage')

  const question = await db.departmentQuestion.findUnique({
    where: { id },
    select: { id: true, departmentId: true },
  })
  if (!question) return fail('Question not found')

  const siblings = await db.departmentQuestion.findMany({
    where: { departmentId: question.departmentId, isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    select: { id: true },
  })

  const index = siblings.findIndex((sibling) => sibling.id === id)
  const target = direction === 'up' ? index - 1 : index + 1
  if (index === -1 || target < 0 || target >= siblings.length) {
    return fail(direction === 'up' ? 'Already first' : 'Already last')
  }

  const reordered = [...siblings]
  const [moved] = reordered.splice(index, 1)
  reordered.splice(target, 0, moved!)

  await db.$transaction(
    reordered.map((sibling, position) =>
      db.departmentQuestion.update({ where: { id: sibling.id }, data: { sortOrder: position } }),
    ),
  )

  await audit({
    action: 'question.updated',
    entityType: 'DepartmentQuestion',
    entityId: id,
    actorId: user.id,
    metadata: { reordered: direction, position: target },
  })
  revalidatePath(`/admin/departments/${question.departmentId}/questions`)
  return ok()
}

/**
 * Retire a question, or bring a retired one back.
 *
 * Retiring is the only way an answered question ever leaves the form, so the
 * way back has to exist too — otherwise a mis-click permanently removes a
 * question nobody can restore without SQL.
 */
export async function setQuestionActiveAction(id: string, isActive: boolean): Promise<ActionResult> {
  const user = await requirePermission('question:manage')

  const question = await db.departmentQuestion.findUnique({
    where: { id },
    select: { id: true, departmentId: true, parentQuestionId: true },
  })
  if (!question) return fail('Question not found')

  // A conditional question cannot come back before the question it depends on.
  if (isActive && question.parentQuestionId) {
    const parent = await db.departmentQuestion.findUnique({
      where: { id: question.parentQuestionId },
      select: { isActive: true },
    })
    if (!parent?.isActive) {
      return fail('Restore the question this one depends on first')
    }
  }

  await db.departmentQuestion.update({ where: { id }, data: { isActive } })
  await audit({
    action: 'question.updated',
    entityType: 'DepartmentQuestion',
    entityId: id,
    actorId: user.id,
    metadata: { retired: !isActive, restored: isActive },
  })
  revalidatePath(`/admin/departments/${question.departmentId}/questions`)
  return ok()
}

/**
 * Copy another department's active questions into this one.
 *
 * Keys already present here are skipped rather than overwritten — the copy is
 * additive, so running it twice cannot duplicate or clobber anything. Copied
 * questions arrive **retired**, so a half-copied set never reaches a volunteer
 * mid-copy; the administrator restores the ones they want.
 *
 * Conditional links are rewritten to point at the copies. A question whose
 * parent was skipped loses its condition rather than pointing across
 * departments, which the wizard could never evaluate.
 */
export async function copyQuestionsAction(
  fromDepartmentId: string,
  toDepartmentId: string,
): Promise<ActionResult<{ copied: number; skipped: number }>> {
  const user = await requirePermission('question:manage')
  if (fromDepartmentId === toDepartmentId) return fail('Choose a different department')

  const [source, existing] = await Promise.all([
    db.departmentQuestion.findMany({
      where: { departmentId: fromDepartmentId, isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      include: { options: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } } },
    }),
    db.departmentQuestion.findMany({
      where: { departmentId: toDepartmentId },
      select: { key: true, sortOrder: true },
    }),
  ])
  if (source.length === 0) return fail('That department has no questions to copy')

  const taken = new Set(existing.map((question) => question.key))
  const toCopy = source.filter((question) => !taken.has(question.key))
  if (toCopy.length === 0) {
    return fail('Every question from that department is already here')
  }

  let nextOrder = existing.reduce((max, question) => Math.max(max, question.sortOrder + 1), 0)
  // Old id → new id, so conditions can be rewritten to the copies.
  const idMap = new Map<string, string>()

  await db.$transaction(async (tx) => {
    for (const question of toCopy) {
      const created = await tx.departmentQuestion.create({
        data: {
          departmentId: toDepartmentId,
          key: question.key,
          label: question.label,
          helpText: question.helpText,
          type: question.type,
          isRequired: question.isRequired,
          // Arrives retired — see the note above.
          isActive: false,
          sortOrder: nextOrder++,
          maxLength: question.maxLength,
          minValue: question.minValue,
          maxValue: question.maxValue,
          ratingMin: question.ratingMin,
          ratingMax: question.ratingMax,
          allowedMimeTypes: question.allowedMimeTypes,
          maxFileSizeKb: question.maxFileSizeKb,
          placeholder: question.placeholder,
          pattern: question.pattern,
          patternMessage: question.patternMessage,
          parentOptionValues: question.parentOptionValues,
          options: {
            create: question.options.map((option) => ({
              value: option.value,
              label: option.label,
              requiresText: option.requiresText,
              sortOrder: option.sortOrder,
            })),
          },
        },
      })
      idMap.set(question.id, created.id)
    }

    for (const question of toCopy) {
      if (!question.parentQuestionId) continue
      const newId = idMap.get(question.id)!
      const newParentId = idMap.get(question.parentQuestionId)
      await tx.departmentQuestion.update({
        where: { id: newId },
        data: newParentId
          ? { parentQuestionId: newParentId }
          : { parentQuestionId: null, parentOptionValues: [] },
      })
    }
  })

  await audit({
    action: 'question.updated',
    entityType: 'Department',
    entityId: toDepartmentId,
    actorId: user.id,
    metadata: { copiedFrom: fromDepartmentId, copied: toCopy.length, skipped: source.length - toCopy.length },
  })
  revalidatePath(`/admin/departments/${toDepartmentId}/questions`)
  return ok({ copied: toCopy.length, skipped: source.length - toCopy.length })
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

  /*
   * Nobody demotes themselves out of the super-admin role.
   *
   * The global "last super administrator" guard above stops the organisation
   * being locked out; this stops the commoner accident, where the one person
   * who can restore a role removes it from themselves and then cannot.
   * Another super administrator can still do it.
   */
  if (actor.id === target.id && wasSuper && !roles.includes('SUPER_ADMIN')) {
    return fail('You cannot remove your own Super Administrator role — ask another one to do it')
  }

  const before = new Set<string>(
    target.roles.map((r) => r.role).filter((r) => r !== 'VOLUNTEER'),
  )
  const after = new Set<string>(roles)

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

    /*
     * One history row per role actually gained or lost.
     *
     * The table existed and nothing wrote to it, so "who made this person a
     * reviewer, and when?" had no answer. Recording the delta rather than the
     * whole set keeps the timeline readable a year later.
     */
    for (const role of after) {
      if (!before.has(role)) {
        await tx.roleAssignmentHistory.create({
          data: { userId: target.id, change: 'GRANTED', subject: role, actorId: actor.id },
        })
      }
    }
    for (const role of before) {
      if (!after.has(role)) {
        await tx.roleAssignmentHistory.create({
          data: { userId: target.id, change: 'REVOKED', subject: role, actorId: actor.id },
        })
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
  revalidatePath(`/admin/users/${target.id}`)
  return ok()
}

// --- Per-administrator permissions ---------------------------------------

const permissionGrantSchema = z.object({
  userId: z.string().min(1),
  permission: z.string().min(1),
  /** `default` deletes the override and lets the role decide again. */
  state: z.enum(['grant', 'revoke', 'default']),
  reason: z.string().max(300).optional().nullable(),
})

/**
 * Add or withdraw one permission for one administrator.
 *
 * This is what the `AdminPermissionGrant` table was built for and what,
 * without an interface, had to be done in SQL: give one reviewer the export
 * permission without inventing an "exporting reviewer" role that exists for a
 * single person and is never maintained afterwards.
 */
export async function setAdminPermissionAction(input: unknown): Promise<ActionResult> {
  const actor = await requirePermission('user:manage')
  const parsed = parseOrFail(permissionGrantSchema, input)
  if (!parsed.ok) return parsed.result
  const { userId, permission, state, reason } = parsed.data

  if (!(PERMISSIONS as readonly string[]).includes(permission)) {
    return fail('That is not a permission this system knows about')
  }

  const target = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, roles: { select: { role: true } } },
  })
  if (!target) return fail('Account not found')

  /*
   * Self-service permission changes are refused outright. An administrator who
   * can widen their own permissions has, in effect, all of them.
   */
  if (actor.id === userId) {
    return fail('You cannot change your own permissions — ask another administrator')
  }

  if (state === 'default') {
    await db.adminPermissionGrant.deleteMany({ where: { userId, permission } })
  } else {
    const granted = state === 'grant'
    await db.adminPermissionGrant.upsert({
      where: { userId_permission: { userId, permission } },
      update: { granted, reason: reason || null, grantedById: actor.id },
      create: { userId, permission, granted, reason: reason || null, grantedById: actor.id },
    })
  }

  await db.roleAssignmentHistory.create({
    data: {
      userId,
      change: state === 'revoke' ? 'REVOKED' : 'GRANTED',
      subject: permission,
      reason: state === 'default' ? 'Reset to the role default' : reason || null,
      actorId: actor.id,
    },
  })
  await audit({
    action: 'user.role_changed',
    entityType: 'User',
    entityId: userId,
    actorId: actor.id,
    metadata: { permission, state },
  })

  revalidatePath(`/admin/users/${userId}`)
  return ok()
}

const adminAccessSchema = z.object({
  userId: z.string().min(1),
  action: z.enum(['suspend', 'lift', 'disable', 'enable']),
  /** `datetime-local`, required when suspending. */
  until: z.string().optional().nullable(),
  reason: z.string().max(300).optional().nullable(),
})

/**
 * Withdraw or restore administrative access.
 *
 * Suspension lapses on its own, which is what makes it usable for temporary
 * cover — a fortnight's leave needs no diary note to undo. Disabling does not
 * lapse. Neither touches the volunteer side of the account: a suspended
 * administrator keeps their own application and dashboard.
 */
export async function setAdminAccessAction(input: unknown): Promise<ActionResult> {
  const actor = await requirePermission('user:manage')
  const parsed = parseOrFail(adminAccessSchema, input)
  if (!parsed.ok) return parsed.result
  const { userId, action, until, reason } = parsed.data

  if (actor.id === userId) {
    return fail('You cannot suspend or disable your own administrative access')
  }

  const target = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, roles: { select: { role: true } } },
  })
  if (!target) return fail('Account not found')

  // Removing the last usable super administrator locks everyone out, whether
  // it is done by taking the role away or by suspending the person holding it.
  const isSuper = target.roles.some((r) => r.role === 'SUPER_ADMIN')
  if (isSuper && (action === 'suspend' || action === 'disable')) {
    const usable = await db.user.count({
      where: {
        roles: { some: { role: 'SUPER_ADMIN' } },
        adminDisabledAt: null,
        OR: [{ adminSuspendedUntil: null }, { adminSuspendedUntil: { lte: new Date() } }],
        id: { not: userId },
      },
    })
    if (usable === 0) {
      return fail('That would leave nobody with Super Administrator access')
    }
  }

  let data: { adminSuspendedUntil?: Date | null; adminDisabledAt?: Date | null }
  if (action === 'suspend') {
    if (!until) return fail('Choose the date the suspension should end')
    const date = new Date(until)
    if (Number.isNaN(date.getTime())) return fail('That date could not be read')
    if (date.getTime() <= Date.now()) return fail('Choose a date in the future')
    data = { adminSuspendedUntil: date }
  } else if (action === 'lift') {
    data = { adminSuspendedUntil: null }
  } else if (action === 'disable') {
    data = { adminDisabledAt: new Date() }
  } else {
    data = { adminDisabledAt: null, adminSuspendedUntil: null }
  }

  await db.user.update({ where: { id: userId }, data })
  await db.roleAssignmentHistory.create({
    data: {
      userId,
      change: action === 'suspend' || action === 'disable' ? 'REVOKED' : 'GRANTED',
      subject:
        action === 'suspend'
          ? `Administrative access suspended until ${until}`
          : action === 'disable'
            ? 'Administrative access disabled'
            : action === 'lift'
              ? 'Suspension lifted'
              : 'Administrative access restored',
      reason: reason || null,
      actorId: actor.id,
    },
  })
  await audit({
    action: 'user.role_changed',
    entityType: 'User',
    entityId: userId,
    actorId: actor.id,
    metadata: { access: action, until: until ?? null },
  })

  revalidatePath('/admin/users')
  revalidatePath(`/admin/users/${userId}`)
  return ok()
}
