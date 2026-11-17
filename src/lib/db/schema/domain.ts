import { sql } from "drizzle-orm";
import {
  boolean, check, date, doublePrecision, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid,
} from "drizzle-orm/pg-core";
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
    /** Where the listing came from: 'osm_import', 'gov_open_data', 'manual'. */
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
    createdByUserId: text("created_by_user_id").notNull().references(() => user.id),
    paidAt: ts("paid_at"),
    cancelledAt: ts("cancelled_at"),
    createdAt: createdAt(),
  },
  (t) => [
    check("order_status_check", sql`${t.status} in ('pending','paid','cancelled')`),
    check("order_amount_check", sql`${t.amount} >= 0`),
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
    orderId: uuid("order_id").notNull().unique().references(() => orders.id),
    planCode: text("plan_code").notNull(),
    startsAt: ts("starts_at").notNull(),
    endsAt: ts("ends_at").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    check("membership_term_check", sql`${t.endsAt} > ${t.startsAt}`),
    index("membership_holder_idx").on(t.holderType, t.holderId, t.endsAt),
  ],
);

/** Audit trail of contact reveals. Also feeds the educator's "who contacted me" view. */
export const contactReveals = pgTable(
  "contact_reveals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    educatorId: uuid("educator_id").notNull().references(() => educatorProfiles.id, { onDelete: "cascade" }),
    channels: text("channels").array().notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index("reveal_org_day_idx").on(t.organizationId, t.createdAt),
    index("reveal_educator_idx").on(t.educatorId, t.createdAt),
  ],
);

export type JobType = "full_time" | "part_time" | "substitute";
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

/**
 * Live substitute board. An educator "goes online" for a limited time; schools with an active
 * membership can see who is available and start a chat. One row per educator, replaced each time.
 */
export const substituteAvailability = pgTable(
  "substitute_availability",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    educatorId: uuid("educator_id").notNull().unique().references(() => educatorProfiles.id, { onDelete: "cascade" }),
    availableFrom: ts("available_from").notNull().defaultNow(),
    /** Online while this is in the future (maximum window enforced in code). */
    availableUntil: ts("available_until").notNull(),
    districts: text("districts").array().notNull().default(sql`'{}'::text[]`),
    subjects: text("subjects").array().notNull().default(sql`'{}'::text[]`),
    levels: text("levels").array().notNull().default(sql`'{}'::text[]`),
    /** Short note. Scanned so it cannot carry phone numbers, emails or links. */
    note: text("note"),
    lastHeartbeatAt: ts("last_heartbeat_at").notNull().defaultNow(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("substitute_until_idx").on(t.availableUntil)],
);

export type ConversationStatus = "open" | "blocked" | "closed";

/** A chat between one school (organisation) and one educator. Started by the school. */
export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    educatorId: uuid("educator_id").notNull().references(() => educatorProfiles.id, { onDelete: "cascade" }),
    startedByUserId: text("started_by_user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    status: text("status").$type<ConversationStatus>().notNull().default("open"),
    lastMessageAt: ts("last_message_at").notNull().defaultNow(),
    createdAt: createdAt(),
  },
  (t) => [
    check("conversation_status_check", sql`${t.status} in ('open','blocked','closed')`),
    uniqueIndex("conversation_pair_uq").on(t.organizationId, t.educatorId),
    index("conversation_educator_idx").on(t.educatorId, t.lastMessageAt),
    index("conversation_org_idx").on(t.organizationId, t.lastMessageAt),
  ],
);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
    senderUserId: text("sender_user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: createdAt(),
    readAt: ts("read_at"),
  },
  (t) => [
    check("message_body_check", sql`char_length(${t.body}) between 1 and 2000`),
    index("message_conversation_idx").on(t.conversationId, t.createdAt),
  ],
);
