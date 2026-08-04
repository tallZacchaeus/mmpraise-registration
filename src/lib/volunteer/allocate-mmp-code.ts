import 'server-only'
import { db } from '@/lib/db'
import { formatMmpCode } from './mmp-code'

/**
 * Allocate the next MMP number.
 *
 * A Postgres sequence rather than `MAX(mmpCode) + 1`: `nextval` is atomic and
 * never hands the same value to two concurrent sign-ups, which a read-then-
 * write would do the first time two people registered in the same second.
 *
 * The sequence was seeded at 2214059 — one past the highest legacy code
 * (MMP2214058) — so migrated volunteers keep the number they already have and
 * new ones continue the same series. There is no per-year reset: five years of
 * legacy data show every year drawing from one global range.
 *
 * Gaps are expected and harmless. A sequence advances even when the transaction
 * that consumed it rolls back, so an abandoned sign-up burns a number. The
 * legacy data has 73 such gaps in 14,046; nothing depends on the series being
 * contiguous.
 */
export async function nextMmpCode(): Promise<string> {
  const rows = await db.$queryRaw<{ nextval: bigint }[]>`SELECT nextval('mmp_code_seq')`
  const value = rows[0]?.nextval
  if (value === undefined) throw new Error('Could not allocate an MMP number')
  return formatMmpCode(value)
}
