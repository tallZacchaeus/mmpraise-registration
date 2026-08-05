# Legacy department mapping — **CONFIRMED 2026-08-05**

The 2022–2026 export uses **15** department names. Decision from the
organisation: **every legacy name continues as a team of its own** — nothing is
folded into a broader department. The single exception is
**Security/Protocol → Protocol**: protocol (VIP reception and hosting) was
never the same job as security, and the compound name was the old system's
limitation, not the organisation's structure.

The platform therefore now carries **15 departments** — the original ten plus
Protocol, Accommodation Logistics, Transportation Logistics, Registration Unit
and Medical Officer (seeded in `prisma/seed-data/departments.ts`, mapping in
`src/lib/migration/department-map.ts`, tests in
`tests/unit/department-map.test.ts`).

Two properties still hold:

- **The legacy name always survives.** It is stored verbatim on the
  participation record (`previousDepartment`); the mapping only decides which
  current team a person is associated with.
- **An unmapped name blocks nothing.** A row whose department is unknown
  imports with the legacy text kept and no current department attached,
  flagged for a human, rather than being guessed.

## Confirmed mapping

| # | Legacy name (rows) | → Current department |
|---|---|---|
| 1 | Volunteers Praise Team (4,902) | Volunteers Praise Team |
| 2 | Welfare (3,238) | Welfare |
| 3 | Soteria (1,859) | Soteria |
| 4 | Sanitation (1,164) | Sanitation |
| 5 | Medical (535) | Medical |
| 6 | Logistics (473) | Logistics |
| 7 | Security/Protocol (343) | **Protocol** — VIP handling, distinct from Security |
| 8 | Security (281) | Security |
| 9 | Registration Team (271) | Registration Team |
| 10 | Media (234) | Media |
| 11 | Ushering (191) | Ushering |
| 12 | Accommodation Logistics (173) | Accommodation Logistics *(new team)* |
| 13 | Registration Unit (123) | Registration Unit *(new team)* |
| 14 | Transportation Logistics (108) | Transportation Logistics *(new team)* |
| 15 | Medical Officer (78) | Medical Officer *(new team)* |

## Notes for operating this

- The five new teams are seeded **open for applications** with no question
  sets. Close any that should not accept 2027 volunteers from
  **Admin → Departments** (one click), and give them questions there — the
  questions screen can copy another department's set as a starting point.
- Matching is case-insensitive and whitespace-tolerant. An unknown legacy
  string imports with the text preserved and is counted in the validation
  report, so gaps are visible before anything runs.
