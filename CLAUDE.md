# LearningLinks: standing project rules

These come from the owner (Taichung, Taiwan). Treat them as requirements, not suggestions. Full context: `docs/MASTER_PLAN.md`.

## What the product is
A **connection website** between educators and the people who need them. Educators are free. Schools and families pay a flat membership. We are **not** an employer, agent or guarantor.

## Money
- Schools: **NT$10,000 per campus for 12 months** (3 campuses = NT$30,000). **No discount for extra campuses and no proration.** A campus added mid-year pays the full NT$10,000 and gets its own full 12 months from the day it starts. Families: **NT$2,000 for 12 months**. The owner is firm on these prices: do not suggest changing them.
- **VAT is included** in these prices (confirmed). One-time payment, 12-month term, **never auto-renews**. Prices are flat (no discounts unless the owner configures one).
- **Families launch with schools in Phase 1.** Launch order: Phase 1 Taiwan (educators, schools, families), Phase 2 Thailand and Vietnam, Phase 3 Japan, Korea and China.

## Who can see whom (non-negotiable)
1. **Nobody sees any educator without a paid membership.** No free browsing, no public profile pages, no public profile links, no search-engine indexing of profiles. A clearly labelled **sample** profile on marketing pages is allowed.
2. **Families** see only educators who offer **private tutoring / coaching**.
3. **Schools** see only educators open to **full-time or part-time** work (these work together). Schools never see tutoring-only educators.
4. An educator visible to both is shown to each audience with **only that audience's side** (schools do not see tutoring or rates; families do not see school-work wishes). Rates are for families only.
5. The rules live in `src/lib/visibility.ts`. Every query, DTO and page must use them.

## Features that were removed on purpose: do not build them
The owner removed **live matching** (a live substitute board with chat) and **substitute work** as an option, to stay above board legally. Schools and educators discuss substitute cover **between themselves**, using the contact details an educator chose to share. Do not add a substitute option, availability board, presence, or in-app chat without the owner's explicit approval and a lawyer's opinion.

## Compliance notice: ALWAYS include it
Every page and every flow, for every party (educators, schools, families), must carry the notice that:
- LearningLinks is **only a connection website**;
- we do **not** carry out background checks on teachers, schools or families, and do not verify identity, credentials, licences or work permits;
- everyone must complete all checks and follow all government laws, policies and procedures that apply to them.

The canonical wording is `messages/*/notice.json` (English and Traditional Chinese). Use it; do not re-word it ad hoc. Sign-up, checkout and consent flows also need the **acknowledgement checkbox** (`notice.acknowledge`). Tutoring screens add `tutoringWork`. `tests/messages.test.ts` fails if the notice is weakened or missing in either language.

## Data we never collect or store
ID, passport or ARC numbers, criminal records, health or financial data, home addresses, children's data. Credentials are self-declared (links only, never documents).

## Working agreement
Show **mock-ups and get approval before any expensive build**. The owner approved the mock-ups and said "go" for **Step 1** (running site: home, marketing pages, sign-up, sign-in), which is built. **Steps 2 to 4 (educator side, schools and families with payments, reports and launch readiness) each need the owner's go-ahead first.** Never claim something is verified unless it was run.
