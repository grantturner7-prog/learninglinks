# LearningLinks: standing project rules

These come from the owner (Taichung, Taiwan). Treat them as requirements, not suggestions. Full context: `docs/MASTER_PLAN.md`.

## What the product is
A **connection website** between educators and the people who need them. Educators are free. Schools and families pay a flat membership. We are **not** an employer, agent or guarantor.

## Money
- Schools: **NT$10,000 per campus for 12 months** (3 campuses = NT$30,000). **No discount for extra campuses and no proration.** A campus added mid-year pays the full NT$10,000 and gets its own full 12 months from the day it starts. Families: **NT$2,000 for 12 months**. The owner is firm on these prices: do not suggest changing them.
- **VAT is included** in these prices (confirmed). One-time payment, 12-month term, **never auto-renews**. Prices are flat (no discounts unless the owner configures one).
- **Payments (owner decision, 18 Nov 2026):** online payment goes through **ECPay (綠界)**: card, ATM virtual account, convenience-store code (`src/lib/payments/`, `docs/PAYMENTS.md`). **Bank transfer** stays as an optional second route (confirmed by an admin; bank details come later, in the server's private settings). The payment code stays provider-agnostic (`orders.provider`). We never see or store card numbers; only a correctly signed ECPay notice starts a membership.
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

### Page look: "Atlas" (owner choice, 25 Nov 2026)
The owner found the site "average at best" and not easy to use, and chose **Option A, "Atlas"** from two mock-ups (https://claude.ai/artifact/EebAwJvsVRYMFzg7ooPLCz; the other was "Neighbourhood"). Same palette, same font, and the one-question-at-a-time flows stay as they are. What Atlas adds:
- **The map leads, on deep aubergine.** Aubergine top bar, hero and footer; apricot is the action colour on aubergine. The home page opens with the Taiwan map (a labelled sample), then true numbers only (schools from government lists; **never a count of educators**), then three doors with the price on each.
- **The menu follows the person** (visitor, family, school, educator, admin): `src/components/site-header.tsx`. A phone gets the same links behind a menu button.
- **Find page:** filters in one bar across the top, the list beside a map that stays in view. **Profile:** who they are, a dark contact card beside it, where they teach (districts only).
- **The standing notice is a calm band above the footer on every page** (`ComplianceNotice variant="band"`): the canonical wording, unchanged, once per page. Sign-up, checkout and consent keep the boxed notice and the tick box. (This presentation was in the mock-up the owner chose; the owner has not yet confirmed it separately.)
- Built so far: the frame, home page, members-only wall, find page and educator profile. The other pages sit inside the new frame with their earlier layout until they are redone.

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

## The school card: picture, name, address (owner decision, 23 Nov 2026)
When an educator taps a school on the map they see **a picture of the school, its name and its address**.
- **Pictures show the establishment only (gate, building, grounds). Never people**, and above all never children. A person looks at every picture before it is allowed in; anything doubtful is left out. A school with no picture shows a friendly "no picture yet" tile.
- **Only pictures we are allowed to reuse**: openly licensed photos (Wikimedia Commons: public domain, CC0, CC BY, CC BY-SA) shown with the credit the licence requires, or a picture the school provides itself. Never copy pictures from search engines, school websites or social media.
- **Addresses**: the school's own address as the Ministry of Education publishes it (official schools and kindergartens). Cram schools stay at district level (a small one can be run from a home) until the school enters its own address.
- **Contact details come from the school itself**: when a school signs up it enters the correct contact person and details. We never import phone numbers or staff names.
- The reviewed list is `data/school-photos.json` (each entry carries the fingerprint of the exact file that was looked at); `npm run db:import-school-photos` loads it; an admin can take any picture down from a report (`docs/LAUNCH_DATA.md`).

## Working agreement
Show **mock-ups and get approval before any expensive build**. The owner approved the mock-ups and said "go" for **Step 1** (running site: home, marketing pages, sign-up, sign-in), then for **Step 2** (educator side, map) and, with "Do it in the order you think is best" (17 Nov 2026), for the **Concierge home page, guided sign-up and Step 3** (schools and families, bank-transfer payments, contact reveal, school job posts). On 18 Nov 2026 the owner said "go ahead with Step 4": reporting and moderation, drafts of the legal pages, the deployment kit, hardening and launch data tooling. All of it is built. The owner will approach their lawyer **after the whole site is complete**, so the legal pages are complete drafts with visible `[For lawyer: ...]` placeholders and stay marked DRAFT until `LEGAL_REVIEWED=true`. The owner has not supplied bank details yet: they go in the server's private settings, never in the code. Never claim something is verified unless it was run.
