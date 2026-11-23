import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "@/lib/db";
import { schema } from "@/lib/db";
import type { RefundMethod } from "@/lib/db/schema/domain";
import { OrderFailure } from "./orders";

const { orders, orderRefunds, memberships, organizations, auditLog } = schema;

export const REFUND_METHODS: readonly RefundMethod[] = ["ecpay_backoffice", "bank_transfer", "other"];
export const MAX_REASON_LENGTH = 300;

export interface RefundInput {
  /** A random id the form was rendered with. A double click or a retry with the same id records only once. */
  requestId: string;
  /** NT$ handed back to the buyer. 0 = no money moves (only end the memberships ticked below). */
  amount: number;
  /** How the money was sent back. Required when `amount` is above 0. */
  method: RefundMethod | null;
  /** The day the money was sent back (YYYY-MM-DD). Required when `amount` is above 0. */
  refundedOn: string | null;
  /** Why. Always required: it is the record the owner and the accountant will read later. */
  reason: string;
  /** Memberships of THIS order to end right now (one per campus for a school, the one for a family). */
  endMembershipIds: readonly string[];
}

export interface RefundResult {
  orderId: string;
  referenceCode: string;
  /** False when this exact request had already been recorded: nothing changed. */
  applied: boolean;
  /** NT$ recorded by this call. */
  refunded: number;
  /** NT$ refunded on this order in total, including earlier refunds. */
  totalRefunded: number;
  ended: { id: string; holderType: "org" | "user"; holderId: string; wouldHaveEndedAt: Date }[];
}

const isDay = (s: string | null): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

/**
 * An admin records that a buyer was refunded and/or ends memberships early.
 *
 * This site never moves money. The admin sends the money back first (ECPay's merchant back office, or a bank transfer)
 * and then records it here, so the books and the buyer's order page agree. In one transaction: lock the order, check the
 * amount cannot exceed what was paid, end the chosen memberships right now (every "is this member active?" check
 * then says no at once, and the date it would have ended on is kept), and write the audit trail. The order itself stays
 * "paid"; refund state is read from `order_refunds`. Recording the same request twice changes nothing.
 */
export async function refundAndEnd(db: Db, orderId: string, adminUserId: string, input: RefundInput, now: Date = new Date()): Promise<RefundResult> {
  const reason = input.reason.trim().slice(0, MAX_REASON_LENGTH);
  if (!reason) throw new OrderFailure("reason_required");
  if (!Number.isInteger(input.amount) || input.amount < 0) throw new OrderFailure("invalid_amount");
  if (input.requestId.length < 8 || input.requestId.length > 80) throw new OrderFailure("invalid_request");
  if (input.amount > 0 && (!input.method || !REFUND_METHODS.includes(input.method))) throw new OrderFailure("method_required");
  if (input.amount > 0 && !isDay(input.refundedOn)) throw new OrderFailure("invalid_date");
  const endIds = [...new Set(input.endMembershipIds)];
  if (input.amount === 0 && endIds.length === 0) throw new OrderFailure("nothing_to_do");

  return db.transaction(async (tx) => {
    // FOR UPDATE: two admins (or one double click) must not both refund the same money.
    const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update").limit(1);
    if (!order) throw new OrderFailure("not_found");
    if (order.status !== "paid") throw new OrderFailure("not_paid");

    const [done] = await tx.select({ id: orderRefunds.id, orderId: orderRefunds.orderId, amount: orderRefunds.amount }).from(orderRefunds).where(eq(orderRefunds.requestId, input.requestId)).limit(1);
    const refundedBefore = await totalRefunded(tx, order.id);
    if (done) {
      if (done.orderId !== order.id) throw new OrderFailure("invalid_request");
      return { orderId: order.id, referenceCode: order.referenceCode, applied: false, refunded: 0, totalRefunded: refundedBefore, ended: [] };
    }

    const paid = order.paidAmount ?? order.amount;
    if (input.amount > paid - refundedBefore) throw new OrderFailure("too_much");

    const rows = endIds.length === 0 ? [] : await tx.select().from(memberships).where(and(eq(memberships.orderId, order.id), inArray(memberships.id, endIds)));
    if (rows.length !== endIds.length) throw new OrderFailure("membership_not_found");
    if (rows.some((m) => m.endedEarlyAt || m.endsAt <= now)) throw new OrderFailure("membership_not_active");

    // endsAt is pulled back to now. A term that had not started yet (stacked after another one) would then end before
    // it begins, which the table forbids, so its start is moved back a second too: it becomes a term that never ran.
    const ended: RefundResult["ended"] = [];
    for (const m of rows) {
      await tx
        .update(memberships)
        .set({ originalEndsAt: m.endsAt, endsAt: now, startsAt: sql`least(${memberships.startsAt}, ${new Date(now.getTime() - 1000)})`, endedEarlyAt: now, endedEarlyBy: adminUserId, endedEarlyReason: reason })
        .where(eq(memberships.id, m.id));
      ended.push({ id: m.id, holderType: m.holderType, holderId: m.holderId, wouldHaveEndedAt: m.endsAt });
      await tx.insert(auditLog).values({
        actorUserId: adminUserId,
        action: "membership.ended_early",
        entityType: "membership",
        entityId: m.id,
        meta: { orderId: order.id, reference: order.referenceCode, holderType: m.holderType, holderId: m.holderId, startedAt: m.startsAt.toISOString(), wouldHaveEndedAt: m.endsAt.toISOString(), reason },
      });
    }

    if (input.amount > 0) {
      await tx.insert(orderRefunds).values({ orderId: order.id, amount: input.amount, method: input.method!, refundedOn: input.refundedOn!, reason, requestId: input.requestId, createdBy: adminUserId });
      await tx.insert(auditLog).values({
        actorUserId: adminUserId,
        action: "order.refunded",
        entityType: "order",
        entityId: order.id,
        meta: { reference: order.referenceCode, amount: input.amount, method: input.method, refundedOn: input.refundedOn, reason, totalRefunded: refundedBefore + input.amount, paid, endedMemberships: ended.length },
      });
    }
    return { orderId: order.id, referenceCode: order.referenceCode, applied: true, refunded: input.amount, totalRefunded: refundedBefore + input.amount, ended };
  });
}

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

async function totalRefunded(db: Db | Tx, orderId: string): Promise<number> {
  const [row] = await db.select({ n: sql<number>`coalesce(sum(${orderRefunds.amount}), 0)::int` }).from(orderRefunds).where(eq(orderRefunds.orderId, orderId));
  return row?.n ?? 0;
}

export type MembershipState = "active" | "upcoming" | "expired" | "ended_early";

export interface OrderMembershipView {
  id: string;
  holderType: "org" | "user";
  /** The campus name for a school; null for a family. */
  campus: string | null;
  startsAt: Date;
  endsAt: Date;
  state: MembershipState;
  endedEarlyAt: Date | null;
  endedEarlyReason: string | null;
  /** The date it would have run to, when it was ended early. */
  originalEndsAt: Date | null;
}

export interface OrderRefundState {
  paid: number;
  refunded: number;
  /** What can still be refunded on this order. */
  refundable: number;
  refunds: { id: string; amount: number; method: RefundMethod; refundedOn: string; reason: string; createdAt: Date }[];
  memberships: OrderMembershipView[];
}

/** What the admin sees on a paid order: money paid, money already handed back, and each membership's standing. */
export async function getOrderRefundState(db: Db, orderId: string, now: Date = new Date()): Promise<OrderRefundState | null> {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) return null;
  const refunds = await db.select().from(orderRefunds).where(eq(orderRefunds.orderId, orderId)).orderBy(asc(orderRefunds.createdAt));
  const rows = await db
    .select({ m: memberships, campus: organizations.name })
    .from(memberships)
    .leftJoin(organizations, and(eq(memberships.holderType, "org"), sql`${organizations.id}::text = ${memberships.holderId}`))
    .where(eq(memberships.orderId, orderId))
    .orderBy(asc(organizations.name), asc(memberships.startsAt));
  const paid = order.paidAmount ?? order.amount;
  const refunded = refunds.reduce((a, r) => a + r.amount, 0);
  return {
    paid,
    refunded,
    refundable: Math.max(0, paid - refunded),
    refunds: refunds.map((r) => ({ id: r.id, amount: r.amount, method: r.method, refundedOn: r.refundedOn, reason: r.reason, createdAt: r.createdAt })),
    memberships: rows.map(({ m, campus }) => ({
      id: m.id,
      holderType: m.holderType,
      campus,
      startsAt: m.startsAt,
      endsAt: m.endsAt,
      state: m.endedEarlyAt ? "ended_early" : m.endsAt <= now ? "expired" : m.startsAt > now ? "upcoming" : "active",
      endedEarlyAt: m.endedEarlyAt,
      endedEarlyReason: m.endedEarlyReason,
      originalEndsAt: m.originalEndsAt,
    })),
  };
}

export interface RecentPaidOrder {
  id: string;
  referenceCode: string;
  amount: number;
  campuses: number;
  planCode: string;
  paidAt: Date | null;
  buyerEmail: string | null;
  refunded: number;
}

/** The latest paid orders, so an admin can open one without having to look up its reference first. */
export async function listRecentPaidOrders(db: Db, limit = 10): Promise<RecentPaidOrder[]> {
  const rows = await db
    .select({ o: orders, email: schema.user.email, refunded: sql<number>`coalesce((select sum(${orderRefunds.amount}) from ${orderRefunds} where ${orderRefunds.orderId} = ${orders.id}), 0)::int` })
    .from(orders)
    .leftJoin(schema.user, eq(schema.user.id, orders.createdByUserId))
    .where(eq(orders.status, "paid"))
    .orderBy(desc(orders.paidAt))
    .limit(limit);
  return rows.map((r) => ({ id: r.o.id, referenceCode: r.o.referenceCode, amount: r.o.paidAmount ?? r.o.amount, campuses: r.o.campuses, planCode: r.o.planCode, paidAt: r.o.paidAt, buyerEmail: r.email, refunded: r.refunded }));
}
