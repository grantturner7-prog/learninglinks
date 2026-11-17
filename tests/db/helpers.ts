import { randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { sql } from "drizzle-orm";
import { Pool } from "pg";
import type { Db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import type { AccountType } from "@/lib/db/schema/auth";

/** DB integration tests need a throwaway Postgres: set TEST_DATABASE_URL, otherwise they are skipped. */
export const TEST_DB_URL = process.env.TEST_DATABASE_URL || undefined;

let pool: Pool | undefined;
let db: Db | undefined;

export async function openTestDb(): Promise<Db> {
  if (db) return db;
  if (!TEST_DB_URL) throw new Error("TEST_DATABASE_URL is not set");
  pool = new Pool({ connectionString: TEST_DB_URL, max: 4 });
  db = drizzle(pool, { schema });
  await migrate(db, { migrationsFolder: "./drizzle" });
  return db;
}

export async function closeTestDb(): Promise<void> {
  await pool?.end();
  pool = undefined;
  db = undefined;
}

/** Wipe everything these tests touch. Never point TEST_DATABASE_URL at a database you care about. */
export async function resetTestDb(d: Db): Promise<void> {
  await d.execute(sql`truncate table "user", organizations, memberships, orders, waitlist_signups, audit_log restart identity cascade`);
}

export async function makeUser(d: Db, accountType: AccountType, name = "Test"): Promise<{ id: string; accountType: AccountType }> {
  const id = randomUUID();
  await d.insert(schema.user).values({ id, name, email: `${id}@example.com`, accountType });
  return { id, accountType };
}

export const nowPlus = (days: number, from = new Date()) => new Date(from.getTime() + days * 86_400_000);
