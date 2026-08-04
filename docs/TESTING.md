# Testing

```bash
npm test              # unit + integration (Vitest)
npm run test:coverage # with coverage
npm run test:e2e      # Playwright, desktop + mobile + tablet
npm run verify        # typecheck → lint → test → build
```

End-to-end tests need a running app. They start one automatically, or reuse yours:

```bash
E2E_BASE_URL=http://localhost:3000 npm run test:e2e
npx playwright install chromium   # once
```

---

## What is covered automatically

### Unit — `tests/unit/`

| File | Covers |
|---|---|
| `questions-engine.test.ts` | Conditional visibility including grandchildren, pruning of hidden answers, required/length/range/rating/pattern validation, "Other" free text, rejection of options that do not belong to a question, malformed stored patterns |
| `security.test.ts` | scrypt hashing and verification, salting, rejection of malformed hashes, rehash policy, token uniqueness and constant-time comparison, every role/permission pair, department scoping, upload magic-byte sniffing (including a PHP script and an HTML polyglot renamed to `.png`) |
| `validation.test.ts` | Names with accents and apostrophes, email normalisation, E.164 phone handling, URL rules, username format, password policy and strength, and every wizard step schema — including the guardian-consent branches and the four consent checkboxes |
| `contrast.test.ts` | WCAG contrast ratios read from the real tokens in `globals.css` |

### Integration — `tests/integration/` (needs `TEST_DATABASE_URL`)

Answer persistence with options and free text, pruning on save, replacement rather than accumulation
when a step is re-saved, unique registration numbers under parallel allocation, status-history
recording, **health information staying out of the admin list query**, department-head scoping
(including an attempt to widen it via query parameters), and database-level uniqueness of email and
phone.

Skipped automatically when `TEST_DATABASE_URL` is unset.

### End-to-end — `tests/e2e/`

`registration.spec.ts` walks the whole journey: account creation → all eight steps → conditional
department questions (switching Instrumentalist ⇄ Singer and asserting the other branch disappears)
→ consent enforcement → submission with a registration ID. Plus draft survival across a reload,
guardian fields appearing only for under-18s, validation errors preserving typed values, duplicate
email rejection, and identical messages for an unknown account and a wrong password.

`accessibility.spec.ts` runs axe-core (WCAG 2.0/2.1 A and AA) over the public pages, all eight wizard
steps and the dashboard, and checks keyboard operability and the error summary's field links.

Every spec runs at three viewports: desktop, mobile (Pixel 7) and tablet.

---

## What must still be checked by hand

Automated tooling catches roughly a third of accessibility problems, and nothing here can judge
tone or real-world delivery.

**Accessibility**

- [ ] Navigate the whole wizard with only Tab, Shift+Tab, arrows, Space and Enter
- [ ] Confirm the focus ring is visible on every control, including the searchable dropdowns
- [ ] VoiceOver / NVDA: is each step announced, is the progress indicator meaningful, are errors read
- [ ] Zoom to 200% and confirm nothing is clipped or requires horizontal scrolling
- [ ] Windows High Contrast mode

**Email**

- [ ] Verification, reset, submission, status-change and announcement emails in Gmail, Outlook,
      Apple Mail and one Android client
- [ ] Confirm links work through the production `APP_URL`
- [ ] Confirm no health or emergency-contact detail appears in any of them

**Real-world conditions**

- [ ] Throttle to Slow 3G and complete a step — the draft must still save
- [ ] Kill the network mid-step: the error must appear and the typed values must survive
- [ ] Upload a 10MB photo from a phone camera and confirm the size message
- [ ] Complete a registration on an actual mid-range Android phone

**Roles** — sign in as each role and confirm the boundaries:

- [ ] Department Head sees only their departments, and cannot reach another via a direct URL
- [ ] Reviewer cannot approve or reject
- [ ] Only the Medical Information Officer can reveal health information
- [ ] Every reveal appears in Admin → Audit log

**Data**

- [ ] Export CSV and Excel and open both in Excel and Google Sheets
- [ ] Confirm no health information in either
- [ ] Confirm a value beginning `=` in a free-text field is not executed as a formula

---

## Notes for future contributors

- End-to-end locators use element **ids**, not label text: accessible names here are deliberately
  verbose ("Password (required)") and a "Show password" toggle sits inside the field, which makes
  text lookups ambiguous. The labels themselves are asserted by the accessibility suite.
- `tests/e2e/rate-limit.ts` clears the rate-limit counters between tests. The whole suite runs from
  one IP address and would otherwise trip the production limit. Do not weaken the limit to make tests
  pass.
- Integration tests always run against `TEST_DATABASE_URL`; `tests/setup.ts` overrides
  `DATABASE_URL` so a mistake cannot wipe development data.
- `server-only` is stubbed for Vitest (`tests/stubs/`) so server modules can be unit tested under
  Node. The guard remains active in the real build.
- The Playwright projects use Chromium-based devices so the suite runs anywhere Chromium is
  available. Add WebKit and Firefox projects in CI for cross-engine coverage.

---

## A stale dev server produces false failures

`playwright.config.ts` sets `reuseExistingServer: true`, so the suite attaches to whatever is already
on port 3000. A dev server that has been up for hours degrades badly: the same 72 tests take 7.7
minutes against a stale one and 2.3 minutes against a fresh one, and steps that do several database
round trips start exceeding the 30-second assertion timeout. The failure looks like a hung server
action — a submit button stuck in its pending state with no error — which reads like a product bug
and is not one.

Restart the server before a run you intend to trust:

```bash
pkill -f "next dev"; npx playwright test
```

The same suite passes on a fresh server.

## The suite shares your development server

It cannot have its own. Next 16 refuses to start a second `next dev` for the
same project directory — *"Another next dev server is already running"* —
whatever port you give it, so `reuseExistingServer` must stay `true`.

That has one consequence that surprises people: **if no server is running when
you start a test run, Playwright starts one and stops it again when the run
finishes.** The server then appears to have "kept stopping" on its own. It did
not; the test run owned it and tore it down.

Start your own server first and it survives the run untouched:

```bash
npm run dev
```

To keep the suite entirely away from it, point it somewhere else instead:

```bash
E2E_BASE_URL=http://localhost:3000 npx playwright test
```

With `E2E_BASE_URL` set, Playwright manages no server at all — it only connects
to the one you named.
