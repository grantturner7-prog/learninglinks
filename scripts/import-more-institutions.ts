/**
 * Import the smaller official lists the big school directories leave out:
 * special-education schools, community colleges, Mandarin centres at universities, religious seminaries, the open
 * universities, licensed after-school care centres, and the Ministry's English names for universities.
 *
 *   npm run db:import-more -- --dry-run       fetch and report, write nothing
 *   npm run db:import-more                    fetch and load
 *   npm run db:import-more -- --after-school-file centres.csv [--encoding big5]
 *       The national after-school list sits on a Ministry server that refuses some foreign and cloud addresses. Run
 *       this from a network in Taiwan, or save the file in a browser and pass it here.
 *
 * A list that cannot be fetched is reported and skipped; the others still load. Re-running is safe: the same
 * institution is updated, never added twice, and a claimed listing keeps its claim and its own details.
 * See docs/LAUNCH_DATA.md.
 */
import { readFile } from "node:fs/promises";
import { eq, ne, sql } from "drizzle-orm";
import { closeDb, getDb, schema } from "../src/lib/db";
import { parseCsv } from "../src/lib/import/cram";
import { extractObjects, getText, portalCopies, realSleep, stripBom, type FetchFn } from "../src/lib/import/cram-fetch";
import { coreName } from "../src/lib/import/moe";
import { planAfterSchool, planCommunityColleges, planMandarinCentres, planOpenUniversities, planSeminaries, planSpecialEducation, tableFromObjects, universityEnglishNames, type MorePlan, type MoreRecord } from "../src/lib/import/more";

const has = (f: string) => process.argv.includes(f);
const arg = (name: string) => { const i = process.argv.indexOf(name); return i > -1 ? process.argv[i + 1] : undefined; };

/** Government hosts these lists are published on. Links come from a web page, so nothing else is followed. */
const HOSTS = new Set(["stats.moe.gov.tw", "ws.moe.edu.tw", "depart.moe.edu.tw", "www.k12ea.gov.tw", "afterschool.moe.gov.tw", "newdatacenter.taichung.gov.tw"]);
const trusted = (u: string) => { try { const x = new URL(u); return x.protocol === "https:" && HOSTS.has(x.hostname); } catch { return false; } };

interface Source { key: string; label: string; datasetId: number; fallbackUrl: string; format: "CSV" | "JSON" }
const SOURCES: Source[] = [
  { key: "special", label: "特殊教育學校名錄 (special-education schools)", datasetId: 6285, format: "CSV", fallbackUrl: "https://www.k12ea.gov.tw//files/common_unit/431a1ae5-9503-4675-8e59-07d7286be83f/doc/%E7%89%B9%E6%AE%8A%E6%95%99%E8%82%B2%E5%AD%B8%E6%A0%A1%E5%90%8D%E9%8C%84.csv" },
  { key: "community", label: "社區大學據點資訊 (community colleges)", datasetId: 40181, format: "CSV", fallbackUrl: "https://depart.moe.edu.tw/ed2400/Common/HitCount.ashx?p=C535150A0F617C6860CE01B098F7F2109789188FC445F71F5A68B1573A6310F8042DF60722082B0858719ECE87C7AD0715382C4021794C49AA4D5C2DF38858B39B7E17D2603DD16F955BC608E943D06B1CC821D950486A55C78E377A175B8AB6&type=FB01D469347C76A7&s=C9B2F32BA415989D" },
  { key: "mandarin", label: "各大學校院附設華語文教學中心一覽表 (Mandarin centres)", datasetId: 32995, format: "CSV", fallbackUrl: "https://depart.moe.edu.tw/ED2500/Common/HitCount.ashx?p=C535150A0F617C6860CE01B098F7F2109789188FC445F71F5A68B1573A6310F806B4B7AAA11899F9C01479728756AF80B91C4B5BA032890E734B527EF69856F1C27296A3EEC1285C48C110BD531B7B4E3E11F2306DB1E9A0ACD42CFD39B177B6&type=FB01D469347C76A7&s=426AC0E135750045" },
  { key: "seminary", label: "宗教研修學院名錄 (religious seminaries)", datasetId: 28586, format: "CSV", fallbackUrl: "https://stats.moe.gov.tw/files/opendata/u3_new.csv" },
  { key: "openuniv", label: "空大及大專附設進修學校名錄 (open universities)", datasetId: 28588, format: "CSV", fallbackUrl: "https://stats.moe.gov.tw/files/opendata/u2_new.csv" },
  { key: "english", label: "全國大學校院名錄(含學校英文名稱) (university English names)", datasetId: 33207, format: "CSV", fallbackUrl: "https://ws.moe.edu.tw/001/Upload/4/relfile/0/5038/55f39b31-27a0-4009-866a-ea260eb45eaf.csv" },
  { key: "afterschool", label: "全國立案兒童課後照顧服務中心基本資料 (after-school care centres, national)", datasetId: 160225, format: "CSV", fallbackUrl: "https://afterschool.moe.gov.tw/public/file/opendata.csv" },
  { key: "afterschool-taichung", label: "臺中市私立兒童課後照顧服務中心 (after-school care centres, Taichung)", datasetId: 84060, format: "JSON", fallbackUrl: "https://newdatacenter.taichung.gov.tw/api/v1/no-auth/resource.download?rid=7d30cf6a-a608-4b1c-b4c4-94992c741780" },
];

const net = { fetchFn: fetch as unknown as FetchFn, sleep: realSleep, attempts: 2, timeoutMs: 60_000 };

async function fetchSource(s: Source): Promise<string> {
  let url = s.fallbackUrl;
  try {
    const json = JSON.parse(stripBom(await getText(`https://data.gov.tw/api/v2/rest/dataset/${s.datasetId}`, net))) as { result?: { distribution?: { resourceDownloadUrl?: string; resourceFormat?: string }[] } };
    const pick = (json.result?.distribution ?? []).find((d) => d.resourceDownloadUrl && trusted(d.resourceDownloadUrl) && (d.resourceFormat ?? "").toUpperCase() === s.format);
    if (pick?.resourceDownloadUrl) url = pick.resourceDownloadUrl;
  } catch {
    /* use the address we last saw */
  }
  try {
    return stripBom(await getText(url, net));
  } catch (err) {
    // Some Ministry servers refuse connections from outside Taiwan. data.gov.tw keeps its own copy of every file.
    const copies = await portalCopies(s.datasetId, net);
    const copy = copies.get(url) ?? (copies.size === 1 ? [...copies.values()][0] : undefined);
    if (!copy) throw err;
    console.log(`    (the publisher's server does not answer from here: using data.gov.tw's own copy${copy.checked ? ` of ${copy.checked}` : ""})`);
    return stripBom(await getText(copy.json, net));
  }
}

async function main() {
  const dry = has("--dry-run");
  const texts = new Map<string, string>();
  const failed: string[] = [];
  console.log("Fetching the lists from data.gov.tw ...");
  for (const s of SOURCES) {
    try {
      texts.set(s.key, await fetchSource(s));
      console.log(`  ${s.label}: fetched`);
    } catch (err) {
      failed.push(s.label);
      console.log(`  ${s.label}: NOT fetched (${err instanceof Error ? err.message : err})`);
    }
    await realSleep(400);
  }
  const file = arg("--after-school-file");
  if (file) texts.set("afterschool", new TextDecoder(arg("--encoding") ?? "utf-8").decode(await readFile(file)).replace(/^﻿/, ""));

  const plans: { label: string; plan: MorePlan }[] = [];
  const add = (key: string, label: string, make: (t: string) => MorePlan) => { const t = texts.get(key); if (t) plans.push({ label, plan: make(t) }); };
  add("special", "Special-education schools", planSpecialEducation);
  add("community", "Community colleges", planCommunityColleges);
  add("mandarin", "Mandarin centres", planMandarinCentres);
  add("seminary", "Religious seminaries", planSeminaries);
  add("openuniv", "Open universities", planOpenUniversities);
  add("afterschool", "After-school care centres (national)", (t) => planAfterSchool(/^\s*[[{]/.test(t) ? tableFromObjects(extractObjects(JSON.parse(t))) : parseCsv(t)));
  add("afterschool-taichung", "After-school care centres (Taichung)", (t) => planAfterSchool(tableFromObjects(extractObjects(JSON.parse(t))), "taichung"));
  for (const { label, plan } of plans) {
    console.log(`${label}: ${plan.records.length} ready, ${plan.skipped} skipped.${plan.unplaced.length ? ` Not placed, for example: ${plan.unplaced.slice(0, 3).join("; ")}` : ""}`);
  }
  // The same centre can be on the national list and on its city's list.
  const byId = new Map<string, MoreRecord>();
  for (const { plan } of plans) for (const r of plan.records) if (!byId.has(r.sourceId)) byId.set(r.sourceId, r);
  const records = [...byId.values()];
  const english = texts.has("english") ? universityEnglishNames(texts.get("english")!) : new Map<string, string>();
  console.log(`University English names read: ${english.size}.`);
  if (failed.length) console.log(`Could not be fetched from here: ${failed.join("; ")}`);

  const db = getDb();
  // An institution already listed from another source (the map data, added by hand) is recognised by its core name
  // and city and updated in place, so it keeps its exact position and any claim. Never for district-level kinds.
  const existing = await db.select({ id: schema.organizations.id, name: schema.organizations.name, city: schema.organizations.city }).from(schema.organizations).where(ne(schema.organizations.source, "gov_open_data"));
  const already = new Set((await db.select({ sid: schema.organizations.sourceId }).from(schema.organizations)).map((r) => r.sid));
  const key = (name: string, city: string | null) => `${coreName(name)}|${city ?? ""}`;
  const pool = new Map<string, string[]>();
  for (const e of existing) pool.set(key(e.name, e.city), [...(pool.get(key(e.name, e.city)) ?? []), e.id]);
  const matched: { id: string; r: MoreRecord }[] = [];
  const fresh: MoreRecord[] = [];
  for (const r of records) {
    const ids = r.type === "after_school" || already.has(r.sourceId) ? undefined : pool.get(key(r.name, r.city));
    const id = ids?.shift();
    if (id) matched.push({ id, r }); else fresh.push(r);
  }
  console.log(`Already listed and recognised: ${matched.length}. New (or already loaded from these lists): ${fresh.length}.`);
  if (dry) { console.log("Dry run: nothing was written."); return; }

  for (const { id, r } of matched) {
    await db.execute(sql`update organizations o set type = ${r.type}, ownership = coalesce(${r.ownership}, o.ownership), website = coalesce(o.website, ${r.website}), address = case when o.status = 'claimed' and o.address is not null then o.address else coalesce(${r.address}, o.address) end, district = coalesce(o.district, ${r.district}), updated_at = now() where o.id = ${id}::uuid`);
  }
  for (let i = 0; i < fresh.length; i += 500) {
    await db.insert(schema.organizations).values(fresh.slice(i, i + 500)).onConflictDoUpdate({
      target: [schema.organizations.source, schema.organizations.sourceId],
      targetWhere: sql`${schema.organizations.sourceId} is not null`,
      // Never touch status, claim or contact columns: a listing that has been claimed stays claimed.
      set: { name: sql`excluded.name`, type: sql`excluded.type`, ownership: sql`excluded.ownership`, city: sql`excluded.city`, district: sql`excluded.district`, latitude: sql`excluded.latitude`, longitude: sql`excluded.longitude`, website: sql`coalesce(${schema.organizations.website}, excluded.website)`, address: sql`case when ${schema.organizations.status} = 'claimed' and ${schema.organizations.address} is not null then ${schema.organizations.address} else excluded.address end`, updatedAt: sql`now()` },
    });
  }
  // English names: only where a university has none, matched on the exact Chinese name.
  let named = 0;
  if (english.size > 0) {
    const unis = await db.select({ id: schema.organizations.id, name: schema.organizations.name, nameEn: schema.organizations.nameEn }).from(schema.organizations).where(eq(schema.organizations.type, "university"));
    const flat = (s: string) => s.replace(/台/g, "臺").replace(/[\s　()（）\-－·．.]/g, "");
    for (const u of unis) {
      const en = u.nameEn?.trim() ? null : english.get(flat(u.name));
      if (!en) continue;
      await db.update(schema.organizations).set({ nameEn: en }).where(eq(schema.organizations.id, u.id));
      named++;
    }
  }
  console.log(`Imported: ${matched.length} existing listings updated, ${fresh.length} added or refreshed, ${named} universities given their English name.`);
}

main().then(() => closeDb()).catch(async (err) => { console.error(err instanceof Error ? err.message : err); await closeDb().catch(() => {}); process.exit(1); });
