# LearningLinks

A connection website between educators and the schools and families who need them. Educators are always free. Schools pay NT$10,000 per campus for 12 months and families pay NT$2,000 for 12 months (VAT included, one-time payment, never auto-renews). We are only a connection website: no background checks, no identity or credential verification, no sensitive documents stored.

**Read first:** [`CLAUDE.md`](./CLAUDE.md) (standing rules) and [`docs/MASTER_PLAN.md`](./docs/MASTER_PLAN.md).

## Status

Built so far (Phase 1, Taiwan):

- **Step 1:** marketing pages, sign-up with the compliance acknowledgement enforced on the server, sign-in, email verification, password reset.
- **Step 2:** the educator side. A guided, one-question-at-a-time profile flow with a live preview card (the "Concierge" design; contact and ID scanner on free text, photo upload with metadata stripped), a waiver recorded with the exact wording shown, publish/hide/withdraw/delete, **audience-filtered member directory** (families see tutors, schools see full-/part-time educators), **job posts visible only to signed-in educators with a profile**, and the **map views**: an educator map for paying members (district level, never an address) and a school map with job pins for educators. Maps are self-hosted: no third-party tiles or scripts.
- **Step 3:** schools and families. Guided join and checkout flows (family NT$2,000; school NT$10,000 per campus, each campus its own 12 months), a bank-transfer order page with a reference code, an **admin desk** (`/admin`, admins are the verified emails in `ADMIN_EMAILS`) to confirm transfers and approve school claims, memberships that start on confirmation and never auto-renew, **contact reveal** with a daily cap and an educator-side "who asked" list, school **job posting** (full-time/part-time only), renewal reminders (`POST /api/cron/reminders` daily with `Authorization: Bearer $CRON_SECRET`), and real dashboards.

- **Step 4:** reporting and moderation (report buttons, an admin queue to suspend or remove, fair-process emails), drafts of the Terms, Privacy policy and Educator waiver for a lawyer to review, account deletion for schools and families, a Content-Security-Policy, an accessibility pass, a deployment kit (Docker, HTTPS, backups, health check, `npm run preflight`) and a cram-school importer.

- **Step 5:** online payment through **ECPay** (綠界): card, ATM virtual account and convenience-store code, with signed server notices, an audit trail and an admin check list. Off until the three `ECPAY_*` keys are set. See `docs/PAYMENTS.md`.

Before launch: lawyer review, hosting and a domain, ECPay merchant keys, bank details (optional), loading the cram-school table. Guides: `docs/DEPLOY.md` (go live), `docs/RUNBOOK.md` (daily running), `docs/LAUNCH_DATA.md` (school data).

## Try it without installing anything

`docs/demo/LearningLinks-demo.html` is a single file with pretend people and data. Double-click it: sign up, join as a family or school, pay on a **simulated** ECPay page, search educators on the map, post jobs, use the admin desk, switch between English and 繁中. Everything stays in your browser. It shows the look and the flows; the real rules and payments live in the actual site below. Rebuild it with `python3 docs/demo/build.py` (it pulls the real notice wording, map shapes and font from this repository).

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
npm run db:import-moe -- --prune                    # Ministry of Education school lists: government and private schools, universities, international schools
npm run db:seed-demo                               # fictional educators and jobs; never runs in production
npm run geo:build                                  # regenerate the Taiwan boundary files in public/geo
```

### See the whole site with demo logins

With the server running (`npm run dev`) and the maps' data loaded, in a second window:

```bash
npm run db:seed-demo          # 120 fictional educators and 60 job posts
npm run db:demo-accounts      # fictional logins, all with the password demo-password-1234
```

It prints the logins: a paid family (family@demo.test), a family that has not paid (newfamily@demo.test, to try checkout), a school with two campuses of which one is paid (school@demo.test), an educator (educator@demo.test) and the admin desk (the first address in `ADMIN_EMAILS`). Both scripts refuse to run in production, and `db:demo-accounts` only runs against a local server.

To try **online payment** without real money, put ECPay's public test account in `.env.local` (the three values and `ECPAY_MODE=stage` are written in a comment in `.env.example`). The payment buttons then open ECPay's real test page. See `docs/PAYMENTS.md`.

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
