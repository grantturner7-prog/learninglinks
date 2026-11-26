/**
 * Join schools that are listed twice: once from the map data (exact spot, the name on the gate) and once from the
 * Ministry's directory (official name, government or private, address).
 *
 *   npm run db:dedupe-schools -- --dry-run     show what would be joined, write nothing
 *   npm run db:dedupe-schools                  join them
 *
 * The official listing is kept and moved to the exact spot; it takes the English name and website the map data had
 * when it has none. The map-data listing is removed. A listing that is claimed, applied for, or has a job post or a
 * picture is never removed. See src/lib/import/dedupe.ts for the rule and docs/LAUNCH_DATA.md.
 */
import { sql } from "drizzle-orm";
import { closeDb, getDb } from "../src/lib/db";
import { planDedupe, type DedupeRow } from "../src/lib/import/dedupe";

async function main() {
  const dry = process.argv.includes("--dry-run");
  const db = getDb();
  const res = await db.execute(sql`
    select o.id, o.name, o.name_en as "nameEn", o.website, o.type, o.city, o.latitude, o.longitude, o.source, o.ownership,
      (o.status <> 'unclaimed'
        or exists (select 1 from org_claims c where c.organization_id = o.id)
        or exists (select 1 from jobs j where j.organization_id = o.id)
        or exists (select 1 from organization_photos p where p.organization_id = o.id)) as locked
    from organizations o
    where o.type in ('kindergarten','elementary','junior_high','senior_high','university')`);
  const rows = res.rows as unknown as DedupeRow[];
  const merges = planDedupe(rows);
  console.log(`Looked at ${rows.length} schools. Listed twice under different spellings: ${merges.length}.`);
  const show = process.argv.includes("--all") ? merges.length : 25;
  for (const m of merges.slice(0, show)) console.log(`  ${m.remove.name}  ->  ${m.keep.name}  (${m.keep.city}${m.moveTo ? ", pin moved to the exact spot" : ""})`);
  if (merges.length > show) console.log(`  ... and ${merges.length - show} more (add --all to list every one)`);
  if (dry) { console.log("Dry run: nothing was written."); return; }

  for (const m of merges) {
    await db.transaction(async (tx) => {
      await tx.execute(sql`update organizations set
          latitude = coalesce(${m.moveTo?.latitude ?? null}, latitude),
          longitude = coalesce(${m.moveTo?.longitude ?? null}, longitude),
          name_en = coalesce(nullif(name_en, ''), ${m.remove.nameEn}),
          website = coalesce(website, ${m.remove.website}),
          updated_at = now()
        where id = ${m.keep.id}::uuid`);
      await tx.execute(sql`delete from organizations where id = ${m.remove.id}::uuid and status = 'unclaimed'`);
    });
  }
  console.log(`Joined ${merges.length} double listings.`);
}

main().then(() => closeDb()).catch(async (err) => { console.error(err instanceof Error ? err.message : err); await closeDb().catch(() => {}); process.exit(1); });
