"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { cancelOwnOrder, OrderFailure } from "@/lib/billing/orders";
import { getDb } from "@/lib/db";

export async function cancelOrderAction(fd: FormData): Promise<void> {
  const user = await getCurrentUser();
  const id = fd.get("orderId");
  if (!user || typeof id !== "string") return;
  try {
    await cancelOwnOrder(getDb(), user.id, id);
  } catch (err) {
    if (!(err instanceof OrderFailure)) console.error("cancel order failed", err);
  }
  revalidatePath("/", "layout");
}
