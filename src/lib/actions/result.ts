import { z } from 'zod'

/**
 * Uniform Server Action return shape.
 *
 * Actions never throw for expected failures — they return a typed result so the
 * client can render field-level errors without a try/catch, and so an unexpected
 * exception (a real bug) stays distinguishable from a validation failure.
 */
export type FieldErrors = Record<string, string>

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: FieldErrors; code?: string }

export function ok(): ActionResult<undefined>
export function ok<T>(data: T): ActionResult<T>
export function ok<T>(data?: T): ActionResult<T | undefined> {
  return { ok: true, data }
}

export function fail(error: string, fieldErrors?: FieldErrors, code?: string): ActionResult<never> {
  return { ok: false, error, fieldErrors, code }
}

/** Flatten a ZodError into a field -> first message map. */
export function zodFieldErrors(error: z.ZodError): FieldErrors {
  const fields: FieldErrors = {}
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_form'
    if (!fields[key]) fields[key] = issue.message
  }
  return fields
}

/** Validate input, returning a ready-made failure result on error. */
export function parseOrFail<S extends z.ZodType>(
  schema: S,
  input: unknown,
): { ok: true; data: z.infer<S> } | { ok: false; result: ActionResult<never> } {
  const parsed = schema.safeParse(input)
  if (parsed.success) return { ok: true, data: parsed.data }
  return {
    ok: false,
    result: fail('Please correct the highlighted fields', zodFieldErrors(parsed.error), 'validation_error'),
  }
}
