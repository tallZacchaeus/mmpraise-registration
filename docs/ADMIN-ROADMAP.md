# Admin platform — remaining phases

Working document for the upgrade specified in `MMPRAISE_ADMIN_AUDIT_README.md`
and `MMPRAISE_ADMIN_MASTER_CLAUDE_PROMPT.md`. Each phase is sized to be picked
up on its own, in roughly this order.

**How to read a phase.** *Current state* is what exists today, verified against
the code — not what the audit assumed. *Scope* is what to build. *Done when* is
the acceptance test. *Blocked on* names the organisational decisions that must
be settled first; a phase with an unanswered blocker stalls halfway through.

Shared rules that apply to every phase are at the bottom. Read them once.

---

## Completed

| | Delivered |
|---|---|
| **Volunteer dashboard** | Nine-stage journey, lifecycle-aware hero, notifications derived from real timestamps, announcements, FAQs, resources, accommodation notice. |
| **Admin shell** | Grouped navigation (Overview / Applications / People / Communications / Content / Configuration / Activity and security). Reference Data removed from the top level; Previous participants in its place. |
| **Permissions foundation** | `AdminPermissionGrant` overrides that grant *and* revoke, `RoleAssignmentHistory`, admin disable/suspend with automatic lapse, enforced at the `can()` gate. |
| **Previous participants** | Upload → map → validate → confirm → import → invite, with dry-run validation, idempotency, failed-row reports, invitation and activation tracking. |
| **Announcement lifecycle schema** | Status, priority, scheduling, expiry, channels, revisions, delivery statistics. **Schema only — no UI** (Phase 6). |
| **Registration IDs** | New per-edition identifiers use the *edition* year, not today's. Historical IDs untouched. |
| **Phase 2 — import fields** | All 20 export columns mappable and auto-guessed; legacy MMP numbers and usernames honoured with safe fallbacks; age/gender/denomination translated; per-row editions; dry run of the real file: 0 errors, 12 expected warnings. |
| **Phase 7 — Applicants (first slice)** | Bulk approval: "Approve all N" scoped to the current filters, dialog restating the count, server re-count contract (refuses if the queue changed), only SUBMITTED/UNDER_REVIEW ever touched, capped at 500 per run, one status-history row and one audit record per volunteer. Export now pauses behind a dialog naming the row count and the audit trail. List gains review ageing (amber past 7 days), note counts, MMP-number column and MMP-number search. Two rendering bugs found and fixed while verifying on mobile: the dialog entry animation double-applied its centring translation, and dialog auto-focus landed in the optional note field, displacing the dialog on phones. Remaining for later slices: reviewer assignment (blocked on the advisory/exclusive decision), saved views, column visibility, detail drawer, the generic data table (extract when Phase 8 becomes its second consumer), and one tracked investigation — an intermittent mobile-emulation zoom-out on the single-row filtered page (bulk-approve e2e is skipped on the phone project only until resolved). |
| **Phase 6 — Overview command centre** | Needs-attention queue (non-empty queues only, severity-ordered, each a link), event bar with the shared countdown at operational size, the two lifecycles reported separately (registrations vs edition participation, including "not yet confirmed"), migration and communications sections permission-gated in the query layer, weekly submission trend, distributions, humanised recent activity with routine sign-ins excluded, quick actions. 7/7 e2e including axe and 320–1920px. |
| **Phase 2 — import fields** | All 20 export columns mappable and auto-detected; enum translation (age band, gender, denomination) verified 13,969/13,969 on the real file; legacy usernames preserved with collision fallback; legacy MMP numbers preserved (verified 13,969 parsed, 0 duplicates) with the number doubling as the previous registration id; per-row edition so one upload covers 2022–2026. |
| **Phase 1c — the wizard split** | Returning volunteers confirm an edition at `/participate`: one page — department (previous one preselected), department questions, dates, shift periods, overnight, and this edition's consents. `/apply` routes registered volunteers there automatically; the dashboard hero takes over with a single "Confirm your availability" action until it is done. The eight-step wizard now runs once, at first registration only. |
| **Phase 1b — registration/participation split** | `VolunteerApplication` is now unique per person and holds what never changes (profile links, motivation, emergency contact, approval). New `EditionParticipation` keyed `(applicationId, edition)` holds department, availability, department answers, consents, per-edition status and shift assignments. All 1,478 existing applications carried into 2027 participations with zero orphans; serving statuses moved to the participation and the application left at APPROVED. Department capacity enforcement removed (Phase 0 folded in). Wizard split — 1c — still to come: a returning volunteer still walks the full form today. |
| **Phase 1a — the MMP number** | `User.mmpCode` unique, `mmp_code_seq` seeded at 2214059, allocated at account creation and on migration import, all 1,392 existing accounts backfilled. Login accepts email, username or MMP number. The number is shown on the dashboard, the summary and the submission confirmation; the per-edition reference is no longer shown to volunteers. |

---

# Part A — The volunteer model and the legacy migration

Part A has to happen before the 2027 edition opens. Phase 1 is the foundation
everything else in this part rests on.

## The finding that reshaped this section

The platform was built assuming a volunteer submits a **fresh eight-step
application every edition**. That is not how MMPraise works.

**A volunteer registers once.** Each edition they return to mark their
availability — they do not re-enter their name, address, occupation, church and
motivation to say "yes, I am free in March".

The legacy data confirms it. Of the 2,612 MMP Codes issued in the 2022 era,
1,026 now carry a participation Year of 2023–2026: the code was issued once and
followed the person across four editions. No one in 13,973 rows holds two codes.

### What this means for the identifiers

There is **one** identifier, not two. The MMP Code *is* the registration
number. The per-edition `MMP-2027-000123` registration ID currently issued at
submission is modelling an event that does not occur, and should not be
surfaced to volunteers at all.

### Where the line falls

| Once, at registration | Every edition |
|---|---|
| Personal · Location · Professional · Church · Motivation | **Availability** |
| Emergency contact · health information | **Department** (may change) |
| Approval — **granted once, not re-run** | **Consents** — re-taken each time |
| → issues the permanent **MMP Code** | → an **edition participation** record |

The existing nine-value `ApplicationStatus` enum already splits along this line,
which is good evidence the model is right:

```
DRAFT · SUBMITTED · UNDER_REVIEW   → registration progress  (once)
APPROVED · WAITLISTED · REJECTED   → volunteer standing     (once)
ASSIGNED · CHECKED_IN · COMPLETED  → edition participation  (each time)
```

**The migration module already works this way.** It creates a user plus a
`PreviousEditionParticipation` and deliberately never creates an application —
there is a test asserting exactly that. Previous editions are already modelled
correctly; the work is to make the *current* edition behave like them.

---

## Phase 1 — Split registration from participation — **DONE**

Delivered across 1a (MMP number), 1b (schema split and data migration) and 1c
(the wizard split). The acceptance test holds: a returning volunteer signs in,
confirms department, availability and consents for the edition in one short
form without re-entering their profile; a new volunteer completes the full
registration once and is approved once.

Still open from this phase — **sensitive-department sign-off**: an approved
volunteer can self-select into Medical or Security with no review by that
department. Flagged, not built; it is a safeguarding decision.

The original specification follows for reference.

### Scope

**1. `Volunteer` — the person, registered once.**
Carries the profile (personal, location, professional, church, motivation),
emergency contact, health information, approval standing, and `mmpCode`.
Most of this already exists on `VolunteerProfile`; the work is moving approval
and the registration lifecycle onto it.

**2. `EditionParticipation` — the person in one edition.**
`(volunteerId, edition)` unique. Carries availability, the department chosen for
*that* edition, the consents taken for *that* edition, participation status
(`SIGNED_UP` → `ASSIGNED` → `CHECKED_IN` → `COMPLETED`, plus `WITHDRAWN`), and
shift assignments.

This is the same shape as `PreviousEditionParticipation`, which already exists
and is already keyed `(userId, edition)`. Consider whether the two become one
table with a flag, rather than two tables that drift apart.

**3. Move `VolunteerAvailability` off `applicationId`.**
It currently hangs off a per-edition application:

```prisma
model VolunteerAvailability {
  applicationId String   // ← should be participationId
  date          DateTime
  period        ShiftPeriod
}
```

**4. Split the wizard.** Steps 1–5 and 7 become one-time registration. Step 6
(availability) plus consents become the per-edition flow. A returning volunteer
sees only the short form, pre-filled with last edition's department, with the
option to change it.

**5–7. The MMP number — done.** See *Phase 1a* above. `User.mmpCode` is unique
and indexed; `mmp_code_seq` starts at 2214059, one past the highest legacy code,
so migrated volunteers keep the number they already have and new ones continue
the same series. The value is formatted as a plain 7-digit zero-padded integer,
so the eventual roll past 2299999 changes nothing. Login accepts all three
identifiers, canonicalised before rate limiting so `MMP2214059`, `mmp 2214059`
and `2214059` share one bucket. The per-edition reference is no longer shown to
volunteers anywhere.

Still to do here: the importer must write the *legacy* code from the CSV rather
than allocating a fresh one — Phase 2.

### Confirmed decisions

- **Approval is one-time.** A returning volunteer is not re-reviewed. Admin
  needs a bulk *Approve all* action for the new-registrant queue (Phase 7).
- **Department may change each edition**, so it lives on the participation, with
  last edition's choice as the default.
- **Consents are re-taken each edition**, so they live on the participation.

### Open question worth resolving before build

One-time approval plus free department choice means someone approved for
Ushering in 2026 can self-select into **Medical** or **Security** in 2027 with
no review by that department. Decide whether a small set of sensitive
departments require sign-off on entry, even for an already-approved volunteer.
This is a safeguarding question, not a technical one.

### Impact on work already delivered

Honest accounting:

| Built | Effect |
|---|---|
| Migration module | **None.** Already creates person + participation, never an application. |
| Volunteer dashboard | Moderate. The nine-stage journey splits along the same line — first five stages are registration, last four are per-edition — so it survives restructuring rather than being rewritten. |
| Applicants admin | Becomes two views: volunteers (standing, approval) and 2027 participation. Filters and exports carry over. |
| Wizard | Steps unchanged individually; the routing and the submission boundary move. |

**Done when.** A returning volunteer signs in, confirms availability and
consents for 2027 in one short form without re-entering their profile, and a
new volunteer completes the full registration once and is approved once.

**Blocked on.** Sensitive-department sign-off (above). Confirmation that
`MMP2214059` is genuinely next.

---

## Phase 2 — Import fields the export needs — **DONE**

Delivered. All 20 columns of the merged export now auto-map; a dry run of the
real 13,969-row file produces 0 errors and exactly 12 warnings (the 12
unusable phones). Specifics:

- **Legacy identity honoured.** The MMP number and username come from the file
  when usable — unparseable or already-taken values fall back to allocation
  with the reason recorded on the row, never a failure.
- **Enums translated, never guessed.** Age band, gender and denomination map
  through closed tables; unrecognised values are dropped with a warning and the
  original text survives in the participation metadata.
- **Per-row edition.** Each person is recorded against their own Year
  (2022–2026), not the batch label — one upload instead of five.
- Address, city and country (by exact name) applied to the profile;
  accommodation, how-they-heard and the legacy IDs preserved in metadata.
- On MATCH_EXISTING the existing account's code and data are kept; the legacy
  code is recorded as a conflict for review, never overwritten silently.

The original specification follows for reference.

**Current state.** The importer maps 19 fields. The export carries 8 more it
cannot express, so they would be silently dropped:

`MMP username` · `Legacy user ID` · `Legacy UID` · `Age band` ·
`Denomination` · `How you heard` · `Address` · `Accommodation`

The prepared CSV already carries all eight so nothing has to be re-exported —
they simply show as *not imported* on the mapping screen until this lands.

**Scope.**
1. Add mappable fields: `mmpCode`, `username`, `ageRange`, `denomination`,
   `address`, `accommodation`, `legacyUserId`.
2. **Value translation** for the enum-backed ones. All three map cleanly:
   `21-25`…`51 & Above` → `AGE_21_25`…`AGE_51_PLUS`; `Female`/`Male` →
   `FEMALE`/`MALE`; `RCCG` / `NON RCCG` / `NON Christian` → `RCCG` /
   `OTHER_CHRISTIAN` / `NON_CHRISTIAN`. Validate against the enum and warn on
   anything unrecognised rather than guessing.
3. **Preserve legacy usernames**, falling back to the generated one on
   collision. `allocateUsername` already handles collisions; feed it the legacy
   name first.
4. **Honour a per-row edition.** `importRow` uses `batch.sourceEdition` for
   every row, but the export gives each person their own `Year`. Without this a
   single upload records all 13,969 people against one made-up edition label.
   Use the row's `previousEdition` when mapped, the batch's otherwise. **This is
   what makes one upload possible instead of five.**
5. `mmpCode` must import as the person's permanent code (Phase 1), not as a
   previous-registration string.

**Done when.** A dry run maps all 20 columns and the resulting participation
records carry each person's own year.

**Blocked on.** Phase 1.

---

## Phase 3 — Legacy department mapping

**Current state.** The export has **15** department names; the platform has 10.
Several are plainly the same team recorded two ways:

- `Security/Protocol` (343) + `Security` (281)
- `Registration Team` (271) + `Registration Unit` (123)
- `Medical` (535) + `Medical Officer` (78)
- `Logistics` (473) + `Accommodation Logistics` (173) + `Transportation Logistics` (108)

`Volunteers Praise Team` (4,902) and `Welfare` (3,238) are 58% of the file.

**Scope.** A mapping table from legacy name → current department, applied at
import, with unmapped names recorded verbatim rather than dropped. Store the
original string alongside the mapped id — the legacy name is historical fact and
must survive.

**Blocked on.** Somebody who knows the teams must confirm the merges. Fifteen
rows, and it should not be guessed at.

---

## Phase 4 — Accommodation

**Current state.** No table, no field, no import. The volunteer dashboard says
so honestly rather than showing an empty panel. The export contains 329 real
allocations (`WHITE HOUSE BLK2 RM 11D`, `Dove Dormitory RIGHT WING …`).

**Scope.** Decide whether accommodation is managed here at all. If yes: a model
(building / block / room / bed), an import path for the legacy strings, an admin
screen, and the volunteer dashboard card that is currently a placeholder. If no:
keep the honest notice and drop the column on import.

Note that accommodation is almost certainly **per edition**, not per person — so
it belongs on `EditionParticipation`.

**Blocked on.** Is accommodation managed in this platform for 2027, or
elsewhere?

---

## Phase 5 — Running the import and the activation campaign

**Current state.** The module works end to end. What is undecided is how 13,969
emails actually go out.

### The flow, as built

1. Invitation email — *"an account exists, use Forgot password."* **No token in
   the email**, by design: a link sitting unread for three weeks is an expired
   link and a support ticket. The message points at the forgot-password page so
   the volunteer starts a fresh, short-lived token themselves.
2. Volunteer requests a reset → sets a password → signs in.
3. `mustReviewProfile` gates the dashboard until they confirm their details.
4. They mark availability for 2027 — **not** a fresh registration (Phase 1).

### Recommendations

**Send in waves, not one run.** 13,969 messages from a domain that has never
sent bulk mail will be throttled or blocked — and a blocked domain also stops
password resets, the exact message people need next. Suggested: 500, then
1,000 / 2,000 / 5,000 as the bounce rate stays low. The worker already caps at
50 per pass; wave size is an operational decision on top of that.

**Verify SPF, DKIM and DMARC before the first wave.** Non-negotiable at this
volume.

**Sequence waves by recency.** The 3,583 people from 2026 are most likely to
recognise the message and least likely to bounce, which builds domain
reputation on the best addresses. Leave 2022 (1,587 four-year-old mailboxes)
until last.

**Bounce handling does not exist yet.** `SENT` means the provider accepted the
message and nothing more; `DELIVERED` and `BOUNCED` are only reachable from a
provider webhook, which is not built. Without it you cannot distinguish a dead
address from a person who has not got round to it. Build it before the large
waves, or accept flying blind across ~14,000 addresses.

**People who no longer control that mailbox will be locked out.** Forgot-
password needs the mailbox, and MMP Code login does not solve it — the ID gets
you to the form, not past it. An admin-assisted path is needed: verify identity
by MMP Code plus phone, change the address, audit the change. Decide who may do
that.

**Keep the reset response generic.** Already required and already the case; it
must survive this work.

**Time the campaign against registration opening.** Inviting people to set a
password with nothing to do afterwards wastes the one message they will open.

**Done when.** A wave can be sent, its bounces observed, and its activation rate
read off the batch screen.

**Blocked on.** Approved wording · sender identity · wave schedule · who may
change a locked-out volunteer's email address.

---

# Part B — The admin platform

## Phase 0 — Remove department capacity enforcement — **done, with one remnant**

Folded into Phase 1b, since the split rewrote the same code paths:

- The submission block is deleted; nothing refuses an application by count.
- The department picker shows "N volunteers so far" as orientation, never
  "full", and disables nothing.
- `getDepartmentsWithLoad` counts participations and computes no `isFull`.

**Remaining:** `Department.capacity` still exists as a column and the admin
departments page still offers to edit it. Dropping the column is bundled into
the next schema migration rather than shipped alone. `Shift.capacity` stays —
a shift genuinely has a limited number of posts.

---

## Phase 6 — Overview command centre — **DONE**

Delivered; see the completed table. The original specification follows.

**Current state.** Four totals and four distribution lists. Reports what *is*,
never what needs doing.

**Scope.** Event status with compact countdown (reuse `useEventCountdown` — do
not write a third clock) · registration state · full lifecycle metrics ·
migration metrics · communication and moderation metrics · **Needs attention**
queue · recent activity · distribution by department, country/region and age ·
application trend over time · migration activation progress · quick actions.

Every actionable number links to the filtered view that resolves it. A count
nobody can click is decoration.

**Done when.** An administrator can name the three most urgent things on the
platform within ten seconds, and click straight to each.

---

## Phase 7 — Applicants

**Current state.** Already decent: search, five filters, pagination, CSV and
Excel export, full review page. Missing the bulk-operation layer.

**Phase 1 splits this screen in two.** Approval is a one-time judgement about a
*person*, so it belongs on a **Volunteers** view. Availability, department and
shifts for a given edition belong on a **2027 participation** view. Filters and
exports carry over to both.

**Bulk approval is a confirmed requirement**, not a nice-to-have: a returning
cohort of 13,969 people plus new registrants cannot be approved one at a time.
An *Approve all matching this filter* action needs a confirmation dialog stating
the count, a permission check, and one audit record per volunteer — a bulk
action that logs a single "approved 4,902 volunteers" line is unauditable
afterwards.

**Preserve** every existing filter and both exports.

**Scope.** Reusable data table (Phases 8 and 9 reuse it — build it here with
that in mind) · URL-persisted filters · saved views · column visibility · row
selection and bulk review/assignment · reviewer assignment · review-ageing ·
note counts · completion indicator · detail drawer beside the existing page ·
export confirmation and export audit records · searchable country/region
selects.

Health information stays behind `health:view` and keeps writing an access
record. Already correct — do not regress it.

**Blocked on.** Phase 1. Is reviewer assignment advisory or exclusive?

---

## Phase 8 — Testimonies moderation

**Current state.** 103 pending in one unpaginated card list, a note input on
every record, test data mixed with real submissions.

**Scope.** Moderation queue on the Phase 7 table · detail drawer · search,
filters, sorting, pagination · moderator assignment · internal-note timeline ·
public preview · duplicate and spam detection · test-data tagging with safe
bulk cleanup outside production · bulk actions · categories/tags · featured
selection · moderation history · contact details behind a permission ·
confirmation dialogs.

Nothing becomes public until approval succeeds. Never optimistically.

**Schema.** Needs moderator assignment, spam/duplicate/test flags, featured,
tags and a note timeline. Today there is one `reviewNote` string.

**Blocked on.** What counts as a duplicate? Who may see submitter contact
details?

---

## Phase 9 — Messages helpdesk

**Current state.** 70 messages as repeated cards, no assignment, no pagination,
automated test messages dominating.

**Scope.** Inbox split layout (list · detail · contact profile · timeline) ·
search, filters, pagination · read/unread · priority · assignment · tags ·
internal notes · duplicate grouping · spam handling · bulk actions · related
volunteer account and application · response templates · integrated reply where
the provider supports it, `mailto:` otherwise · ageing indicators · analytics ·
test-data separation.

**Schema.** Needs priority, assignment, read state, tags, note timeline. Today:
`status` and one `handlerNote`.

**Blocked on.** Do replies send from the platform or from a mailbox? That
changes the data model — decide before writing any of it.

---

## Phase 10 — Announcements UI

**Current state.** The schema landed with the permissions migration — status,
priority, scheduling, expiry, channels, revisions, delivery statistics all
exist. **The interface is still the old create-and-publish form.**

**Scope.** List · editor · preview · full lifecycle (draft, scheduled,
published, expired, archived) · publish now / schedule / expire · audience
filters beyond the current three (multiple departments, application status,
country, RCCG region) · test email · delivery statistics with failed-email
handling · clone · version history · created-by and modified-by.

Scheduling and expiry need a worker pass. Reuse the migration queue — do not
introduce a second scheduler.

**Blocked on.** Sender name, sender address, reply-to.

---

## Phase 11 — Departments and questions

**Current state.** The question editor is the most developed admin screen.
Conditional display works; questions with answers are retired, not deleted.
Preserve both.

**Scope.** Department active/inactive and descriptions · drag-and-drop ordering
· conditional logic builder · validation rules · draft/publish so a half-edited
set never reaches a volunteer · preview · version history · copy and duplicate ·
import/export question sets · answer analytics · remaining field types.

**Never add.** Capacity limits, full states, automatic closure, capacity-based
blocking. See Phase 0.

---

## Phase 12 — Administrators

**Current state.** Roles can be assigned. The schema for granular permissions,
suspension and assignment history exists and is enforced — but **there is no
interface**, so granting a permission is currently a database operation.

**Scope.** Administrator table with search and filters · active/disabled · last
login · roles and department scopes · role descriptions · permission matrix
wired to `AdminPermissionGrant` · temporary suspension via `adminSuspendedUntil`
· assignment history from `RoleAssignmentHistory` · confirmation on sensitive
changes · super-admin safeguards.

**Done when.** A super administrator can grant one reviewer the export
permission, and suspend another until a date, without touching SQL.

**Blocked on.** May a super administrator remove their own last super-admin
role?

---

## Phase 13 — Settings as the configuration centre

**Current state.** Five fields. The audit calls for nine sections: General ·
Event · Registration · Volunteer configuration · Communications · RCCG
structure · Migration · Security · Integrations.

Two things matter more than the field list:

1. **Event is the source of truth.** `src/config/site.ts` holds it today, read
   from environment variables. Settings must not become a *second* copy — that
   is exactly how the login page came to greet people with “84 Hours … 2026”
   long after the site moved on. Decide whether Settings writes through to
   config or replaces it, and leave one answer in the code.
2. **RCCG structure moves here** from `/admin/reference`; the standalone route
   retires only once this exists.

Free-text dates become date/time controls. Every change validated, previewed
where useful, audited with before/after values.

**Blocked on.** May administrators edit event dates, or is that deployment
configuration?

---

## Phase 14 — Activity Log and Security Audit

**Current state.** 2,261 entries of raw action codes and raw JSON. Technically
complete, operationally unreadable.

**Scope.** Three views: All activity · Security and compliance (restricted) ·
System events. Human-readable labels — `Super Admin exported 98 volunteer
applications`, not `application.exported`. Filters for actor, role, module,
category, entity, result, date range. Search. Security-only and test-data
filters. Pagination. Permission-controlled export. Detail drawer with links to
the related record. Raw JSON behind a *Technical details* disclosure. Retention
controls.

The migration actions added in the last pass (`migration.batch_created`,
`migration.import_queued`, `migration.invitations_sent`, …) are already named
individually so they can be labelled without parsing metadata.

**Blocked on.** Audit retention period.

---

## Phase 15 — Cross-cutting finish

- **Scheduler.** The migration queue advances from the batch screen because
  there is no cron. Announcement scheduling makes a real one necessary. One
  worker entry point, called by cron *and* the UI.
- **Upload retention job.** `purgeExpiredUploads()` exists; nothing calls it.
- **Test-data separation.** Recurs in Phases 8, 9 and 14 — solve once.
- **Complete state set** everywhere: loading, empty, error, partial success,
  permission denied, queue unavailable, network failure, no records, no search
  matches. Every error says what happened, whether data was saved, and what to
  do next.

---

## Rules that apply to every phase

**Do not introduce duplicate systems.** One countdown, one queue, one event
source of truth, one data table. The audit says this, and it is the failure
mode this codebase is most exposed to.

**Server-side permissions.** Navigation and conditional rendering are
convenience. `requirePermission` in the page *and* the action is the access
control.

**Never department capacity.** See Phase 0.

**Restraint in the admin area.** Operational, compact, accessible. GSAP only
for dashboard reveal, sidebar and wizard transitions, success confirmation and
progress. Never animate a table continuously.

**Definition of done, per phase.** Migrations applied · `npm run typecheck` ·
`npm run lint` · `npx vitest run` · `npx playwright test` · `npm run build` ·
axe clean on new screens · no horizontal overflow 320–1920px.

**Restart the dev server before a test run you intend to trust.** A server up
for hours degrades enough to produce failures that look like product bugs and
are not — see `docs/TESTING.md`.

---

## Open organisational decisions

Answering these is faster than discovering them mid-phase.

| Decision | Blocks |
|---|---|
| Do sensitive departments (Medical, Security) require sign-off when an already-approved volunteer switches into them? | 1 |
| Is `MMP2214059` genuinely the next free code? | 1 |
| The 15 → 10 legacy department mapping | 3 |
| Is accommodation managed in this platform for 2027? | 4 |
| Invitation wording · sender identity · wave schedule | 5 |
| Who may change a locked-out volunteer's email address? | 5 |
| Reviewer assignment advisory or exclusive? | 7 |
| Is the per-edition registration ID retired from volunteer-facing screens, or renamed? | 1, 7 |
| What counts as a duplicate testimony? Who sees contact details? | 8 |
| Replies from the platform or a mailbox? | 9 |
| May a super admin remove their own last super-admin role? | 12 |
| May administrators edit event dates? | 13 |
| Audit retention period | 14 |
| Uploaded-CSV retention (currently 30 days, chosen not confirmed) | — |

### Settled

| Decision | Answer |
|---|---|
| Do volunteers re-register each edition? | **No.** Register once; mark availability each edition. |
| Is approval re-run each edition? | **No.** One-time, plus a bulk *Approve all*. |
| May a volunteer change department between editions? | **Yes.** Department lives on the participation. |
| Are consents re-taken each edition? | **Yes.** Consents live on the participation. |
| MMP Code format | **Unchanged.** Continue the sequence from `MMP2214059` as a 7-digit integer. |
| Is the year prefix implemented going forward? | **No.** It was specified but never built — all 13,973 codes use `22` regardless of year, and the registration year is not recoverable from the export. Switching it on for 2027 only would make the field true for new people and false for 13,969 existing ones. |
| Merge the two export files? | **Not needed.** `t2024` is a byte-identical subset of `users`. |

Still outstanding from earlier work: the country count (homepage says 82, About
and Contact say “many nations”), whether the 11 placeholder parishes should be
retired, and which of the two published addresses is correct.
