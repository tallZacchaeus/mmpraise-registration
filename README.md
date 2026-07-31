# MMPraise Volunteer Registration

A production-oriented volunteer registration platform for the **84 Hours Marathon Messiah's Praise**.
It replaces the long single-page form with an accessible eight-step wizard, a department-specific
question engine that administrators can change without a deployment, a volunteer dashboard, and a
role-based administration area.

---

## Quick start

```bash
cp .env.example .env.local        # then edit DATABASE_URL and APP_SECRET
npm install
npm run db:migrate                # create the schema
npm run db:seed                   # reference data + super administrator
npm run dev                       # http://localhost:3000
```

Generate a secret with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

The seed creates a super administrator from `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`
(default `admin@mmpraise.org` / `ChangeMe!2026`). **Change that password immediately.**

Full instructions: [docs/SETUP.md](docs/SETUP.md).

---

## What it does

**For volunteers**

- Create an account, then complete eight short steps
- Only relevant questions appear — department questions are conditional, and church questions only
  apply to the denomination chosen
- Progress saves automatically and survives a refresh, a crash or a different device
- Review everything before submitting, with per-section edit links
- Receive a registration ID and confirmation email, then track status, shifts and announcements from
  a dashboard

**For administrators**

- Search, filter and paginate applicants; review the full application including department answers
- Approve, waitlist, reject, assign shifts, add internal notes
- Export the filtered set to CSV or Excel
- Publish announcements and optionally email them
- Add or edit department questions, RCCG regions, provinces and parishes — no code change needed
- Open and close registration, set department capacity, read the audit log

---

## Technology

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript | One deployable; Server Actions remove a hand-written API layer |
| Styling | Tailwind CSS v4, CSS custom properties | Design tokens live in one file; no gradients, per the brand |
| Validation | Zod | The *same* schema runs in the browser and on the server |
| Database | PostgreSQL + Prisma 7 | Typed access, real migrations |
| Auth | Session cookies, scrypt password hashing (`node:crypto`) | No native build step; revocable server-side sessions |
| Files | Local disk in dev, S3-compatible in production | Private by default, served through an authorising route |
| Email | Nodemailer; writes to `storage/mail` when SMTP is unset | Inspect real messages without sending them |
| Tests | Vitest + Playwright + axe-core | Unit, integration, end-to-end and accessibility |

Laravel was considered and not chosen: a second runtime would double the deployment and
authentication surface, and sharing Zod schemas between client and server removes a whole class of
validation drift.

---

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and serve |
| `npm run typecheck` | TypeScript, no emit |
| `npm run lint` | ESLint (includes React Compiler rules) |
| `npm test` | Unit and integration tests |
| `npm run test:coverage` | Tests with a coverage report |
| `npm run test:e2e` | Playwright, across desktop/mobile/tablet |
| `npm run verify` | typecheck → lint → test → build |
| `npm run db:migrate` / `db:deploy` | Migrations, development / production |
| `npm run db:seed` | Reference data and the bootstrap administrator |
| `npm run db:studio` | Prisma Studio |

---

## Documentation

- [docs/GO-LIVE.md](docs/GO-LIVE.md) — the ordered checklist for launching on the VPS
- [docs/SETUP.md](docs/SETUP.md) — local setup, environment variables, reference data
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — how the system is put together and why
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — production deployment, backups, monitoring
- [docs/TESTING.md](docs/TESTING.md) — what is tested automatically and what must be checked by hand
- [MMPRAISE-DESIGN-REFERENCE.md](MMPRAISE-DESIGN-REFERENCE.md) — the brand tokens taken from mmpraise.org

---

## What is live in the first release

The homepage and the registration journey. Every other public destination — About, Blog, Gallery,
Magazine, Radio, Prayer Request, Contact and **Give** — renders as "Coming soon" until its flag is
switched on. Each is one `NEXT_PUBLIC_FEATURE_*` variable; see `src/config/features.ts` and the
*Launch scope* table in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

Note that **donations are off**, which disables a live revenue path from the current site. Set
`NEXT_PUBLIC_FEATURE_GIVE=true` and redeploy when giving should reopen.

---

## Before you open registration

1. **Confirm the 2027 event date** and set `NEXT_PUBLIC_EVENT_STARTS_AT`. Until it is set, the
   homepage shows "dates to be announced" everywhere and omits the `Event` structured data —
   by design, so no invented date is ever published.
2. Replace the seeded RCCG regions and provinces with the official structure
   (Admin → Reference data). The seeded values are a placeholder.
3. Have the volunteer terms and privacy notice reviewed — the shipped text is a starting point.
4. Supply the remaining unverified details listed in [docs/HOMEPAGE-AUDIT.md](docs/HOMEPAGE-AUDIT.md):
   artist names, official phone number, social profile URLs, and the Magazine and Radio destinations.
5. Change the seeded administrator password and configure SMTP and S3.
6. Run `npm run verify`.

The event duration increases by one hour each edition (2026: 84 hours, 2027: 85). Change it with
`NEXT_PUBLIC_EVENT_DURATION_HOURS` and `NEXT_PUBLIC_EVENT_EDITION`; a unit test keeps the two in step.

Homepage assets live in `/public/landing` and the MMPraise mark is `/public/logo.png`
(also the source for `src/app/icon.png` and `src/app/apple-icon.png`). Nothing is hotlinked from
the WordPress site.
