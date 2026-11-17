# LearningLinks

A connection website between educators and the schools and families who need them. Educators are always free. Schools pay NT$10,000 per campus for 12 months and families pay NT$2,000 for 12 months (VAT included, one-time payment, never auto-renews). We are only a connection website: no background checks, no identity or credential verification, no sensitive documents stored.

**Read first:** [`CLAUDE.md`](./CLAUDE.md) (standing rules) and [`docs/MASTER_PLAN.md`](./docs/MASTER_PLAN.md).

## Status

Step 1 of Phase 1 (Taiwan) is built: marketing pages, sign-up (with the compliance acknowledgement enforced on the server), sign-in, email verification, password reset, and a placeholder dashboard. Educator profiles, memberships, payments and contact reveal are **not built yet**.

## Run it locally

Needs Node 22+ and PostgreSQL 16.

```bash
npm install
cp .env.example .env.local   # then set DATABASE_URL and BETTER_AUTH_SECRET (openssl rand -base64 32)
npm run db:migrate
npm run dev                  # http://localhost:3000/zh-TW  (or /en-TW)
```

In development, emails (verification, password reset) are printed to the server log. In production `RESEND_API_KEY` is required and email verification is always enforced.

## Checks

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

## Layout

| Path | What |
|---|---|
| `src/lib/plans.ts` | Prices and per-campus maths |
| `src/lib/visibility.ts` | Who may see which educator (every query and page must use it) |
| `src/lib/membership/`, `src/lib/reveal/` | 12-month term rules, contact-reveal daily cap |
| `src/lib/auth/` | Better Auth setup, server-side acknowledgement check |
| `messages/<locale>/*.json` | All copy. `notice.json` is the canonical compliance wording |
| `src/lib/db/schema/` | Drizzle schema; migrations in `drizzle/` |
| `docs/mockups/` | Approved design mock-ups |
