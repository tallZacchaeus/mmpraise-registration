# Deployment

## Pre-flight checklist

- [ ] `APP_SECRET` is 48+ random characters and **different from development**
- [ ] `APP_URL` is the public HTTPS origin
- [ ] `DATABASE_URL` points at production PostgreSQL, over TLS
- [ ] `STORAGE_DRIVER=s3` with a **private** bucket
- [ ] `SMTP_*` configured and a test message delivered
- [ ] `SEED_ADMIN_PASSWORD` changed after first sign-in
- [ ] RCCG reference data replaced with the official structure
- [ ] `SITE_DOMAIN` and `ACME_EMAIL` set (Docker deployments only)
- [ ] Terms and privacy notice reviewed
- [ ] Event name and dates set in Admin → Settings
- [ ] `npm run verify` passes, and `npx playwright test` passes against a **freshly started** dev server

`assertProductionSafety()` in `src/lib/env.ts` refuses to start with a short secret, a non-HTTPS
`APP_URL`, local storage or missing SMTP when `NODE_ENV=production`.

---

## Launch scope — what is live in the first release

The first release opens **the homepage, the About page, the Contact page and the registration journey**. Everything else on the
public site renders as "Coming soon" instead of linking to a page that does not exist yet or back to
the old WordPress site.

**Always live — no flag, and none should be added.** Registration cannot receive applications
without them:

| Route | Purpose |
|---|---|
| `/` | Homepage |
| `/about` | About page |
| `/contact` | Contact page and message form |
| `/register`, `/login`, `/verify-email`, `/forgot-password`, `/reset-password` | Account access |
| `/apply`, `/apply/[step]`, `/apply/submitted` | The nine-step wizard |
| `/dashboard`, `/dashboard/summary`, `/dashboard/account` | Volunteer dashboard |
| `/admin/*` | Review, exports, moderation |
| `/privacy`, `/terms` | Required by the consent step |
| `/api/*` | Uploads, reference data, exports |

**Flagged.** Each is one variable in `src/config/features.ts`, read from the environment:

| Flag | Default | What it controls |
|---|---|---|
| `NEXT_PUBLIC_FEATURE_LIVESTREAM` | `true` | YouTube links (channel already exists) |
| `NEXT_PUBLIC_FEATURE_SHARE_TESTIMONY` | `true` | On-page testimony form — moderated before publishing |
| `NEXT_PUBLIC_FEATURE_NEWSLETTER` | `true` | On-page newsletter signup |
| `NEXT_PUBLIC_FEATURE_GIVE` | `false` | **Donations** — see the note below |
| `NEXT_PUBLIC_FEATURE_ABOUT` | `true` | The `/about` page and every link to it |
| `NEXT_PUBLIC_FEATURE_BLOG` | `false` | Blog link and media card |
| `NEXT_PUBLIC_FEATURE_GALLERY` | `false` | Gallery link and media card |
| `NEXT_PUBLIC_FEATURE_MAGAZINE` | `false` | Magazine menu item and media card |
| `NEXT_PUBLIC_FEATURE_RADIO` | `false` | Radio menu item and media card |
| `NEXT_PUBLIC_FEATURE_PRAYER_REQUEST` | `false` | Prayer request link |
| `NEXT_PUBLIC_FEATURE_CONTACT` | `true` | The `/contact` page and every link to it |

> **Donations are switched off.** Giving is a working revenue path on the current site. It was
> disabled here on instruction, so no visitor can donate through the new homepage until you set
> `NEXT_PUBLIC_FEATURE_GIVE=true` and redeploy. If the old site stays online, keep it reachable, or
> turn this flag on before you switch the domain over.

To turn something on: set its variable to `true` and **redeploy**. `NEXT_PUBLIC_*` values are inlined
into the browser bundle at build time, so a restart alone will not pick up the change. Nothing else
needs editing — a flag switching on gives the link a destination, and the "Coming soon" state
disappears everywhere it appeared (header, footer, participation cards, activity cards, media cards).

---

## Option A — Vercel

1. Import the repository; the framework is detected automatically.
2. Add every variable from `.env.example` to the project.
3. Set the build command to `prisma migrate deploy && next build` so migrations run on deploy.
4. Attach PostgreSQL from the Vercel Marketplace, or point `DATABASE_URL` at your own instance.
5. Use S3-compatible storage — Vercel's filesystem is ephemeral, so `STORAGE_DRIVER=local` will lose
   uploads between deploys.
6. After the first deploy, run the seed once against production:
   `DATABASE_URL=<prod> npx tsx prisma/seed.ts`

Server Actions and Route Handlers run on Node.js (Fluid Compute) — no Edge runtime is used, and none
is needed: `sharp`, `exceljs` and `node:crypto` all require Node.

---

## Option B — Docker

The Dockerfile, `docker-compose.yml` and `docker/Caddyfile` in the repository root are the real,
maintained versions — they are not samples to copy out of this document.

```bash
cp .env.example .env.production          # fill it in first
docker compose --env-file .env.production build
docker compose --env-file .env.production up -d
```

`--env-file` is required. Compose substitutes `${VAR}` from `.env` by default, and every
`NEXT_PUBLIC_*` value is compiled into the browser bundle at build time — omit the flag and the
bundle ships with an empty site URL and every launch flag at its default.

**Three services:**

| Service | What it does |
|---|---|
| `migrate` | Runs `prisma migrate deploy` once and exits. `app` waits for it to succeed, so the server never runs against a schema the code does not match. |
| `app` | The Next.js standalone server. Not published to the host — only Caddy can reach it, so nobody can hit port 3000 on the public IP and bypass TLS. |
| `caddy` | TLS termination. Obtains and renews the Let's Encrypt certificate itself; there is no certbot to schedule. |

**Image layout.** `next.config.ts` sets `output: 'standalone'`, so the runtime image carries a
self-contained server with only the modules it actually imports — no source tree and no dev
dependencies. The Prisma CLI is deliberately *not* in it: `prisma.config.ts` pulls in `dotenv` and
the CLI toolchain, which belong in the build stage. That is why `migrate` builds `target: build`.

No Prisma engine binary is needed at runtime — the app reaches PostgreSQL through the `pg` driver
adapter, which is plain JavaScript.

**Seed once, after the first deploy:**

```bash
docker compose --env-file .env.production run --rm migrate npx tsx prisma/seed.ts
```

**Uploads.** With `STORAGE_DRIVER=s3` nothing is written to the container filesystem. If you use
`STORAGE_DRIVER=local` instead, uploads go to the `uploads` volume — back it up, or a container
rebuild is survivable but a volume prune is not.

---

## Option C — Linux server (systemd)

```bash
git clone <repo> /srv/mmp && cd /srv/mmp
npm ci && npx prisma generate && npm run build
npx prisma migrate deploy
```

```ini
# /etc/systemd/system/mmp.service
[Unit]
Description=MMPraise Volunteer Registration
After=network.target postgresql.service

[Service]
Type=simple
User=mmp
WorkingDirectory=/srv/mmp
EnvironmentFile=/srv/mmp/.env.production
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ReadWritePaths=/srv/mmp/storage

[Install]
WantedBy=multi-user.target
```

---

## Migrations

Always `prisma migrate deploy` in production — never `migrate dev`, which can reset data.

```bash
npx prisma migrate deploy
```

Migrations run before the new version starts. Take a backup first (below). For a zero-downtime
change, split destructive migrations into two releases: add the new column and backfill, deploy the
code that uses it, then drop the old column in a later release.

---

## Backups

```bash
# Nightly, keep 30 days
pg_dump "$DATABASE_URL" --format=custom \
  --file="/backups/mmp-$(date +%F).dump"
find /backups -name 'mmp-*.dump' -mtime +30 -delete
```

Restore:

```bash
pg_restore --clean --if-exists --dbname="$DATABASE_URL" /backups/mmp-2026-12-01.dump
```

Uploaded files live in object storage — enable bucket versioning and lifecycle rules there. Test a
restore before the event, not after an incident.

---

## Monitoring

| Watch | Why |
|---|---|
| 5xx rate on `/apply/*` | A failing step blocks registrations |
| Submission rate | A sudden drop usually means a broken step, not less interest |
| `auth.login_failed` volume in `audit_logs` | Credential stuffing |
| `health.viewed` entries | Should be rare and attributable |
| Database connections and slow queries | The admin list is the heaviest query |
| Disk usage on `storage/` (local driver only) | Uploads accumulate |

Application logs go to stdout. `console.error` is used for genuine faults; audit entries are the
durable record of who did what.

---

## Scaling notes

- The app is stateless — run several instances behind a load balancer. Sessions and rate limits live
  in PostgreSQL, so they work across instances.
- Rate limiting is a database counter. Under very heavy load, move it to Redis behind the same
  interface in `src/lib/security/rate-limit.ts`.
- Reference endpoints set `Cache-Control`, so a CDN absorbs most of that traffic.
- Export is capped at 20,000 rows per request; for larger sets, filter and export in batches.

---

## Security operations

- Force HTTPS and enable HSTS at the proxy.
- Keep the storage bucket private; the app streams files through an authorising route.
- Rotate `APP_SECRET` only during a maintenance window — it invalidates CSRF tokens.
- Review `audit_logs` after the event, and act on data-deletion requests (flagged on the user record)
  within the 30 days promised in the privacy notice.
- Apply dependency updates: `npm audit`, then `npm run verify`.
