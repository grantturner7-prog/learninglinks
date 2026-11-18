"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { afterOrderPlaced, invoiceFrom, type CheckoutPayload } from "@/lib/billing/checkout";
import { createSchoolOrder, OrderFailure, type OrderError } from "@/lib/billing/orders";
import { getDb } from "@/lib/db";
import { chooseMethod } from "@/lib/payments/config";
import { parseJobForm, type JobFieldErrors } from "@/lib/jobs/input";
import { closeJob, createJob, JobFailure, type JobManageError } from "@/lib/jobs/manage";
import { addCampusAndClaim, OrgFailure, submitClaim, type ClaimInput, type NewCampusInput, type OrgError } from "@/lib/orgs/service";
import { allow } from "@/lib/rate-limit";
import type { CheckoutResult } from "../family/actions";

export async function createSchoolOrderAction(p: CheckoutPayload & { campusIds: string[] }): Promise<CheckoutResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "signin" };
  if (p.acknowledged !== true) return { ok: false, error: "ack" };
  if (!allow(`order:${user.id}`, 10, 60 * 60_000)) return { ok: false, error: "rate" };
  try {
    const db = getDb();
    const method = chooseMethod(p.method);
    const order = await createSchoolOrder(db, user, Array.isArray(p.campusIds) ? p.campusIds.filter((x) => typeof x === "string") : [], invoiceFrom(p.invoice), method);
    await afterOrderPlaced(db, user, order);
    revalidatePath("/", "layout");
    return { ok: true, orderId: order.id };
  } catch (err) {
    if (err instanceof OrderFailure) return { ok: false, error: err.code };
    console.error("school order failed", err);
    return { ok: false, error: "server" };
  }
}

export type ClaimResult = { ok: true } | { ok: false; error: OrgError | "ack" | "rate" | "server" | "signin" };

export async function claimCampusAction(p: { organizationId: string; claim: ClaimInput; acknowledged: boolean }): Promise<ClaimResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "signin" };
  if (p.acknowledged !== true) return { ok: false, error: "ack" };
  if (!allow(`claim:${user.id}`, 10, 60 * 60_000)) return { ok: false, error: "rate" };
  try {
    await submitClaim(getDb(), user, p.organizationId, p.claim);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (err) {
    if (err instanceof OrgFailure) return { ok: false, error: err.code };
    console.error("claim failed", err);
    return { ok: false, error: "server" };
  }
}

export async function addCampusAction(p: { campus: NewCampusInput; acknowledged: boolean }): Promise<ClaimResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "signin" };
  if (p.acknowledged !== true) return { ok: false, error: "ack" };
  if (!allow(`claim:${user.id}`, 10, 60 * 60_000)) return { ok: false, error: "rate" };
  try {
    await addCampusAndClaim(getDb(), user, p.campus);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (err) {
    if (err instanceof OrgFailure) return { ok: false, error: err.code };
    console.error("add campus failed", err);
    return { ok: false, error: "server" };
  }
}

export type JobResult = { ok: true } | { ok: false; error: JobManageError | "fix" | "rate" | "server" | "signin"; errors?: JobFieldErrors };

/** Posts a job. The browser sends plain fields; they are re-validated here exactly as a form would be. */
export async function createJobAction(p: { organizationId: string; fields: Record<string, string | string[]> }): Promise<JobResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "signin" };
  if (!allow(`job:${user.id}`, 30, 60 * 60_000)) return { ok: false, error: "rate" };
  const fields = p.fields ?? {};
  const { values, errors } = parseJobForm({
    get: (k) => (typeof fields[k] === "string" ? (fields[k] as string) : null),
    getAll: (k) => (Array.isArray(fields[k]) ? (fields[k] as unknown[]).filter((x): x is string => typeof x === "string") : []),
  });
  if (Object.keys(errors).length > 0) return { ok: false, error: "fix", errors };
  try {
    await createJob(getDb(), user, p.organizationId, values);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (err) {
    if (err instanceof JobFailure) return { ok: false, error: err.code };
    console.error("create job failed", err);
    return { ok: false, error: "server" };
  }
}

export async function closeJobAction(fd: FormData): Promise<void> {
  const user = await getCurrentUser();
  const id = fd.get("jobId");
  if (!user || typeof id !== "string") return;
  try {
    await closeJob(getDb(), user, id);
  } catch (err) {
    if (!(err instanceof JobFailure)) console.error("close job failed", err);
  }
  revalidatePath("/", "layout");
}

export type { OrderError };
