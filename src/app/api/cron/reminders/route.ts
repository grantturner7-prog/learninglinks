import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { sendDueReminders } from "@/lib/membership/reminders";

export const dynamic = "force-dynamic";

function sameSecret(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * Daily job: send renewal reminders (60/30/7/0 days before a membership ends). Call it once a day with
 * `Authorization: Bearer $CRON_SECRET`. Without CRON_SECRET set the endpoint does not exist, and a wrong secret is a 404.
 */
export async function POST(req: Request) {
  const secret = getEnv().CRON_SECRET;
  const given = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!secret || !sameSecret(given, secret)) return new NextResponse(null, { status: 404 });
  const report = await sendDueReminders(getDb());
  return NextResponse.json(report);
}
