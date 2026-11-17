import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { getEnv } from "@/lib/env";
import * as schema from "./schema";

export type Db = NodePgDatabase<typeof schema>;

const g = globalThis as unknown as { __llPool?: Pool; __llDb?: Db };

/** Lazily created so importing this module never needs DATABASE_URL (e.g. during `next build`). */
export function getDb(): Db {
  if (!g.__llDb) {
    g.__llPool = new Pool({ connectionString: getEnv().DATABASE_URL, max: 10 });
    g.__llDb = drizzle(g.__llPool, { schema });
  }
  return g.__llDb;
}

export async function closeDb(): Promise<void> {
  await g.__llPool?.end();
  g.__llPool = undefined;
  g.__llDb = undefined;
}

export { schema };
