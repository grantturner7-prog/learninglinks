import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Liveness and database check for load balancers, Docker health checks and uptime monitors.
 * It reveals nothing about the system: no versions, hostnames or configuration.
 */
export async function GET() {
  const headers = { "Cache-Control": "no-store" };
  try {
    await Promise.race([getDb().execute(sql`select 1`), new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 3000))]);
    return NextResponse.json({ status: "ok" }, { headers });
  } catch {
    return NextResponse.json({ status: "unavailable" }, { status: 503, headers });
  }
}
