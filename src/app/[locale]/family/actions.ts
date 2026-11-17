"use server";

import { revalidatePath } from "next/cache";
import { afterOrderPlaced, invoiceFrom, type CheckoutPayload } from "@/lib/billing/checkout";
import { createFamilyOrder, OrderFailure, type OrderError } from "@/lib/billing/orders";
import { getCurrentUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { allow } from "@/lib/rate-limit";

export type CheckoutResult = { ok: true; orderId: string } | { ok: false; error: OrderError | "ack" | "rate" | "server" | "signin" };

export async function createFamilyOrderAction(p: CheckoutPayload): Promise<CheckoutResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "signin" };
  if (p.acknowledged !== true) return { ok: false, error: "ack" };
  if (!allow(`order:${user.id}`, 10, 60 * 60_000)) return { ok: false, error: "rate" };
  try {
    const db = getDb();
    const order = await createFamilyOrder(db, user, invoiceFrom(p.invoice));
    await afterOrderPlaced(db, user, order);
    revalidatePath("/", "layout");
    return { ok: true, orderId: order.id };
  } catch (err) {
    if (err instanceof OrderFailure) return { ok: false, error: err.code };
    console.error("family order failed", err);
    return { ok: false, error: "server" };
  }
}
