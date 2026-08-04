# Legacy department mapping — draft for confirmation

The 2022–2026 export uses **15** department names; the platform has **10**.
This table is the proposed translation, applied when the legacy file is
imported. It needs one thing from the organisation: **confirm or correct each
row.** Nothing is imported against it until it is signed off.

Two properties hold however the decisions land:

- **The legacy name always survives.** It is stored verbatim on the
  participation record (`previousDepartment`), so the mapping only decides
  which *current* team a person is associated with — it never rewrites history.
- **An unmapped name blocks nothing.** A row whose department is not in this
  table imports with the legacy text kept and no current department attached,
  flagged for a human, rather than being guessed.

## Proposed mapping

| # | Legacy name (rows) | → Current department | Confidence — reasoning |
|---|---|---|---|
| 1 | Volunteers Praise Team (4,902) | **Volunteers Praise Team** | Exact match |
| 2 | Welfare (3,238) | **Welfare** | Exact match |
| 3 | Soteria (1,859) | **Soteria** | Exact match |
| 4 | Sanitation (1,164) | **Sanitation** | Exact match |
| 5 | Medical (535) | **Medical** | Exact match |
| 6 | Logistics (473) | **Logistics** | Exact match |
| 7 | Security/Protocol (343) | **Security** | High — same function, older compound name |
| 8 | Security (281) | **Security** | Exact match |
| 9 | Registration Team (271) | **Registration Team** | Exact match |
| 10 | Media (234) | **Media** | Exact match |
| 11 | Ushering (191) | **Ushering** | Exact match |
| 12 | Accommodation Logistics (173) | **Logistics** | Medium — treated as a Logistics specialism. **Alternative:** if accommodation becomes its own team for 2027 (Phase 4 decision), map there instead |
| 13 | Registration Unit (123) | **Registration Team** | High — same function, older name |
| 14 | Transportation Logistics (108) | **Logistics** | High — a Logistics specialism |
| 15 | Medical Officer (78) | **Medical** | High — the officer role within the same team |

Ten of the fifteen are exact matches, so the decisions that actually need a
human are **#7, #12, #13, #14 and #15** — five rows.

## Questions for the organisation

1. **#12 Accommodation Logistics** is the only genuinely uncertain row. If
   accommodation is managed as its own function in 2027, these 173 people are
   its natural veterans and should map there, not to Logistics.
2. Was **Security/Protocol** (#7) ever a distinct team from Security — for
   example protocol/VIP handling — that should be recorded differently?
3. Is **Medical Officer** (#15) a qualification distinction worth keeping? The
   legacy string is preserved either way; this only affects which team the 78
   people are associated with.

## What happens on import

For each row, the legacy department string is looked up in this table
(case-insensitively, trimmed). Matched → the participation records both the
legacy text and the current department id. Unmatched → legacy text only, and
the validation report counts it so the gap is visible before anything runs.
