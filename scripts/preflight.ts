/**
 * Launch readiness report. Run on the server with the production settings loaded:
 *   docker compose -f deploy/docker-compose.yml run --rm migrate npm run preflight
 * or locally: npm run preflight. Exits 1 if anything must be fixed before opening the site.
 */
import { access, constants, mkdir, readFile } from "node:fs/promises";
import { Pool } from "pg";
import { checkReadiness, worst, type Check } from "../src/lib/ops/readiness";

const ICON = { pass: "PASS", warn: "WARN", fail: "FAIL" } as const;

async function main() {
  const checks: Check[] = checkReadiness(process.env);

  // Database reachable, and every migration applied.
  const url = process.env.DATABASE_URL;
  if (url) {
    const pool = new Pool({ connectionString: url, max: 1, connectionTimeoutMillis: 5000 });
    try {
      const journal = JSON.parse(await readFile("drizzle/meta/_journal.json", "utf8")) as { entries: unknown[] };
      const { rows } = await pool.query("select count(*)::int as n from drizzle.__drizzle_migrations");
      const n = rows[0]?.n ?? 0;
      checks.push({ id: "migrations", level: n === journal.entries.length ? "pass" : "fail", message: n === journal.entries.length ? `Database is reachable and all ${n} migrations are applied.` : `Database has ${n} migrations applied but the code expects ${journal.entries.length}. Run: npm run db:migrate` });
    } catch (err) {
      checks.push({ id: "migrations", level: "fail", message: `Cannot check the database: ${(err as Error).message}` });
    } finally {
      await pool.end().catch(() => {});
    }
  }

  // Photos need a writable folder that survives restarts. In the Docker setup the app keeps them on the "uploads"
  // volume, which this tools container does not mount, so the folder is only checked where UPLOAD_DIR is set.
  const dir = process.env.UPLOAD_DIR;
  if (!dir) {
    checks.push({ id: "uploads", level: "pass", message: "Photo folder not checked here (the Docker app stores photos on the 'uploads' volume, which the nightly backup includes)." });
  } else {
    try {
      await mkdir(dir, { recursive: true });
      await access(dir, constants.W_OK);
      checks.push({ id: "uploads", level: "pass", message: `Photo folder ${dir} is writable. Make sure it is on a persistent volume and in the backups.` });
    } catch {
      checks.push({ id: "uploads", level: "fail", message: `Photo folder ${dir} is not writable.` });
    }
  }

  for (const c of checks) console.log(`${ICON[c.level]}  ${c.message}`);
  const w = worst(checks);
  console.log(w === "fail" ? "\nNot ready: fix the FAIL lines above." : w === "warn" ? "\nReady, with warnings to read." : "\nReady.");
  process.exit(w === "fail" ? 1 : 0);
}

main().catch((err) => { console.error(err); process.exit(2); });
