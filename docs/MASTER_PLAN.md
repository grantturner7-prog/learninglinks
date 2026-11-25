# LearningLinks — Master Plan (v0.1)

*Working name for the rebuild of **Taiwan EduConnect** · drafted 17 Nov 2026*

**How to read the evidence tags**

- **[verified]** — seen on the live site or in a cited source (see Appendix C).
- **[my read]** — my judgment or background knowledge. Treat it as a hypothesis to test.
- **[ask counsel]** — a legal question I cannot settle. A local lawyer must answer it before we charge money in that country.

---

## Decisions update: 17 Nov 2026 (supersedes anything below that conflicts)

| Item | Decision |
|---|---|
| Company | Based in **Taichung, Taiwan**. Payments therefore start with **bank transfer + local gateways (ECPay / NewebPay)**, with Stripe as a later option once its Taiwan availability is confirmed. Invoices need Taiwan e-invoice and 統一編號 support. |
| Name | **LearningLinks** (trademark, domain and Chinese-name checks still to do). |
| Launch order | **Phase 1: Taiwan. Phase 2: Thailand and Vietnam. Phase 3: Japan, Korea and China.** Hong Kong and the Philippines are not launch markets. The Philippines remains useful as an *educator supply source* (educators can list "open to work in" other countries). |
| URL and locale pattern | `/{language}-{COUNTRY}/…`, e.g. `/zh-TW/`, `/en-TW/`, later `/th-TH/`, `/vi-VN/`. The locale carries the country, so routing, hreflang and country config share one key. |
| Phase 1 school data | The old map holds 5,477 mostly public schools with **no contact data**, and only 2 language schools. The main buyers, about 17,700 licensed cram schools, are missing. Phase 1 needs a cram-school import from government open data, with a licence check. |
| **Visibility (corrected 17 Nov 2026)** | **No one sees any educator without a paid membership. There is no free browsing, no public profiles and no teasers, for schools or for parents.** This replaces the "public teaser + member-only contact" model in the first draft below (§0 call 2, §5.2, §5.3, §7, §9, Appendix A). Educators are free and their profiles are visible to logged-in paying members only; contact details are shown one at a time on request, logged and capped per day. Profile pages are never indexed by search engines. Unauthenticated visitors get a members-only wall, with a clearly labelled **sample** profile so they know what they would be buying. |
| Public profile link / sample profile | **No public profile link for educators, ever. The labelled sample profile stays** on marketing pages and on the members-only wall. |
| **Pricing (set 17 Nov 2026, final)** | **Schools: NT$10,000 per campus for 12 months** (3 campuses = NT$30,000). **No discount for extra campuses and no proration:** a campus added mid-year pays the full NT$10,000 and gets its own full 12 months from the day it starts, so there is no way to game the rules. **Families: NT$2,000 for 12 months.** **VAT is included.** Flat, one payment, no auto-renewal. That is under NT$834 a month for a school, and less than half what competitors charge. You are firm on these prices. |
| **Audience-specific visibility (set 17 Nov 2026)** | **Families see only educators who offer private tutoring or coaching. Schools see only educators open to full-time or part-time work (these two work together), and never tutoring-only educators.** An educator in both groups is shown to each audience with only that audience's side: schools do not see tutoring or rates, families do not see school-work wishes. Hourly rates are for families only. *Confirmed 17 Nov 2026: part-time and full-time work together.* Rules live in `src/lib/visibility.ts` and are unit-tested. |
| **Live matching and substitute work: REMOVED (17 Nov 2026)** | To stay above board legally there is **no live substitute board, no in-app chat and no "substitute" option**. Schools and educators discuss substitute cover **between themselves**, using the contact details an educator chose to share. This removes the largest legal risk of the earlier draft. It must not come back without your explicit approval and a lawyer's opinion. |
| **Compliance notice: always (set 17 Nov 2026)** | **Every page and flow, for every party, carries a notice that LearningLinks is only a connection website, does not run background checks on teachers, schools or families, and that everyone must complete all checks and follow all government laws, policies and procedures that apply to them.** Sign-up, checkout and consent flows also require an acknowledgement checkbox. Canonical wording: `messages/*/notice.json`, guarded by a test. A standing rule is also recorded in `CLAUDE.md`. |
| **Families launch in Phase 1 (17 Nov 2026)** | Families launch together with schools. Phase 2 is Thailand and Vietnam. Phase 3 is Japan, Korea and China. |
| **Competitor licence check: Tealit (17 Nov 2026)** | Tealit shows **no licence number** on its site or advertiser contract. It sells advertising and VIP access to teacher profiles (up to NT$25,000 a year), through a marketing company, and describes its service as online recruitment, not placement. Whether it holds any permit is **unverified**. Details, and three ways to check, in `docs/research-tealit.md`. The employment-service permit question in §4 #2 is still open: ask the Taichung City Labor Bureau in writing. |
| **Job posts (owner decision, 17 Nov 2026)** | Schools with an active membership can post full-time or part-time jobs. **Job posts are visible only to signed-in educators who have an account and a profile** (not public, not indexed, not shown to families or other schools). No substitute or cover work. Counsel's view on job advertising (§4 #2) is still pending; the owner has decided to proceed. |
| **Payments (owner decision, 18 Nov 2026)** | **Online payment through ECPay (綠界)** (card, ATM virtual account, convenience-store code), built provider-agnostic. **Bank transfer** remains an optional second route; bank details come later. See `docs/PAYMENTS.md`. |
| **Map view: required (owner, 17 Nov 2026)** | Map-first discovery is a core, non-negotiable feature: Taiwan first, then each new country in Phase 2 and 3. Paying schools/families get an educator map (district-level, audience-filtered); signed-in educators get a school + jobs map. It was in the original plan (§5.6) but missing from the first mock-ups and Step 1; it is now part of Step 2. |
| **Design direction: Concierge (owner, 17 Nov 2026)** | The owner found the first designs sterile ("an airport form") and, after five concepts, chose **Concierge**: a kind guide asks one question at a time, with big tiles, a live preview card and warm microcopy. Palette: blush, aubergine, lilac, apricot (no party colours). Built: the site-wide look, the 9-step educator profile flow, the home page (Link asks "What brings you here?" above three doors), the school/family/safety pages, the five-question guided sign-up (honest notice with the required tick-box as the last step), sign-in and password reset, and the Step 3 flows (family join, school checkout, claims, job posts). The map-side and admin desk follow the same look. |
| **Page look: Atlas (owner, 25 Nov 2026)** | The owner found the site "average at best" and not easy to use. Of two mock-ups (Atlas, Neighbourhood) the owner chose **Atlas**: the map leads on deep aubergine, the menu follows the person (visitor, family, school, educator), prices sit on the three doors, the find page is a list beside a map, and the profile has one clear contact card. Same Concierge palette, font and one-question flows. Built: the frame (top bar, phone menu, footer, calm notice band), home page, members-only wall, find page and educator profile. Still in their earlier layout: the school, family and safety pages, sign-up, dashboards, jobs map, admin. The one-file demo still shows the earlier look. |
| Build status | Steps 1 to 4 built (18 Nov 2026). What remains before launch is outside the code: lawyer review of the legal drafts, choosing hosting and a domain, bank details, loading the licensed cram schools. See `docs/DEPLOY.md`, `docs/RUNBOOK.md` and `docs/LAUNCH_DATA.md`. |

---

## 0. The plan on one page

**What we are building.** A pan-Asian, education-only directory that connects educators with the people who need them.

- Educators pay nothing, ever.
- Schools/centres and families pay a flat 12-month membership. It does not auto-renew.
- The membership unlocks everything: without it, nobody can see any educator's profile or contact details.
- There are no placement fees and no commissions.
- We never hold sensitive documents such as criminal records or ID.

**What the audit found.** The current app is a working prototype, not yet a product.

- It has 13 teachers, 2 schools and 1 paying school. [verified]
- Its best asset is a map of 5,507 Taiwanese schools.
- It is Taiwan-only and has no parent/tutor side.
- I found no waiver, terms or privacy text in it.
- It charges schools $99/month, cancel anytime, which contradicts your annual no-auto-renew model.
- It is a single-page app whose HTML is an empty shell with a placeholder description, so search results and link previews (LINE, Facebook) get almost nothing.

**Recommendation: rebuild, don't refactor.** Migrate the 15 existing accounts after getting their consent.

**Five strategic calls**

1. **Supply first.** Free educators are the inventory. Switch the paywall on per city only after a density threshold is met (§9).
2. **Gate everything.** No free browsing for anyone. The membership buys access to educators (profiles and contact details). Because visitors cannot look inside, the marketing pages must carry the persuasion: a labelled sample profile, clear promises, and city-level counts only once they are impressive (never "13 teachers" on a home page).
3. **Trust without storage.** Use self-declared labels, links to third-party-hosted proof, and later partner badges where the partner holds the documents and we hold only a pass/fail flag.
4. **Build a self-service directory, not a broker.** "We take no agency fee" does not by itself keep us outside employment-agency licensing. Regulators look at what we do. [ask counsel, per country]
5. **One-time annual payments, not subscriptions.** This removes auto-renewal consent rules, card-on-file risk and recurring-billing gateway limits. It also lets us use local rails (bank transfer, convenience-store codes, LINE Pay).

**Sequence (updated 17 Nov 2026).** Phase 1: Taiwan (educators, schools and families together) → Phase 2: Thailand and Vietnam → Phase 3: Japan, Korea and China (China partner-led).

**Needed from you:** the decisions in §13. The most important are where your company is based (it decides payments and tax), the brand name, and access to the Replit source.

---

## 1. What exists today (audit of taiwan-school-connect.replit.app)

*Method: the repo is empty and the Replit source isn't in it, so I audited the live site: the served JS bundle, API routes, UI strings and screenshots (`docs/assets/current-site/`). I couldn't see authenticated screens as a user, so anything marked "from code" comes from the bundle.*

| Area | Finding |
|---|---|
| **Brand** | Three names are in use: `Taiwan Edu Connect` (page title), `Taiwan EduConnect` (home page, admin), `Taiwan School Connect` (sign-in). The meta description is still the Replit placeholder: "Update this description to reflect the app". [verified] |
| **Traction (live counters)** | 13 registered teachers · 2 registered schools · 0 schools hiring · 0 needing substitutes · 1 premium partner. [verified] |
| **Stack (inferred)** | React + Vite single-page app, wouter router, Clerk auth, shadcn/Radix UI, react-hook-form + zod, TanStack Query with a generated API client, Leaflet map with marker clustering, OpenStreetMap/ArcGIS tiles, Nominatim geocoding, REST API under `/api/*`, hosted on Replit. |
| **Educator flow** | Free. Sign-up through Clerk (the email/password form is what I could see). Profile fields: name, email, phone, highest education, **gender**, **nationality**, age groups, Taiwan city/district, subjects (about 20, each with teaching language EN/ZH), 600-char bio, photo. Photos are resized in the browser and sent as an inline data string, so they are probably stored in the database. |
| **School flow** | Register, then create a profile: name, address (geocoded, and **hard-coded to Taiwan's lat/long box**), type (Elementary, Middle, High, Cram School, Language School, International School, Kindergarten, Other), contact person, phone, email, website. Toggles for "hiring" and "seeking substitutes", plus a free-text note. |
| **Paywall** | **$99/month "Premium Partner Plan", cancel anytime**, in USD. Perks: appear on the teacher map, post hiring/substitute needs, showcase the school. Schools searching teachers see **name, phone and email only**. |
| **School Discovery map** | 5,507 schools seeded from OpenStreetMap, filterable by city and type, and **public (no login)**. The strongest asset. Most records have no contact data. |
| **Admin** | Stats, manage/delete teachers and schools, "seed public schools from OSM". |
| **Languages** | English + Traditional Chinese **interleaved** on every element, hard-coded in the code rather than a translation system. |
| **Missing** | Parents/tutors. Any waiver, consent log, terms or privacy text in the flows I could inspect. Jobs as real objects (only a toggle and free text). Annual membership. Renewals. Invoicing. Search and link-preview readiness (the SPA serves an empty shell with a placeholder description, and `sitemap.xml` returns the app's HTML instead of a sitemap). Messaging, notifications, reporting/moderation. Any country other than Taiwan. |

**Compliance exposure today.** The live site shows teachers' phone and email to paying schools, and I found no consent step. With 13 teachers this is easy to fix: when we rebuild, we email them, get explicit consent under the new waiver, and only then re-publish.

**Keep:** the bilingual instinct, the green/clean look as a starting point, the map-first discovery idea, the 5,507-school dataset (after a licence check, §7), the free-educator promise, and the "claim your school" funnel idea.

**Drop/replace:** interleaved bilingual text, Taiwan-only assumptions in code, inline image storage, per-month pricing, the empty-counter hero, gender and nationality as default fields (§5.4), and Clerk if the free supply side makes per-user auth pricing expensive (§7).

---

## 2. The model, stated precisely

| Role | Pays | Gets |
|---|---|---|
| **Educator** (teacher, tutor, instructor) | **Nothing, ever** | A profile that paying schools and families can see, job alerts, "who contacted me" visibility, control over what is shown |
| **School / centre** (kindergarten, cram school, language school, international/private school, chains) | **Flat annual membership**, one-time payment, 12 months, no auto-renew | Search with full filters, educators' contact details, job posts, shortlists, team seats, claimed school profile |
| **Family** (parents looking for a tutor) | **Flat annual membership**, one-time payment, 12 months, no auto-renew | Tutor search, contact details, safety guidance, shortlist |

**Non-negotiables**

1. No transaction fee, placement fee or commission.
2. The platform is a conduit, not an employer, agent or guarantor.
3. We store **no sensitive documents or data**: no ID, passport or ARC numbers, no criminal records, no health data, no financial data, no children's data.
4. Every educator signs a clear, unbundled **publication waiver** before anything goes live. It is versioned and logged, and withdrawable in one click.
5. Memberships are 12 months. Renewal is always an explicit opt-in.
6. Educator profile data is shown only as the educator chose, and contact details only to logged-in paying members.

---

## 3. Landscape

*Competitor facts come from search results and vendor/third-party pages, not from the competitors' own pricing pages (I couldn't open them). Treat fees and user counts as unverified claims.*

### 3.1 Who is already here

| Segment | Players found | Their model |
|---|---|---|
| **Taiwan: jobs for foreign teachers** | Tealit (most-cited Taiwan board in guides), Teast, Teach Away, Dave's ESL Cafe, Forumosa, Facebook groups | Job-ad boards. Schools post, teachers apply. Teast listings are posted directly by schools; I couldn't find posting prices. Teach Away quotes NT$40k–70k+/month for ESL/public schools and up to NT$120k+ at international schools. |
| **Taiwan: tutors for parents** | 1111 家教網 and 104 打工探吉 (both free for parents), Pro360 (quote marketplace), AmazingTalker (online, global tutors), Facebook regional groups | Free general-purpose job banks plus a few paid marketplaces. Education is a side section on the big job banks. |
| **Hong Kong tutors** | TutorCircle, Tutor Easy, TutorHabit | TutorCircle charges tutors an admin fee. Tutor Easy: free for parents, tutors pay a membership (per a third-party listing). TutorHabit is staff-curated (claims 200k tutors, vendor claim). |
| **Singapore tutors** | Yodaa, Teach-n-Learn, TigerCampus | Mostly local-student or vetted-tutor marketplaces. Teach-n-Learn is free now, with a commission planned. |
| **Korea** | 김과외 (tutor pays about 25% of first month's fee, per an app-store reply, unverified), 숨고 (Soomgo); foreigner job boards such as Waygook [my read] | Match-fee marketplaces for local tutors; job boards for foreigners |
| **Japan** | GaijinPot Jobs (employers pay per posting, price not public), others [my read] | Paid job posting |
| **Vietnam** | vietnamteachingjobs.com, Teast, Teach Away, Go Overseas, Facebook groups | Job boards plus very heavy Facebook-group usage |
| **Regional/global** | Tutopiya, MyPrivateTutor (tutors pay per lead plus membership), Preply/iTalki/Superprof [my read] | Commission or per-lead models |

### 3.2 The white space (my read)

1. **Nobody I found combines "educators free, demand side flat annual, zero placement fees, education-only, pan-Asia."** Tutor Easy's "tutors pay, parents free" is the opposite flow. Most competitors monetize educators through leads, commissions or admin fees. That is a real recruiting message for educators: *you will never pay us.*
2. **Existing boards are job-ad-centric.** They are poor at profile discovery, which is what a school with an urgent gap or a parent needs. We do both: schools can post jobs *and* search profiles.
3. **One supply pool, two demand sides.** The same educator can be hired by a school or found by a family, so each new educator makes both products better.
4. **Buyers read local languages.** The people paying (school owners, parents) read Chinese, Japanese, Korean or Vietnamese, while most ESL boards are English-only. Buyer-facing quality in the local language is a moat.
5. **Local, not just foreign, educators.** Taiwan's 17,710 licensed cram schools are about 88% test-prep [verified]. Parents mostly want maths, science and exam prep, often from local tutors. If we only list native English speakers we miss most of the family market, and we walk into the work-authorization problem in §4.

### 3.3 Market size: don't quote a TAM

Published estimates of the private-tutoring market range from about US$14.8B to US$133.8B globally and disagree on Asia-Pacific's share. [verified spread] I would not use any of them. Size the market **bottom-up by institution count** instead:

- **Taiwan:** 17,710 licensed cram schools (26 Jun 2025) [verified], plus 5,507 mapped schools, plus kindergartens and language centres.
- **Taiwan government demand signal:** the MOE plans to recruit about 980 foreign English teachers/assistants in 2026 under Bilingual 2030. [verified] Those hires go through the MOE programme, not us. They show demand and flow of teachers, and our school segment is private.

**Illustrative arithmetic, not a forecast.** At US$350 per school and US$25 per family, about 400 schools + 4,000 families ≈ **US$240k/year** for Taiwan.

---

## 4. Risks, ranked

| # | Risk | Why it matters | Mitigation |
|---|---|---|---|
| 1 | **Liquidity (chicken-and-egg)** | Schools won't pay without educators. The live site has 13. | Supply-first launch; paywall only after a per-city density threshold; free school-claim funnel; show counts only when impressive (§9). |
| 2 | **"Are we a recruiter?"** | Taiwan requires a permit for private employment-service institutions, which may charge fees. [verified from search of the Employment Service Act] Japan's labour ministry says that if the substance is matching, the label "information provider" doesn't help. [verified] Korea, China, HK and the Philippines have their own regimes. | Design principles: self-service search, no curated introductions, no screening on behalf of schools, no success fees. **Get a written opinion from a labour-law specialist in each country before charging.** [ask counsel] |
| 3 | **Foreigners and private tutoring** | In Taiwan, work permits are tied to one employer. Sources say private tutoring is generally unauthorized and carries fines, though sources disagree on enforcement. [verified, mixed] In Korea, E-2 holders are widely reported to be barred from private lessons. [verified] If we market foreign tutors to parents we may be facilitating illegal work. | Mandatory **work-authorization declaration** (a category, never a document number); per-country "know the rules" notices; build the family product around local tutors, permanent residents, open-work-right holders and online tutors abroad. [ask counsel] |
| 4 | **Trust and child safety** | We store no verification, and parents are inviting adults to teach children. | The trust layer in §5.4; safeguarding guidance; reporting and fast takedown; contact with children only through parents; clear Terms. |
| 5 | **Waiver and data law** | Taiwan, Japan, Korea, Vietnam (a new data law was scheduled for 1 Jan 2026; confirm its current status) and the Philippines all have personal-data regimes, with different consent and cross-border rules. [verified at summary level] | Unbundled, versioned consent; data minimisation; per-country legal pack; one-click hide/delete; region-aware data design. [ask counsel] |
| 6 | **Scraping and resale of the database** | Contact details behind a flat annual fee invite bulk harvesting, and one bad member can resell everyone. | Per-member daily reveal caps; contact data only via authenticated API; reveal audit log; canary profiles; bot protection; contractual ban on resale and mass messaging; account suspension. |
| 7 | **Parent product-market fit** | Parents need a tutor episodically. A 12-month pass can feel like poor value. | Low price; "family pass" for multiple children and re-hires; test willingness to pay with a landing page *before* building; use cooling-off-compliant checkout. |
| 8 | **Consumer cooling-off rights** | Taiwan gives 7 days to cancel distance sales, with an exception for online services fully performed once begun, with prior consent and notice. [verified from a 2015-era summary] A year-long membership may not fit that exception. | The admin desk can now record a refund and end a membership (built 23 Nov 2026); counsel still has to define who is entitled to one, per country. [ask counsel] |
| 9 | **Payments depend on where your company is** | Sources conflict on whether a Taiwan company can use Stripe directly. [verified conflict] | Entity decision first (§13); a `PaymentProvider` abstraction; one-time payments make local gateways easy. |
| 10 | **China** | Needs a local entity or partner, ICP filing, data localisation, WeChat/Alipay, and a different network environment. [my read] | Last wave, partner-led (§8). |
| 12 | **Live matching: removed** | The earlier draft had a live substitute board with chat. It looked like job matching, so you removed it (17 Nov 2026). | Do not rebuild it. Schools and educators arrange cover themselves. |
| 13 | **Cover arranged off-platform** | Educators and schools may still agree cover between themselves, and a foreign teacher covering classes for several schools can breach an employer-tied work permit. [ask counsel] | We do not facilitate it. The compliance notice reminds everyone to follow all government rules and that foreign teachers may need permission for each school. |
| 14 | **Job posts are still advertisements** | Schools can still post jobs (full-time or part-time). A job-posting service can fall under Taiwan's employment-service rules (§4 #2). [ask counsel] | Ask counsel. If there is any doubt, launch without job posts and add them later. |
| 11 | **Discrimination exposure** | Collecting and filtering on gender, age or nationality can expose schools and us under anti-discrimination rules. [ask counsel] | Don't offer these as default filters. Use work authorization and languages instead (§5.4). |

---

## 5. Product blueprint

### 5.1 Core jobs to be done

- **Educator:** "Get found by good employers and families without paying or exposing sensitive data."
- **School:** "Fill a vacancy fast, with someone I can contact today."
- **Family:** "Find a tutor near me (or online) for this subject and level, and contact them directly."

### 5.2 Release map

| Capability | v1 (Taiwan launch: educators, schools and families) | v2 (Taiwan scale; Thailand and Vietnam) | v3 (Japan, Korea, China) |
|---|---|---|---|
| Educator profile (members-only; contact shown on request) | ✓ | ✓ | ✓ |
| Waiver + consent log + one-click hide/delete | ✓ | ✓ | per-country versions |
| "I also tutor privately" toggle (collects tutor supply early) | ✓ | ✓ | ✓ |
| School claim flow (free), then paid membership | ✓ | ✓ | ✓ |
| School search with filters + shortlist + team seats | ✓ | ✓ | ✓ |
| Job posts (full-time, part-time), subject to counsel's view on job advertising | ✓ | ✓ | ✓ |
| Contact reveal with audit log + "who contacted me" for educators | ✓ | ✓ | ✓ |
| Family membership + tutor search (rates, subjects, exam prep) | ✓ | ✓ | ✓ |
| Optional request board (families post a need, tutors respond free) | | ✓ | ✓ |
| Multi-campus purchase (NT$10,000 per campus, no discount), invoice + 統一編號 | ✓ | ✓ | local equivalents |
| Renewal engine (60/30/7-day reminders, one-click renew, stacking) | basic | ✓ | ✓ |
| LINE integration (login + notifications) | login | ✓ | KakaoTalk, Zalo, WeChat |
| SEO landing pages for the service and guides (never educator profiles) | ✓ | ✓ | ✓ |
| Admin: moderation queue, reports, school verification | ✓ | ✓ | ✓ |
| Languages | EN + 繁中 | EN + 繁中 | + 繁中-HK, Vietnamese, Japanese, Korean, Thai... |
| Verification-partner badges (pass/fail only) | | | ✓ |
| **Audience-specific visibility** (schools see school-work seekers, families see tutors) | ✓ | ✓ | ✓ |
| **Compliance notice on every page + acknowledgement checkbox** | ✓ | ✓ | ✓ |

### 5.2a Removed: live substitute board and chat (17 Nov 2026)

The earlier draft had a live substitute board with real-time chat. You removed it, together with "substitute" as a work type, to stay above board legally. Schools and educators discuss cover between themselves; nothing in the product facilitates it. Do not rebuild it without your explicit approval and a lawyer's opinion.

### 5.3 Visibility model (the heart of the waiver)

*Corrected 17 Nov 2026: there is no public tier. The first draft of this section assumed free teasers; that was wrong.*

| Tier | Who sees it | Examples |
|---|---|---|
| **Members only: profile** | Logged-in schools/families with an active membership | Display name, photo (optional), subjects, levels, languages, area (district, never an address), bio, teaching modes, self-declared credentials, work-authorization category, rate range |
| **Members only: contact, on request** | The same members, one educator at a time, after they press "Show contact details" | Email, phone, LINE/Kakao/Zalo/WhatsApp IDs, any link the educator chose to share |
| **Private** | Only the educator and, where required by law, our admins | Login details, consent log, reveal history |
| **Everyone** | Anyone, signed in or not | Nothing about any educator. Marketing pages show only a labelled **sample** profile. |

A contact reveal is **logged**, capped per day and shown to the educator ("a member viewed your contact details"). A profile link shared by an educator (for example in LINE) leads a non-member to a "members only" wall, never to the profile.

*Decided 17 Nov 2026: there is **no** optional public link to an educator's own profile, because it would let schools skip the membership. The labelled **sample profile** on the marketing pages and the members-only wall **stays**.*

### 5.4 Trust layer, without storing sensitive data

1. **Verified channels.** Email and phone verified by one-time code.
2. **Self-declared labels.** Every credential is labelled "self-declared by the educator", with a year and an optional link to **third-party-hosted proof** (for example a certificate verification page). We store the link, not the document.
3. **Work authorization (category only).** For example "Citizen/PR", "Open work rights", "Employer-sponsored, needs a new employer", "Overseas, needs sponsorship", "Online only from abroad". No numbers.
4. **"What to verify" checklist** shown to schools and families, with plain steps for asking for a criminal-record certificate and permit directly from the educator, outside our platform.
5. **Report and takedown.** One-tap report, a moderation queue, a target response time, and suspension.
6. **Never-pay banner** for educators: "We never charge you. Report anyone who asks you to pay."
7. **Later (v3):** partner badges. The partner holds the documents and sends us only a pass/fail flag and date. [ask counsel]
8. **Skipped for now:** public reviews. They bring defamation, moderation and data-law burdens. Revisit after v2.
9. **Sensitive-field policy.** No gender, age or nationality as default fields or filters. Languages, experience and work authorization carry the useful information. Photos are optional.
10. **Technical guardrails.** Only photo uploads; strip EXIF; scan bios for ID-number patterns; block document uploads.

### 5.5 Membership engine

- One **entitlement** per membership holder (organisation or family): plan, start, end, price, currency, payment reference.
- **Activation:** payment confirmed → 12 months from that day. **Early renewal stacks** (new end = old end + 12 months).
- **Expiry:** read-only access. They can log in and see their own data, but contact reveals lock. No grace-period free access.
- **Reminders** at 60, 30, 7 and 0 days by email (and LINE where available), with one-click renew. Renewal is never automatic.
- **Leading indicators** (you can't measure renewal for 12 months): reveals per member per month, replies received, shortlists, last login, satisfaction score.
- **Payments:** one-time. Card, bank transfer/virtual account, convenience-store payment codes, LINE Pay, e-invoice (Taiwan 電子發票), company invoice with 統一編號.

### 5.6 Design direction

- **Mobile-first.** Most parents arrive on a phone, often inside LINE's in-app browser. Test there first.
- **One language at a time** with a switcher, not interleaved double text. It's cleaner, better for SEO, and scales to many languages.
- **Home page:** one clear promise per audience, the school map as the hero, and no counters until they are impressive.
- **Map plus list.** Keep map discovery, add a list view, saved searches and filters.
- **Members-only wall done well.** Visitors who reach a profile link or the directory see a clear explanation, the price, a labelled sample profile and one-tap joining, and never any real educator data.
- **Trust UI:** "self-declared" labels, the verify checklist, and the report button in plain sight.
- **Accessibility and speed:** WCAG AA, lightweight pages for mobile networks.

---

## 6. Pricing (decided 17 Nov 2026; the old hypotheses are replaced)

| Plan | Price | Notes |
|---|---|---|
| **Educator** | **Free** | Permanent promise. |
| **School** | **NT$10,000 per campus for 12 months** | VAT included: net NT$9,524 + VAT NT$476 per campus. Replaces today's $99/month (about NT$37,000 a year). Every campus costs the same: 3 campuses = NT$30,000. |
| **Family** | **NT$2,000 for 12 months** | VAT included: net NT$1,905 + VAT NT$95. One pass covers all children and re-hires. Opens at launch. |

*Decided: no discount for added campuses and no proration. A campus added later pays NT$10,000 for its own full 12 months.*

- Charge in local currency with round numbers and tax-inclusive prices for consumers.
- Competitors collect from **tutors** (HK TutorCircle's admin fee; Kim Gwaoe's reported ~25% of first-month tuition [unverified: from an app-store reply]). Our flat fee is on the other side, so the story to **tutors** is "keep 100%, pay nothing". It isn't a price anchor for parents.
- **Validate before building the family product:** a landing page with a price and a "reserve" button, plus 15 interviews (8 schools, 7 parents/tutors).

---

## 7. Technical architecture

**Principles:** SEO from day one, cheap per free user, country-aware from day one, no sensitive data, swap-able payments.

| Layer | Recommendation | Why |
|---|---|---|
| Web app | **Next.js (App Router) + TypeScript**, server-rendered | The current SPA is poorly indexable and gives empty link previews. Server rendering still matters for the marketing, guide and pricing pages and for link previews in LINE and Facebook. Educator profiles are never public, so they are not an SEO channel. |
| i18n | `next-intl`, URL pattern `/{country}/{locale}/…` (e.g. `/tw/zh-tw/`, `/tw/en/`) | One codebase for many countries and languages. |
| Database | **PostgreSQL + PostGIS** (managed) | Relational data, geo search, full-text search to start. Add Typesense/Meilisearch later if needed. |
| ORM/migrations | Drizzle or Prisma | Type-safe, versioned schema. |
| Auth | Self-hostable (Auth.js or Better Auth) with Google, Apple, **LINE** (and Kakao, Zalo, WeChat later) | Clerk charges per active user, which hurts when the supply side is free and large. [my read] Keep Clerk only if we want speed for v1 and plan the switch. |
| Payments | `PaymentProvider` interface: Stripe where our entity allows, plus ECPay/NewebPay for Taiwan, local providers per country | One-time payments only. Entity location decides what's available (§13). |
| Invoicing/tax | Taiwan e-invoice provider; per-country tax config | Tax-inclusive consumer prices, company invoices. |
| Files | Object storage + CDN; **resize on upload, never store images in the DB** | The current inline photo storage will bloat and slow. |
| Maps | Leaflet/MapLibre + a commercial tile provider; local providers where required | The OSM/ArcGIS tiles in the current app are a licensing risk at commercial scale. [my read] |
| Email/notify | Transactional email + LINE Official Account | Renewal reminders and alerts. |
| Anti-abuse | Bot challenge on signup and reveal, per-member reveal caps, canary profiles, audit log | Protects the paid asset. |
| Observability | Error tracking, uptime, product analytics (privacy-respecting), daily backups | Basics. |
| Hosting | Asia-Pacific region close to users; data tagged by country so a regional database can be split out later | Some countries (Vietnam, China) have data-localisation rules. [ask counsel] |
| Dataset | Replace the OSM seed with **official Ministry/city open datasets** where licensing allows; keep OSM attribution if used | OSM's ODbL licence has attribution and share-alike obligations. Check licences before publishing 5,507 pages. [ask counsel] |

**Migration:** export the 13 teachers and 2 schools, email them, get explicit consent under the new waiver, then import. Don't carry over inline photos; ask the owners to re-upload.

---

## 8. Country strategy

*Qualitative scoring. Items without a source tag are my read.*

| Market | Educator demand | Family/tutor market | Competition | Regulatory load | Payments/infra | Localization | Wave |
|---|---|---|---|---|---|---|---|
| **Taiwan** | High: 17,710 cram schools; MOE targets about 980 foreign English teachers/assistants [verified] | High (local test-prep) | Medium | Medium (employment permit question, foreign-worker rules, PDPA) | Medium (local gateways; Stripe unclear) | Low (繁中 + EN) | **1** |
| **Hong Kong** | High | Very high; incumbents charge tutors | High on tutors | Low–Medium (employment-agency licensing, PDPO) | Easy | Low–Medium | **2** |
| **Vietnam** | Very high (language-centre boom; USD 1,200–2,000/month pay seen in guides) [verified] | High, price-sensitive | Low–Medium (one board plus Facebook groups) | Medium–High (new data law, cross-border rules) | Local wallets/banks | Medium | **2** |
| **Japan** | High (eikaiwa, ALT, international schools) | High | High incumbents | High (placement licensing line; APPI) | Easy | High quality bar | **3** |
| **South Korea** | Very high (hagwon) | Huge, local-dominated; E-2 limits foreign tutors | High | High | Local gateway needed | Medium; KakaoTalk | **3** |
| **Philippines** | Mostly **supply**: educators who want roles abroad; some demand | Online tutoring supply | Medium | Medium–High (strong privacy regulator) | Local wallets | Low (English) | **3 (supply hub)** |
| **Thailand / Singapore / Malaysia / Indonesia** | Thailand large ESL market; Singapore tuition market | High | Medium–High | Varies | Stripe in Thailand/Singapore | Medium | **3–4** |
| **China** | High but complex | Academic tutoring is tightly regulated | High | Very high (ICP filing, PIPL, local entity) | WeChat/Alipay | High | **4, partner-led** |

**Your list ended at "Philippines,"**. Please tell me whether other markets are in scope (Thailand, Singapore, Malaysia, Indonesia, Cambodia?). Your message mentioned Southeast Asia, but the named markets are mostly East Asia.

**One key design idea:** every educator profile says **where they are now** and **which countries they'd work in**. The Philippines and other supply countries then feed demand in Taiwan, Vietnam and Korea from day one, which is why the Philippines is a supply hub, not a demand market, in Wave 3.

**Per-country launch gate (all must be green before charging)**

1. Written legal opinion on employment-agency licensing, data protection, consumer cooling-off, and foreigner-tutoring rules.
2. Local-language product and legal pages, reviewed by a native speaker.
3. A working local payment path and tax/invoice setup.
4. At least the minimum educator density per metro (§9).
5. A local advisor or community lead.

**Country config layer.** Currency, tax, payment providers, contact channels (LINE, Kakao, Zalo, WeChat, WhatsApp), legal documents, enabled features and school types all live in config, not code. Hard-coded Taiwan assumptions, like the current lat/long box, go away.

---

## 9. Go-to-market

**Supply first (free educators).**

- Onboarding in under 3 minutes with LINE/Google/Apple login.
- Seed through Facebook groups, Forumosa and Reddit, TEFL course providers, university international offices and Filipino teacher communities.
- Add the "profile link + QR" growth loop and the "who contacted me" feature to keep educators active.
- Content: teaching-in-[country] guides (salary, visas, how to spot scams). Existing boards own this high-intent traffic, and a content moat compounds.

**Demand next.**

- **Schools:** the claim-your-school funnel over the public dataset, plus outbound sales by city to cram schools, kindergartens, language and international schools, and chain headquarters. Time sales ahead of hiring peaks (Taiwan: before the September and February semesters, with the main peak June–August [my read]).
- **Families:** guide and city-level landing pages that explain the service (no educator names, to avoid thin content), parent communities (Dcard, Facebook, LINE groups), kindergarten partnerships, and exam-season campaigns. Because nothing can be browsed first, conversion depends on the sample profile, clear promises and trust signals, so test it with the priced "reserve" page before building.

**Density threshold before the paywall (initial proposals, tune with data).**

- At least 300 active, ≥60%-complete educator profiles in the metro, and at least 15 schools pre-sold.
- Roll out city by city: Taipei/New Taipei → Taichung → Kaohsiung → Taoyuan/Hsinchu → rest of Taiwan.

---

## 10. Roadmap

**Build status (17 Nov 2026):** Phase 1 Steps 1, 2 and 3 are built and tested. Step 1: public pages, sign-up/sign-in with the compliance acknowledgement, email verification. Step 2: educator waiver and consent log, profile builder, photo upload, audience-filtered member directory, job posts for signed-in educators with a profile, and the map views. Step 3: families join for NT$2,000 and schools pay NT$10,000 per campus (each campus its own 12 months, no discount, no proration) by **bank transfer** through guided flows; an admin confirms the transfer by its reference code, which starts the memberships (idempotent, audited); schools claim their campus (admin-approved) or add one missing from the data (district-level only); paying members reveal one educator's contact at a time (audience-checked, logged, capped per Taipei day, serialised against bursts) and educators see who asked (schools by name, families anonymously); schools post full-time/part-time jobs (substitute and cover wording rejected) that stop showing when the campus membership ends; renewal reminders at 60/30/7/0 days (never automatic) run from `POST /api/cron/reminders` with `CRON_SECRET`; the admin desk is English only. Not built: credit cards (payment code is provider-agnostic: `orders.provider`). Open licence flag: the school locations come from OpenStreetMap-derived data (ODbL); the school map shows the attribution and counsel should confirm the obligations before launch. **Step 4 (18 Nov 2026):** members can report an educator, a school or a job post (only what they can see; 10 a day); an admin dismisses or acts (suspend a profile or school, remove a job), the affected person is emailed without the reporter being named, and a suspended school loses its jobs, map pin, browsing, reveals and ordering; drafts of the Terms, Privacy policy and Educator waiver (34 `[For lawyer: ...]` placeholders); schools and families can delete their own account (orders stay as records without a link to the person); a Content-Security-Policy with per-request nonces; an axe-core accessibility pass over every page in both languages; a deployment kit (standalone build, Dockerfile, compose stack with Postgres, HTTPS proxy, daily reminders and nightly backups, backup and restore scripts, `/api/health`, `npm run preflight`, CI); a cram-school importer that keeps only name, kind and district. **Step 6 (18 Nov 2026):** the Ministry of Education school lists load with one command (about 10,800 government and private kindergartens, elementary, junior-high and senior-high schools, universities and colleges, and the schools for international residents, each marked government or private; bilingual schools are recognised by name, by the Ministry's list of schools for international residents and by a self-declared "We teach bilingually" tick box, because Taiwan has no official list of them); schools can browse the list by kind and city and always have an "add my school" route for one that is missing; new school kind "bilingual school". **Refund button (23 Nov 2026):** on the admin desk an admin opens a paid order and records a refund (partial or full, by ECPay back office, bank transfer or other) and/or ends one or more memberships (per campus for a school) at once; the site never moves money, it records what the admin already sent; refunds can never exceed what was paid, a double click records once, two admins at once cannot over-refund, an early-ended membership gets no renewal reminder, the buyer is emailed and sees the refund on their order page, and everything is in the audit log. Whether and when a buyer is *entitled* to a refund is still counsel's question. **Map, districts (23 Nov 2026, owner: "we need to be able to zoom in and see the districts"):** the owner asked whether to switch to another map service; decision: keep our own map (no fee per view, no visitor data to a third party, our colours) and build it out in three steps. Steps 1 and 2 are built. Every district in Taiwan is named on the map in English or Chinese; tapping a city frames the districts where its educators are, each with a count; tapping a district filters the list; a "where am I" bar (Taiwan › City › District) is the way back out and also says which area is in view when zooming by hand; a row of district links with counts sits under the map; bubbles that collided are moved clear instead of hidden (Taipei used to disappear behind New Taipei); the area map stops zooming where a single district would fill the frame. The school map names the districts behind the pins, pins that share a building are fanned out, and each pin is a 24px press target. The one-file demo has a zoomable map with named districts. **Step 3, not built:** a street background (roads, rail, rivers, place names) from OpenStreetMap data hosted on our own server; needs the data file downloaded (the build workspace cannot reach that site today) and the OpenStreetMap credit line counsel is already asked about. Until then, zooming far into an area with no school shows plain land. **School card (23 Nov 2026, owner: "when you click on a school, there should be a picture of the school... no pictures of people... alongside the school name and address"):** tapping a school shows a picture of the establishment, its name, kind, government/private, address and website; contact details are left for the school to enter when it joins. Addresses come from the Ministry's lists (10,769 schools); cram schools stay at district level. Pictures come only from Wikimedia Commons under licences that allow reuse, with the credit shown; every picture is looked at by a person first (no people, shows the school) and the importer refuses a file that differs from the one reviewed; an admin can take a picture down from a report. Open pictures exist for only about 900 schools, and Commons limits downloads to about one a minute from the build workspace, so they are loaded in batches. Still to do outside the code: lawyer review, hosting and domain, bank details, loading the cram-school table, a native Chinese read-through.

*Estimates assume one full-time builder plus roughly 10–15 hours a week of your time on legal, sales and community work. I can build most of the engineering.*

| Phase | When | Scope | Exit criteria |
|---|---|---|---|
| **0. Foundations** | Now → mid-Dec 2026 (about 3 weeks, in parallel with design) | Export Replit code/data to GitHub; re-consent email to the 13 teachers; Taiwan counsel consult (§4 #2, #3, #5, #8); brand/domain/trademark check; entity and payment path; 15 interviews; design system, IA and zh-TW/EN copy | Written legal go/no-go; payment path confirmed; name chosen |
| **1. Taiwan launch: educators, schools and families** | Dec 2026 → Feb 2027 (6–8 weeks; families add about 2 weeks) | Everything in the v1 column of §5.2, including family memberships. Soft launch in Taipei, New Taipei and Taichung; pre-sales to schools | ~500 educators nationwide (≥60% complete profiles); ≥25 paying schools; first families; consent log live; no critical security findings |
| **2. Thailand and Vietnam** | Mar → Dec 2027 | Country config layer; currencies and tax; Thai and Vietnamese locales; each launch with counsel and a local lead; a payment path per country; Taiwan scale-up continues alongside | Each country passes the §8 gate and meets density |
| **3. Japan, Korea and China** | 2028 | Per-country legal pack; partner verification badges if counsel agrees; China partner-led | Per-country gate and density |

**The first 12 months of data is thin.** Because contracts are annual and don't auto-renew, you won't see a real renewal rate until about 12 months after the first paying cohort. Use the leading indicators in §5.5 and the 60/30/7-day reminders to manage in the meantime.

---

## 11. KPIs

| Area | Metric |
|---|---|
| **Supply** | Active educators per metro; % profiles ≥60% complete; educator reply rate (parents will judge us on this); share offering tutoring |
| **Demand** | School claim rate; schools and families with active membership; contact reveals per member per month |
| **Quality** | Time to first contact; reply rate within 48 hours; reports per 1,000 reveals; takedown time |
| **Revenue** | Pre-sales; ARR; price realization; renewal rate (after 12 months); renewal intent (before) |
| **Growth** | Organic search share; educator referrals; profile-link visits |

---

## 12. Team and budget (rough, [my read])

- **Now:** you (business, sales, legal, community), plus me for design and build.
- **First hires:** part-time bilingual support/community lead for Taiwan; a freelance designer for polish; legal counsel per country.
- **Costs that dominate:** legal opinions and templates per country, sales and community time, and acquisition spend. Infrastructure should stay small at the start (low hundreds of US dollars a month), if auth and storage don't scale per free user.

---

## 13. Decisions needed (with my default)

| # | Decision | Why it matters | My default |
|---|---|---|---|
| 1 | **Where are you and your company based?** | Decides payments (Stripe vs local), tax, licensing, and which country's law applies to your entity | Tell me; I'll adapt §7 |
| 2 | **Brand:** keep Taiwan EduConnect, or go pan-Asia? | A Taiwan name blocks expansion. Three names are in use now | **LearningLinks** as a working name + country sub-sites. Needs domain, trademark and Chinese-name checks |
| 3 | ~~Contact details gated behind membership; basic teaser free?~~ | **Resolved 17 Nov 2026: no free teaser. Everything about educators is members-only.** | Done (§5.3) |
| 4 | **Include local (non-foreign) teachers and tutors from day one?** | The family market is mostly local test-prep | Yes |
| 5 | **Annual-only, no auto-renew, confirmed?** | Simplifies payment and consent law; hurts renewals unless reminders work | Yes, with strong reminders |
| 6 | ~~Families in v1 or v2?~~ | **Resolved 17 Nov 2026: families launch in Phase 1.** | Done |
| 7 | **Do you still have the Replit source and database?** | I only have the compiled bundle. I want the schema and the 15 accounts | Export to GitHub |
| 8 | **Country list and order** | Your list ended at "Philippines," | §8 order |
| 9 | **Auth provider:** keep Clerk for v1 or move now? | Cost at scale and LINE/Kakao/Zalo login | Move now if you can afford the time; otherwise keep for v1 and plan the switch |
| 10 | **Budget for counsel** | Taiwan first, then per country | Budget a Taiwan consult before Phase 1 launch |

---

## 14. Next 14 days

1. Export the Replit project to GitHub and pull a DB export of the 13 teachers and 2 schools.
2. Email the 13 teachers: explain the rebuild, ask for explicit consent, pause contact exposure until they reply.
3. Book a Taiwan labour-law/PDPA lawyer for a 1-hour consult with the questions in §4 (#2, #3, #5, #8).
4. Decide the name; check the domain and trademarks.
5. Settle the entity and payment path (§13 #1).
6. Run 15 interviews (8 schools, 7 parents/tutors) and a pre-sale landing page.
7. Start supply seeding: a "Join free as an educator" page with waiver v0 and a waitlist.
8. **My part (on your go):** scaffold the Next.js app in this repo, design system, i18n, database schema, auth, the educator onboarding flow with the consent log, and the school claim flow. That is the first slice of Phase 1.

---

## Appendix A — Educator publication waiver: skeleton (for a lawyer to turn into text)

Present as **unbundled checkboxes in the educator's chosen language**, never one blanket "I agree":

1. **Who we are and what we do.** We are a directory. We are not an employer or agent, we charge educators nothing, and we don't guarantee work.
2. **What you are sharing.** A field-by-field list, split into "your profile" and "contact details, shown on request". Nothing is public.
3. **Who will see it.** Only logged-in paying schools and families, in the countries you select. Never the public and never search engines.
4. **What we never ask for or store.** ID/passport/ARC numbers, criminal records, health or financial data, children's data. Don't put them in your profile.
5. **Sensitive documents.** Share them directly with a school or family if you choose. We are not part of that exchange.
6. **Accuracy and authorization.** You confirm your information is true and that you have the right to work or teach as described.
7. **Retention, rights and cross-border transfer.** How long we keep data, how to access, correct, hide or delete it, and where it is processed.
8. **Withdrawal.** One click to hide or delete your profile at any time.
9. **Contact.** You may be contacted by members and can pause that.
10. **Separate, optional marketing consent.**

**Record per consent:** timestamp, document version, language, IP hash, and a hash of the text shown. Re-prompt on any material change.

## Appendix B — Data model sketch

- `countries` (config: currency, tax, payment providers, contact channels, enabled features), `locales`
- `users`, `accounts`, `roles`
- `educator_profiles` (field-level visibility), `educator_consents`, `subjects`, `languages`, `service_areas` (district-level), `availability`, `work_authorization` (enum), `credentials` (self-declared, optional external link)
- `organizations` (schools), `org_members`, `org_claims`, `school_directory` (import source and licence)
- `job_posts` (type: full-time or part-time), `memberships` and `orders` carry a campus count
- `memberships` (holder = organization or family, plan, starts_at, ends_at, price, currency), `payments`, `invoices`
- `contact_reveals` (member, educator, channel, timestamp), `reports`, `moderation_actions`, `audit_log`, `notifications`

## Appendix C — Sources and confidence notes

**Limits of my research.** The web research tool returned search summaries; I could not open competitor or regulator pages directly. I could not find competitors' own pricing. Legal points are pointers for counsel, not legal advice.

- Live site: https://taiwan-school-connect.replit.app (audited 17 Nov 2026: bundle, routes, screenshots)
- Taiwan MOE, 2026 foreign English teacher recruitment (~980): https://english.moe.gov.tw/cp-117-40175-873e6-1.html
- Taiwan cram schools, 17,710 (Taipei Times, 8 Jul 2025): https://www.taipeitimes.com/News/taiwan/archives/2025/07/08/2003839936 · Taiwan News: https://www.taiwannews.com.tw/en/topic/Buxiban
- Teach Away Taiwan: https://www.teachaway.com/teach-in-taiwan · Teast Taiwan listings: https://teast.co/jobs/taiwan/esl-tefl-english
- 1111 / 104 / Pro360 / AmazingTalker comparison: https://blog.104.com.tw/top6-popular-tutoring-platforms/ · https://www.pro360.com.tw/guide/tutoring_platform_compare
- Hong Kong: TutorCircle fees https://tutorcircle.hk/new/en/tutorfee · Tutor Easy https://launch.unwire.hk/en/tutor-easy · TutorHabit https://launch.unwire.hk/en/tutorhabit
- Korea: Kim Gwaoe app listing https://apps.apple.com/kr/app/id1392809044
- Vietnam: https://vietnamteachingjobs.com
- Taiwan Employment Service Act, Art. 34 permits (pages returned by search; not opened): https://laws.gov.taipei/law/Interpretation/Content/FE113590 · https://www.rootlaw.com.tw/LetterContent.aspx?LCode=23&SOID=221685 · MOL law database entry point: https://laws.mol.gov.tw/Eng/FLAWQRY01.aspx?fcode=A008
- Japan MHLW, placement vs information provision: https://www.mhlw.go.jp/stf/shoukaibosyuukubun.html
- Taiwan 7-day cancellation exception: https://english.taichung.gov.tw/10273/10554/10719/731421
- Foreigner tutoring, Taiwan: https://www.taipeitimes.com/News/taiwan/archives/2014/10/22/2003602648 · https://tw.forumosa.com/t/tutoring-newbie-question/161782
- Foreigner tutoring, Korea E-2: https://www.koreatimes.co.kr/amp/southkorea/20100201/exclusive-korea-is-heaven-for-illegal-private-english-tutoring · https://blog.sugar.legal/e2-d2-visas-illegal-employment
- Stripe and Taiwan (conflicting guidance): https://www.shareuhack.com/en/posts/taiwan-indie-dev-global-payments-guide-2026
- Asia data-protection overview: https://www.mineos.ai/articles/the-state-of-data-protection-in-asia
- Market-size spread: https://www.imarcgroup.com/private-tutoring-market
