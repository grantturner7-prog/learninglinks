"use server";

import { getCurrentUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { ModerationFailure, submitReport } from "@/lib/moderation/service";
import type { ReportTargetType } from "@/lib/moderation/reasons";
import { allow } from "@/lib/rate-limit";

export type ReportState =
  | { status: "idle" }
  | { status: "sent"; already: boolean }
  | { status: "error"; code: "not_allowed" | "not_found" | "invalid_reason" | "details_required" | "too_many" | "rate" | "signin" | "server" };

export async function submitReportAction(_prev: ReportState, fd: FormData): Promise<ReportState> {
  const user = await getCurrentUser();
  if (!user) return { status: "error", code: "signin" };
  if (!allow(`report:${user.id}`, 10, 60_000)) return { status: "error", code: "rate" };
  const targetType = String(fd.get("targetType") ?? "") as ReportTargetType;
  try {
    const res = await submitReport(getDb(), user, { targetType, targetId: String(fd.get("targetId") ?? ""), reason: String(fd.get("reason") ?? ""), details: String(fd.get("details") ?? "") });
    return { status: "sent", already: !res.created };
  } catch (err) {
    if (err instanceof ModerationFailure && err.code !== "report_not_open" && err.code !== "wrong_state") return { status: "error", code: err.code };
    console.error("report failed", err);
    return { status: "error", code: "server" };
  }
}
