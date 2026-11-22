import { sql } from "drizzle-orm";
import { boolean, check, date, doublePrecision, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";

const ts = (name: string) => timestamp(name, { withTimezone: true });
const createdAt = () => ts("created_at").notNull().defaultNow();
const updatedAt = () => ts("updated_at").notNull().defaultNow().$onUpdate(() => new Date());

export type ProfileStatus = "draft" | "published" | "hidden" | "suspended";
export interface Credential {
  /** Free-text label such as "TEFL 120h" or "B.Ed., NTNU". Self-declared. */
  label: string;
  year?: number;
  /** Optional link to proof hosted by a third party. We store the link, never the document. */
  proofUrl?: string;
}

/**
 * Member-visible educator profile. NOTHING here is ever public: only logged-in members with an
 * active membership may read it, and it is never indexed by search engines. Contact details live
 * in `educator_contacts` and are revealed one educator at a time (logged, capped per day).
 */
export const educatorProfiles = pgTable(
  "educator_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull().unique().references(() => user.id, { onDelete: "cascade" }),
    countryCode: text("country_code").notNull().default("TW"),
    displayName: text("display_name").notNull(),
    headline: text("headline"),
    bio: text("bio"),
    photoKey: text("photo_key"),
    status: text("status").$type<ProfileStatus>().notNull().default("draft"),
    currentCountry: text("current_country"),
    openToCountries: text("open_to_countries").array().notNull().default(sql`'{}'::text[]`),
    city: text("city"),
    districts: text("districts").array().notNull().default(sql`'{}'::text[]`),
    subjects: text("subjects").array().notNull().default(sql`'{}'::text[]`),
    levels: text("levels").array().notNull().default(sql`'{}'::text[]`),
    languages: text("languages").array().notNull().default(sql`'{}'::text[]`),
    teachingModes: text("teaching_modes").array().notNull().default(sql`'{}'::text[]`),
    openTo: text("open_to").array().notNull().default(sql`'{}'::text[]`),
    workAuthorization: text("work_authorization"),
    experienceBand: text("experience_band"),
    /** Hourly rate range in the country's currency (TWD for Taiwan). Tutors only. */
    rateMin: integer("rate_min"),
    rateMax: integer("rate_max"),
    credentials: jsonb("credentials").$type<Credential[]>().notNull().default(sql`'[]'::jsonb`),
    publishedAt: ts("published_at"),
    hiddenAt: ts("hidden_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check("educator_status_check", sql`${t.status} in ('draft','published','hidden','suspended')`),
    check("educator_rate_check", sql`${t.rateMin} is null or ${t.rateMax} is null or ${t.rateMin} <= ${t.rateMax}`),
    index("educator_status_country_idx").on(t.status, t.countryCode),
    index("educator_city_idx").on(t.city),
    index("educator_subjects_gin").using("gin", t.subjects),
    index("educator_levels_gin").using("gin", t.levels),
    index("educator_districts_gin").using("gin", t.districts),
  ],
);

/** Member-only contact details. Only the reveal service may read this table. */
export const educatorContacts = pgTable(
  "educator_contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    educatorId: uuid("educator_id").notNull().references(() => educatorProfiles.id, { onDelete: "cascade" }),
    channel: text("channel").notNull(),
    value: text("value").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("educator_contact_channel_uq").on(t.educatorId, t.channel)],
);

/** Append-only record of what an educator agreed to, in which wording, in which language. */
export const educatorConsents = pgTable(
  "educator_consents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    documentKey: text("document_key").notNull(),
    documentVersion: text("document_version").notNull(),
    locale: text("locale").notNull(),
    /** SHA-256 of the exact text shown, so the wording can be proven later. */
    textHash: text("text_hash").notNull(),
    /** The exact words shown (flattened), kept so the agreement can be proven even if the copy changes later. */
    textSnapshot: text("text_snapshot").notNull(),
    items: jsonb("items").$type<Record<string, boolean>>().notNull(),
    ipHash: text("ip_hash"),
    createdAt: createdAt(),
    withdrawnAt: ts("withdrawn_at"),
  },
  (t) => [index("consent_user_idx").on(t.userId, t.createdAt)],
);

export type OrgStatus = "unclaimed" | "claimed" | "suspended";

export const organizations = pgTable(
  "organizations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    countryCode: text("country_code").notNull().default("TW"),
    name: text("name").notNull(),
    nameEn: text("name_en"),
    type: text("type").notNull(),
    city: text("city"),
    district: text("district"),
    address: text("address"),
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    website: text("website"),
    /** Government (public) or private school, from the Ministry of Education lists. Null when we do not know (for example a campus a school added itself). */
    ownership: text("ownership").$type<"public" | "private">(),
    /** The school's own statement that it teaches bilingually or runs English-immersion classes. Not checked by us. */
    bilingual: boolean("bilingual").notNull().default(false),
    /** Where the listing came from: 'osm_import', 'gov_open_data' (licensed cram schools), 'moe_open_data' (Ministry of Education school lists), 'manual'. */
    source: text("source").notNull().default("manual"),
    sourceId: text("source_id"),
    status: text("status").$type<OrgStatus>().notNull().default("unclaimed"),
    claimedAt: ts("claimed_at"),
    /** Private to the claiming organisation and admins. */
    contactEmail: text("contact_email"),
    contactPhone: text("contact_phone"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check("org_status_check", sql`${t.status} in ('unclaimed','claimed','suspended')`),
    check("org_ownership_check", sql`${t.ownership} is null or ${t.ownership} in ('public','private')`),
    uniqueIndex("org_source_uq").on(t.source, t.sourceId).where(sql`${t.sourceId} is not null`),
    index("org_city_type_idx").on(t.city, t.type),
    index("org_status_idx").on(t.status),
  ],
);

export type ClaimStatus = "pending" | "approved" | "rejected";

export const orgClaims = pgTable(
  "org_claims",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    contactName: text("contact_name").notNull(),
    contactRole: text("contact_role").notNull(),
    contactPhone: text("contact_phone").notNull(),
    note: text("note"),
    /** Ticked by the claimant: "we teach bilingually". Copied to the campus when an administrator approves the claim. */
    bilingual: boolean("bilingual").notNull().default(false),
    status: text("status").$type<ClaimStatus>().notNull().default("pending"),
    reviewedBy: text("reviewed_by"),
    reviewedAt: ts("reviewed_at"),
    createdAt: createdAt(),
  },
  (t) => [
    check("claim_status_check", sql`${t.status} in ('pending','approved','rejected')`),
    uniqueIndex("claim_pending_uq").on(t.organizationId, t.userId).where(sql`${t.status} = 'pending'`),
    index("claim_status_idx").on(t.status, t.createdAt),
  ],
);

export const orgMembers = pgTable(
  "org_members",
  {
    organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    role: text("role").$type<"owner" | "member">().notNull().default("member"),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.organizationId, t.userId] }), index("org_member_user_idx").on(t.userId)],
);

export type HolderType = "org" | "user";
export type OrderStatus = "pending" | "paid" | "cancelled";

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    holderType: text("holder_type").$type<HolderType>().notNull(),
    holderId: text("holder_id").notNull(),
    planCode: text("plan_code").notNull(),
    /** Amount in the currency's major unit (TWD has no minor unit). Tax-inclusive. */
    amount: integer("amount").notNull(),
    /** Number of campuses bought (schools): total = NT$10,000 x campuses, each for its own 12 months. Families: 1. */
    campuses: integer("campuses").notNull().default(1),
    currency: text("currency").notNull(),
    countryCode: text("country_code").notNull(),
    status: text("status").$type<OrderStatus>().notNull().default("pending"),
    provider: text("provider").notNull(),
    providerRef: text("provider_ref"),
    /** Human-readable code the payer quotes on a bank transfer. */
    referenceCode: text("reference_code").notNull().unique(),
    /** Taiwan uniform invoice number (統一編號), 8 digits, optional. */
    invoiceTaxId: text("invoice_tax_id"),
    invoiceTitle: text("invoice_title"),
    invoiceEmail: text("invoice_email"),
    /** Who placed the order. Null after that person deleted their account: the order stays as a business record. */
    createdByUserId: text("created_by_user_id").references(() => user.id, { onDelete: "set null" }),
    paidAt: ts("paid_at"),
    cancelledAt: ts("cancelled_at"),
    /** What an admin recorded when matching the bank transfer. */
    paidAmount: integer("paid_amount"),
    paidOn: date("paid_on"),
    paidNote: text("paid_note"),
    confirmedBy: text("confirmed_by"),
    createdAt: createdAt(),
  },
  (t) => [
    check("order_status_check", sql`${t.status} in ('pending','paid','cancelled')`),
    check("order_amount_check", sql`${t.amount} >= 0`),
    check("order_campuses_check", sql`${t.campuses} >= 1`),
    index("order_holder_idx").on(t.holderType, t.holderId),
    index("order_status_idx").on(t.status, t.createdAt),
  ],
);

/** One row per purchased 12-month term. Stacked renewals create consecutive rows. */
export const memberships = pgTable(
  "memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    holderType: text("holder_type").$type<HolderType>().notNull(),
    holderId: text("holder_id").notNull(),
    orderId: uuid("order_id").notNull().references(() => orders.id),
    planCode: text("plan_code").notNull(),
    campuses: integer("campuses").notNull().default(1),
    startsAt: ts("starts_at").notNull(),
    endsAt: ts("ends_at").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    check("membership_term_check", sql`${t.endsAt} > ${t.startsAt}`),
    index("membership_holder_idx").on(t.holderType, t.holderId, t.endsAt),
    index("membership_order_idx").on(t.orderId),
  ],
);

/** Audit trail of contact reveals. Also feeds the educator's "who contacted me" view. */
export const contactReveals = pgTable(
  "contact_reveals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    /** The campus that revealed it (schools). Null for a family, whose daily cap is counted per user. */
    organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "cascade" }),
    audience: text("audience").$type<"school" | "family">().notNull().default("school"),
    educatorId: uuid("educator_id").notNull().references(() => educatorProfiles.id, { onDelete: "cascade" }),
    channels: text("channels").array().notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index("reveal_org_day_idx").on(t.organizationId, t.createdAt),
    index("reveal_user_day_idx").on(t.userId, t.createdAt),
    index("reveal_educator_idx").on(t.educatorId, t.createdAt),
  ],
);

/** Which campuses an order pays for (a school order lists one row per campus; each gets its own 12 months). */
export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  },
  (t) => [uniqueIndex("order_item_uq").on(t.orderId, t.organizationId)],
);

export type AttemptStatus = "created" | "awaiting" | "paid" | "failed";

/** One trip to an online payment page (ECPay). An order can have several: a buyer who leaves and returns starts a new one. */
export const paymentAttempts = pgTable(
  "payment_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
    provider: text("provider").notNull().default("ecpay"),
    /** What we call it at the provider (ECPay MerchantTradeNo). Unique, never reused. */
    merchantTradeNo: text("merchant_trade_no").notNull().unique(),
    amount: integer("amount").notNull(),
    status: text("status").$type<AttemptStatus>().notNull().default("created"),
    /** The provider's own transaction number (ECPay TradeNo), once it tells us. */
    providerTradeNo: text("provider_trade_no"),
    paymentType: text("payment_type"),
    rtnCode: integer("rtn_code"),
    rtnMsg: text("rtn_msg"),
    /** ATM virtual account / convenience-store code to show the buyer on the order page. */
    paymentInfo: jsonb("payment_info").$type<{ bankCode?: string; vAccount?: string; paymentNo?: string; expireDate?: string }>(),
    paidAt: ts("paid_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check("attempt_status_check", sql`${t.status} in ('created','awaiting','paid','failed')`),
    index("attempt_order_idx").on(t.orderId, t.createdAt),
  ],
);

export type PaymentOutcome = "applied" | "duplicate" | "ignored" | "invalid" | "needs_review";

/** Everything the provider sends us, kept as received (append-only) so any money question can be answered later. */
export const paymentEvents = pgTable(
  "payment_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    provider: text("provider").notNull().default("ecpay"),
    kind: text("kind").$type<"result" | "info" | "return">().notNull(),
    merchantTradeNo: text("merchant_trade_no"),
    /** Did the signature check out? Only valid events can change anything. */
    valid: boolean("valid").notNull(),
    simulated: boolean("simulated").notNull().default(false),
    outcome: text("outcome").$type<PaymentOutcome>().notNull(),
    note: text("note"),
    payload: jsonb("payload").$type<Record<string, string>>().notNull(),
    receivedAt: createdAt(),
    reviewedAt: ts("reviewed_at"),
    reviewedBy: text("reviewed_by"),
  },
  (t) => [index("payment_event_trade_idx").on(t.merchantTradeNo, t.receivedAt), index("payment_event_review_idx").on(t.outcome, t.reviewedAt)],
);

/** Which renewal reminders (60/30/7/0 days before the end) have been sent, so none is sent twice. */
export const membershipReminders = pgTable(
  "membership_reminders",
  {
    membershipId: uuid("membership_id").notNull().references(() => memberships.id, { onDelete: "cascade" }),
    daysBefore: integer("days_before").notNull(),
    sentAt: ts("sent_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.membershipId, t.daysBefore] })],
);

export type JobType = "full_time" | "part_time";
export type JobStatus = "open" | "closed";

export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    type: text("type").$type<JobType>().notNull(),
    description: text("description"),
    subjects: text("subjects").array().notNull().default(sql`'{}'::text[]`),
    levels: text("levels").array().notNull().default(sql`'{}'::text[]`),
    city: text("city"),
    district: text("district"),
    salaryMin: integer("salary_min"),
    salaryMax: integer("salary_max"),
    salaryUnit: text("salary_unit").$type<"month" | "hour">(),
    startsOn: date("starts_on"),
    /** Set when an admin removed the post after a report. A school cannot reopen a removed post. */
    removedAt: ts("removed_at"),
    /** How an educator should respond (email, phone, LINE...). Shown only to signed-in educators with a profile. */
    applyContact: text("apply_contact"),
    status: text("status").$type<JobStatus>().notNull().default("open"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check("job_status_check", sql`${t.status} in ('open','closed')`),
    index("job_open_idx").on(t.status, t.city, t.createdAt),
    index("job_org_idx").on(t.organizationId),
  ],
);

export type ReportTarget = "educator" | "organization" | "job";
export type ReportStatus = "open" | "actioned" | "dismissed";

export const reports = pgTable(
  "reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reporterUserId: text("reporter_user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    targetType: text("target_type").$type<ReportTarget>().notNull(),
    targetId: text("target_id").notNull(),
    reason: text("reason").notNull(),
    details: text("details"),
    status: text("status").$type<ReportStatus>().notNull().default("open"),
    resolvedBy: text("resolved_by"),
    resolvedAt: ts("resolved_at"),
    createdAt: createdAt(),
  },
  (t) => [
    check("report_status_check", sql`${t.status} in ('open','actioned','dismissed')`),
    index("report_status_idx").on(t.status, t.createdAt),
    index("report_target_idx").on(t.targetType, t.targetId),
    // One open report per person and target: pressing the button twice does not queue two.
    uniqueIndex("report_open_uq").on(t.reporterUserId, t.targetType, t.targetId).where(sql`${t.status} = 'open'`),
  ],
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorUserId: text("actor_user_id"),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    meta: jsonb("meta").$type<Record<string, unknown>>(),
    createdAt: createdAt(),
  },
  (t) => [index("audit_entity_idx").on(t.entityType, t.entityId, t.createdAt)],
);

export const waitlistSignups = pgTable(
  "waitlist_signups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    countryCode: text("country_code").notNull(),
    audience: text("audience").$type<"educator" | "school" | "family">().notNull(),
    locale: text("locale").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("waitlist_uq").on(t.email, t.countryCode, t.audience)],
);

