# LearningLinks: standing project rules

These come from the owner (Taichung, Taiwan). Treat them as requirements, not suggestions. Full context: `docs/MASTER_PLAN.md`.

## What the product is
A **connection website** between educators and the people who need them. Educators are free. Schools and families pay a flat membership. We are **not** an employer, agent or guarantor.

## Money
- Schools: **NT$10,000 per campus for 12 months** (3 campuses = NT$30,000). **No discount for extra campuses and no proration.** A campus added mid-year pays the full NT$10,000 and gets its own full 12 months from the day it starts. Families: **NT$2,000 for 12 months**. The owner is firm on these prices: do not suggest changing them.
- **VAT is included** in these prices (confirmed). One-time payment, 12-month term, **never auto-renews**. Prices are flat (no discounts unless the owner configures one).
- **Payments:** Phase 1 (Taiwan only) is **bank transfer**, confirmed by an admin. **Credit card is added later**; keep the payment code provider-agnostic.
- **Families launch with schools in Phase 1.** Launch order: Phase 1 Taiwan (educators, schools, families), Phase 2 Thailand and Vietnam, Phase 3 Japan, Korea and China.

## Who can see whom (non-negotiable)
1. **Nobody sees any educator without a paid membership.** No free browsing, no public profile pages, no public profile links, no search-engine indexing of profiles. A clearly labelled **sample** profile on marketing pages is allowed.
2. **Families** see only educators who offer **private tutoring / coaching**.
3. **Schools** see only educators open to **full-time or part-time** work (these work together). Schools never see tutoring-only educators.
4. An educator visible to both is shown to each audience with **only that audience's side** (schools do not see tutoring or rates; families do not see school-work wishes). Rates are for families only.
5. **Job posts (owner decision, 17 Nov 2026):** schools with an active membership may post **full-time or part-time** jobs. Job posts are visible **only to signed-in educators who have an account and a profile**. Not to the public, not to search engines, not to families, not to other schools, not to educators who are signed out or have no profile. Job posts never offer substitute or cover work. (Counsel's view on job advertising is still pending: the owner has decided to proceed.)
6. The rules live in `src/lib/visibility.ts`. Every query, DTO and page must use them.

## The map view is a REQUIRED core feature (owner insists, 17 Nov 2026)
Discovery is **map-first**, not just lists: the owner loved the map on the old site and calls it the game changer versus competitors' listings. Taiwan first, then the rest of Asia country by country (Phase 2, 3). Aim for a premium, distinctive feel.
- **Paying schools and families** get an educator map (audience-filtered exactly like the list, via `src/lib/visibility.ts`; educators appear at **district level only**, never at an address, and never to non-members or search engines).
- **Signed-in educators with a profile** get a school map with open job posts on the pins (old-map style).
- Map and list always go together (same filters, same data service). Do not ship a discovery screen without its map.

## Design direction: "Concierge" (owner choice, 17 Nov 2026)
The owner rejected the first designs ("feels like filling out a form at the airport, too sterile") and chose the **Concierge** concept after reviewing five (Postcards, Notice Board, Journal, Playground, Concierge; mock-ups: https://claude.ai/artifact/3EfBUBPvyXM8QuGbfet1Ao).
- **Never a wall of labelled boxes.** Flows ask **one question at a time**, in a friendly voice ("Link", a guide drawn as two linked rings), with big tiles/pills, warm encouragement, a live preview of the result, and reassurance where people feel unsure. Sign-up, school onboarding and family checkout should follow the same pattern (not yet built).
- **Colour:** blush canvas `#fcf3ee`, aubergine ink `#2b1730`, lilac (`brand-*`), apricot (`accent-*`). **No single party colour (green, blue, red, teal, strong yellow) may dominate**, in Taiwan these read as a political stance. All text pairs must keep 4.5:1 contrast.
- **Type:** Plus Jakarta Sans (self-hosted via fontsource, never from a third-party CDN) with the system Traditional Chinese fonts as fallback.
- The tokens live in `src/app/globals.css` (`@theme`). Do not hard-code colours elsewhere (the map reads `src/components/map/style.ts`).

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
