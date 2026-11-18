import { and, asc, desc, eq, gt, inArray, sql } from "drizzle-orm";
import type { Db } from "@/lib/db";
import { schema } from "@/lib/db";
import type { AccountType } from "@/lib/db/schema/auth";
import { computeNextTerm, type Term } from "@/lib/membership/engine";
import { currencyOf, PLANS, priceForCampuses, TERM_MONTHS, type PlanCode } from "@/lib/plans";
import { generateReferenceCode, normaliseReference } from "./reference";
import { isValidTaxId } from "./tax-id";

const { orders, orderItems, memberships, organizations, orgMembers, auditLog } = schema;

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type Exec = Db | Tx;

export type OrderError =
  | "wrong_account_type"
  | "no_campus"
  | "too_many_campuses"
  | "campus_not_yours"
  | "campus_not_claimed"
  | "campus_suspended"
  | "invalid_tax_id"
  | "invoice_title_required"
  | "invalid_email"
  | "too_many_pending"
  | "not_found"
  | "not_pending"
  | "amount_mismatch"
  | "invalid_date";

export class OrderFailure extends Error {
  constructor(public code: OrderError) {
    super(code);
  }
}

/** A person can have at most this many unpaid orders open at once. Stops junk orders piling up in the admin queue. */
export const MAX_PENDING_ORDERS = 5;
/** A single order can cover at most this many campuses (a chain with more can place two orders). */
export const MAX_CAMPUSES_PER_ORDER = 50;

export interface InvoiceInput {
  /** 統一編號 for a company invoice. Optional: without it we issue a personal invoice. */
  taxId?: string | null;
  title?: string | null;
  email?: string | null;
}

interface CleanInvoice {
  invoiceTaxId: string | null;
  invoiceTitle: string | null;
  invoiceEmail: string | null;
}

export function cleanInvoice(input: InvoiceInput | undefined): CleanInvoice {
  const taxId = (input?.taxId ?? "").replace(/\s+/g, "");
  const title = (input?.title ?? "").trim().slice(0, 120);
  const email = (input?.email ?? "").trim().toLowerCase();
  if (taxId && !isValidTaxId(taxId)) throw new OrderFailure("invalid_tax_id");
  if (taxId && !title) throw new OrderFailure("invoice_title_required");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new OrderFailure("invalid_email");
  return { invoiceTaxId: taxId || null, invoiceTitle: title || null, invoiceEmail: email || null };
}

async function assertPendingRoom(db: Exec, userId: string): Promise<void> {
  const [{ n } = { n: 0 }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(orders)
    .where(and(eq(orders.createdByUserId, userId), eq(orders.status, "pending")));
  if (n >= MAX_PENDING_ORDERS) throw new OrderFailure("too_many_pending");
}

async function insertOrder(db: Exec, v: Omit<typeof orders.$inferInsert, "referenceCode">): Promise<typeof orders.$inferSelect> {
  // The reference is random and the column is unique. ON CONFLICT DO NOTHING (rather than catching the error)
  // keeps the surrounding transaction usable if two codes ever collide.
  for (let attempt = 0; attempt < 5; attempt++) {
    const [row] = await db.insert(orders).values({ ...v, referenceCode: generateReferenceCode() }).onConflictDoNothing({ target: orders.referenceCode }).returning();
    if (row) return row;
  }
  throw new Error("Could not generate a unique order reference");
}

/** A family joins: NT$2,000 for 12 months, paid once by bank transfer. */
export async function createFamilyOrder(db: Db, user: { id: string; accountType: AccountType }, invoice?: InvoiceInput) {
  if (user.accountType !== "family") throw new OrderFailure("wrong_account_type");
  const plan = PLANS.family_tw;
  const inv = cleanInvoice(invoice);
  return db.transaction(async (tx) => {
    await assertPendingRoom(tx, user.id);
    return insertOrder(tx, {
      holderType: "user",
      holderId: user.id,
      planCode: plan.code,
      amount: priceForCampuses(plan, 1),
      campuses: 1,
      currency: currencyOf(plan),
      countryCode: plan.countryCode,
      provider: "bank_transfer",
      createdByUserId: user.id,
      ...inv,
    });
  });
}

/**
 * A school buys one or more campuses: NT$10,000 per campus, each for its own full 12 months. There is no discount
 * for extra campuses and no proration. The buyer must belong to every campus they are paying for.
 */
export async function createSchoolOrder(db: Db, user: { id: string; accountType: AccountType }, organizationIds: readonly string[], invoice?: InvoiceInput) {
  if (user.accountType !== "school") throw new OrderFailure("wrong_account_type");
  const ids = [...new Set(organizationIds)];
  if (ids.length === 0) throw new OrderFailure("no_campus");
  if (ids.length > MAX_CAMPUSES_PER_ORDER) throw new OrderFailure("too_many_campuses");
  const plan = PLANS.school_tw;
  const inv = cleanInvoice(invoice);
  return db.transaction(async (tx) => {
    const mine = await tx
      .select({ id: organizations.id, status: organizations.status })
      .from(organizations)
      .innerJoin(orgMembers, and(eq(orgMembers.organizationId, organizations.id), eq(orgMembers.userId, user.id)))
      .where(inArray(organizations.id, ids));
    if (mine.length !== ids.length) throw new OrderFailure("campus_not_yours");
    if (mine.some((o) => o.status === "suspended")) throw new OrderFailure("campus_suspended");
    if (mine.some((o) => o.status !== "claimed")) throw new OrderFailure("campus_not_claimed");
    await assertPendingRoom(tx, user.id);
    const order = await insertOrder(tx, {
      // The buyer holds the order; each campus gets its own membership (holder = that campus) when it is paid.
      holderType: "user",
      holderId: user.id,
      planCode: plan.code,
      amount: priceForCampuses(plan, ids.length),
      campuses: ids.length,
      currency: currencyOf(plan),
      countryCode: plan.countryCode,
      provider: "bank_transfer",
      createdByUserId: user.id,
      ...inv,
    });
    await tx.insert(orderItems).values(ids.map((organizationId) => ({ orderId: order.id, organizationId })));
    return order;
  });
}

export interface OrderView {
  id: string;
  status: "pending" | "paid" | "cancelled";
  planCode: PlanCode;
  amount: number;
  currency: string;
  campuses: number;
  referenceCode: string;
  createdAt: Date;
  paidAt: Date | null;
  invoice: { taxId: string | null; title: string | null; email: string | null };
  campusList: { id: string; name: string; district: string | null; city: string | null }[];
}

async function toViews(db: Exec, rows: (typeof orders.$inferSelect)[]): Promise<OrderView[]> {
  if (rows.length === 0) return [];
  const items = await db
    .select({ orderId: orderItems.orderId, id: organizations.id, name: organizations.name, district: organizations.district, city: organizations.city })
    .from(orderItems)
    .innerJoin(organizations, eq(orderItems.organizationId, organizations.id))
    .where(inArray(orderItems.orderId, rows.map((r) => r.id)))
    .orderBy(asc(organizations.name));
  return rows.map((r) => ({
    id: r.id,
    status: r.status,
    planCode: r.planCode as PlanCode,
    amount: r.amount,
    currency: r.currency,
    campuses: r.campuses,
    referenceCode: r.referenceCode,
    createdAt: r.createdAt,
    paidAt: r.paidAt,
    invoice: { taxId: r.invoiceTaxId, title: r.invoiceTitle, email: r.invoiceEmail },
    campusList: items.filter((i) => i.orderId === r.id).map((i) => ({ id: i.id, name: i.name, district: i.district, city: i.city })),
  }));
}

/** The buyer's own orders, newest first. */
export async function listOrdersForUser(db: Db, userId: string): Promise<OrderView[]> {
  const rows = await db.select().from(orders).where(eq(orders.createdByUserId, userId)).orderBy(desc(orders.createdAt)).limit(50);
  return toViews(db, rows);
}

/** One order, only for the person who placed it. Anyone else gets null (the page shows "not found"). */
export async function getOrderForUser(db: Db, userId: string, orderId: string): Promise<OrderView | null> {
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) return null;
  const [row] = await db.select().from(orders).where(and(eq(orders.id, orderId), eq(orders.createdByUserId, userId))).limit(1);
  return row ? (await toViews(db, [row]))[0]! : null;
}

/** The buyer cancels their own unpaid order. A paid order cannot be cancelled here. */
export async function cancelOwnOrder(db: Db, userId: string, orderId: string, now: Date = new Date()): Promise<void> {
  const res = await db
    .update(orders)
    .set({ status: "cancelled", cancelledAt: now })
    .where(and(eq(orders.id, orderId), eq(orders.createdByUserId, userId), eq(orders.status, "pending")))
    .returning({ id: orders.id });
  if (res.length === 0) throw new OrderFailure("not_pending");
}

export interface AdminOrderView extends OrderView {
  buyerEmail: string | null;
  buyerName: string | null;
}

/** Admin queue: unpaid orders, oldest first, with who placed each. */
export async function listPendingOrdersForAdmin(db: Db): Promise<AdminOrderView[]> {
  const rows = await db
    .select({ order: orders, email: schema.user.email, name: schema.user.name })
    .from(orders)
    .leftJoin(schema.user, eq(schema.user.id, orders.createdByUserId))
    .where(eq(orders.status, "pending"))
    .orderBy(asc(orders.createdAt))
    .limit(200);
  const views = await toViews(db, rows.map((r) => r.order));
  return views.map((v, i) => ({ ...v, buyerEmail: rows[i]!.email, buyerName: rows[i]!.name }));
}

/** Admin looks an order up by the reference a payer quoted (case, spaces and dashes do not matter). */
export async function findOrderByReference(db: Db, reference: string): Promise<AdminOrderView | null> {
  const [row] = await db
    .select({ order: orders, email: schema.user.email, name: schema.user.name })
    .from(orders)
    .leftJoin(schema.user, eq(schema.user.id, orders.createdByUserId))
    .where(eq(orders.referenceCode, normaliseReference(reference)))
    .limit(1);
  if (!row) return null;
  const [v] = await toViews(db, [row.order]);
  return { ...v!, buyerEmail: row.email, buyerName: row.name };
}

export interface ConfirmInput {
  /** Amount the admin saw arrive in the bank. Must equal the order total: a short payment is not confirmed. */
  receivedAmount: number;
  /** Date shown on the bank statement (YYYY-MM-DD). */
  receivedOn: string;
  note?: string;
}

export interface ConfirmResult {
  order: typeof orders.$inferSelect;
  /** One per campus (school) or one for the family. */
  terms: { holderType: "org" | "user"; holderId: string; startsAt: Date; endsAt: Date }[];
  /** False when the order was already paid: nothing changed and no second membership was created. */
  created: boolean;
}

/**
 * An admin confirms that the bank transfer arrived. In one transaction: lock the order, check the amount, create
 * a 12-month membership per campus (stacking after any term the campus still has, so nobody loses days by renewing
 * early), mark the order paid and write the audit trail. Confirming twice is safe: the second call changes nothing.
 */
export async function confirmOrderPaid(db: Db, orderId: string, adminUserId: string, input: ConfirmInput, now: Date = new Date()): Promise<ConfirmResult> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.receivedOn) || Number.isNaN(Date.parse(input.receivedOn))) throw new OrderFailure("invalid_date");
  return db.transaction(async (tx) => {
    // FOR UPDATE: two admins pressing the button at once must not create two sets of memberships.
    const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update").limit(1);
    if (!order) throw new OrderFailure("not_found");
    if (order.status === "paid") {
      const existing = await tx.select().from(memberships).where(eq(memberships.orderId, order.id));
      return { order, terms: existing.map((m) => ({ holderType: m.holderType, holderId: m.holderId, startsAt: m.startsAt, endsAt: m.endsAt })), created: false };
    }
    if (order.status !== "pending") throw new OrderFailure("not_pending");
    if (input.receivedAmount !== order.amount) throw new OrderFailure("amount_mismatch");

    const isSchool = PLANS[order.planCode as PlanCode]?.audience === "school";
    const holders: { holderType: "org" | "user"; holderId: string }[] = !isSchool
      ? [{ holderType: "user", holderId: order.holderId }]
      : (await tx.select({ id: orderItems.organizationId }).from(orderItems).where(eq(orderItems.orderId, order.id))).map((i) => ({ holderType: "org" as const, holderId: i.id }));

    if (holders.length === 0) throw new Error(`Order ${order.id} has no campuses; refusing to mark it paid`);
    const terms: ConfirmResult["terms"] = [];
    for (const h of holders) {
      // Existing terms that have not yet ended; the new term starts after the latest of them.
      const existing: Term[] = await tx
        .select({ startsAt: memberships.startsAt, endsAt: memberships.endsAt })
        .from(memberships)
        .where(and(eq(memberships.holderType, h.holderType), eq(memberships.holderId, h.holderId), gt(memberships.endsAt, now)));
      const term = computeNextTerm(existing, now, TERM_MONTHS);
      await tx.insert(memberships).values({ holderType: h.holderType, holderId: h.holderId, orderId: order.id, planCode: order.planCode, campuses: 1, startsAt: term.startsAt, endsAt: term.endsAt });
      terms.push({ ...h, ...term });
    }

    const [paid] = await tx
      .update(orders)
      .set({ status: "paid", paidAt: now, paidAmount: input.receivedAmount, paidOn: input.receivedOn, paidNote: input.note?.trim().slice(0, 300) || null, confirmedBy: adminUserId })
      .where(eq(orders.id, order.id))
      .returning();
    await tx.insert(auditLog).values({ actorUserId: adminUserId, action: "order.confirmed", entityType: "order", entityId: order.id, meta: { reference: order.referenceCode, amount: order.amount, campuses: holders.length } });
    return { order: paid!, terms, created: true };
  });
}

/** Admin cancels an unpaid order (wrong amount, duplicate, buyer asked). A paid order is never cancelled here. */
export async function adminCancelOrder(db: Db, orderId: string, adminUserId: string, now: Date = new Date()): Promise<void> {
  await db.transaction(async (tx) => {
    const res = await tx.update(orders).set({ status: "cancelled", cancelledAt: now }).where(and(eq(orders.id, orderId), eq(orders.status, "pending"))).returning({ id: orders.id });
    if (res.length === 0) throw new OrderFailure("not_pending");
    await tx.insert(auditLog).values({ actorUserId: adminUserId, action: "order.cancelled", entityType: "order", entityId: orderId });
  });
}

export interface HolderMembership {
  active: boolean;
  /** The end of the latest term (active or upcoming), or null if the holder never paid. */
  endsAt: Date | null;
  startsAt: Date | null;
}

/** Where a family or a campus stands: active now, expired, or never paid. */
export async function getHolderMembership(db: Db, holderType: "org" | "user", holderId: string, now: Date = new Date()): Promise<HolderMembership> {
  const rows = await db.select({ startsAt: memberships.startsAt, endsAt: memberships.endsAt }).from(memberships).where(and(eq(memberships.holderType, holderType), eq(memberships.holderId, holderId))).orderBy(desc(memberships.endsAt));
  if (rows.length === 0) return { active: false, endsAt: null, startsAt: null };
  const current = rows.find((r) => r.startsAt <= now && now < r.endsAt);
  const latest = rows[0]!;
  return { active: !!current, endsAt: latest.endsAt, startsAt: (current ?? latest).startsAt };
}
