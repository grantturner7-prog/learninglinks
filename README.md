# LearningLinks

A connection website between educators and the schools and families who need them. Educators are always free. Schools pay NT$10,000 per campus for 12 months and families pay NT$2,000 for 12 months (VAT included, one-time payment, never auto-renews). We are only a connection website: no background checks, no identity or credential verification, no sensitive documents stored.

**Read first:** [`CLAUDE.md`](./CLAUDE.md) (standing rules) and [`docs/MASTER_PLAN.md`](./docs/MASTER_PLAN.md).

## Status

Built so far (Phase 1, Taiwan):

- **Step 1:** marketing pages, sign-up with the compliance acknowledgement enforced on the server, sign-in, email verification, password reset.
- **Step 2:** the educator side. A guided, one-question-at-a-time profile flow with a live preview card (the "Concierge" design; contact and ID scanner on free text, photo upload with metadata stripped), a waiver recorded with the exact wording shown, publish/hide/withdraw/delete, **audience-filtered member directory** (families see tutors, schools see full-/part-time educators), **job posts visible only to signed-in educators with a profile**, and the **map views**: an educator map for paying members (district level, never an address) and a school map with job pins for educators. Maps are self-hosted: no third-party tiles or scripts.
- **Step 3:** schools and families. Guided join and checkout flows (family NT$2,000; school NT$10,000 per campus, each campus its own 12 months), a bank-transfer order page with a reference code, an **admin desk** (`/admin`, admins are the verified emails in `ADMIN_EMAILS`) to confirm transfers and approve school claims, memberships that start on confirmation and never auto-renew, **contact reveal** with a daily cap and an educator-side "who asked" list, school **job posting** (full-time/part-time only), renewal reminders (`POST /api/cron/reminders` daily with `Authorization: Bearer $CRON_SECRET`), and real dashboards.

- **Step 4:** reporting and moderation (report buttons, an admin queue to suspend or remove, fair-process emails), drafts of the Terms, Privacy policy and Educator waiver for a lawyer to review, account deletion for schools and families, a Content-Security-Policy, an accessibility pass, a deployment kit (Docker, HTTPS, backups, health check, `npm run preflight`) and a cram-school importer.

Not built: credit-card payments (later). Before launch: lawyer review, hosting and a domain, bank details, loading the cram-school table. Guides: `docs/DEPLOY.md` (go live), `docs/RUNBOOK.md` (daily running), `docs/LAUNCH_DATA.md` (school data).

## Run it locally

Needs Node 22+ and PostgreSQL 16.

```bash
npm install
cp .env.example .env.local   # then set DATABASE_URL and BETTER_AUTH_SECRET (openssl rand -base64 32)
npm run db:migrate
npm run dev                  # http://localhost:3000/zh-TW  (or /en-TW)
```

Optional data for the maps (development):

```bash
npm run db:import-schools -- --file schools.json   # ~5,500 school locations (see the licence note in the script)
npm run db:seed-demo                               # fictional educators and jobs; never runs in production
npm run geo:build                                  # regenerate the Taiwan boundary files in public/geo
```

In development, emails (verification, password reset) are printed to the server log. In production `RESEND_API_KEY` is required and email verification is always enforced.

## Checks

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

Database integration tests run only when `TEST_DATABASE_URL` points at a throwaway Postgres (they truncate it). Without it they are skipped.

## Layout

| Path | What |
|---|---|
| `src/lib/plans.ts` | Prices and per-campus maths |
| `src/lib/visibility.ts` | Who may see which educator (every query and page must use it) |
| `src/lib/membership/`, `src/lib/reveal/` | 12-month term rules, contact-reveal daily cap |
| `src/lib/auth/` | Better Auth setup, server-side acknowledgement check |
| `src/lib/educators/`, `src/lib/consent/` | Profile rules, contact/ID scanner, waiver record |
| `src/lib/directory/`, `src/lib/jobs/` | Audience-filtered educator queries and map counts; job posts and school pins (educators only) |
| `src/components/map/`, `src/lib/geo/`, `public/geo/` | The self-hosted map: components, country map config, boundary data |
| `messages/<locale>/*.json` | All copy. `notice.json` is the canonical compliance wording |
| `src/lib/db/schema/` | Drizzle schema; migrations in `drizzle/` |
| `docs/mockups/` | Approved design mock-ups |
