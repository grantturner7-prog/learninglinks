/**
 * DEVELOPMENT ONLY: fills the database with clearly fictional educators and job posts so the maps and lists
 * have something to show. Refuses to run in production. Demo accounts cannot sign in (no password), use the
 * reserved `.invalid` domain, and can be removed with `npm run db:seed-demo -- --remove`.
 */
import { and, eq, like, sql } from "drizzle-orm";
import { closeDb, getDb, schema } from "../src/lib/db";
import { DISTRICTS } from "../src/lib/geo/taiwan";
import { LANGUAGES, LEVELS, SUBJECTS } from "../src/lib/taxonomy";

if (process.env.NODE_ENV === "production") throw new Error("seed-demo must never run in production");

const EMAIL_SUFFIX = "@demo.invalid";
const NAMES = ["Alex T.", "Brenda L.", "Chris W.", "Dana K.", "Emil H.", "Fiona C.", "Grace Y.", "Henry P.", "Iris M.", "Jack S.", "Kelly N.", "Leo R.", "Mia B.", "Noah D.", "Olivia F.", "Peter G.", "Quinn A.", "Rosa V.", "Sam J.", "Tina Z."];

let seed = 42;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = <T,>(a: readonly T[]): T => a[Math.floor(rnd() * a.length)]!;
const some = <T,>(a: readonly T[], n: number): T[] => [...a].sort(() => rnd() - 0.5).slice(0, n);

async function main() {
  const db = getDb();
  if (process.argv.includes("--remove")) {
    await db.delete(schema.user).where(like(schema.user.email, `%${EMAIL_SUFFIX}`));
    await db.delete(schema.jobs).where(like(schema.jobs.title, "[demo]%"));
    console.log("Demo data removed.");
    return;
  }
  const metros = ["taipei", "new-taipei", "taoyuan", "taichung"] as const;
  let n = 0;
  for (let i = 0; i < 120; i++) {
    const city = rnd() < 0.8 ? pick(metros) : pick(["tainan", "kaohsiung", "hsinchu-city", "changhua"] as const);
    const ds = DISTRICTS.filter((d) => d.city === city);
    const districts = ds.length > 0 ? some(ds, 1 + Math.floor(rnd() * 3)).map((d) => d.key) : [];
    const roll = rnd();
    const openTo = roll < 0.4 ? ["full_time"] : roll < 0.6 ? ["part_time", "full_time"] : roll < 0.8 ? ["private_tutoring"] : ["part_time", "private_tutoring"];
    const id = `demo-${i}`;
    await db.insert(schema.user).values({ id, name: `${pick(NAMES)} (demo)`, email: `${id}${EMAIL_SUFFIX}`, accountType: "educator", emailVerified: true }).onConflictDoNothing();
    await db
      .insert(schema.educatorProfiles)
      .values({
        userId: id, displayName: `${pick(NAMES)}`, headline: "Demo educator (fictional)", bio: "This is a fictional demo profile used to preview the map and lists in development.",
        status: "published", publishedAt: new Date(), city, districts, openTo, subjects: some(SUBJECTS, 1 + Math.floor(rnd() * 3)), levels: some(LEVELS, 1 + Math.floor(rnd() * 2)),
        languages: some(LANGUAGES.slice(0, 2), 1), teachingModes: ["in_person"], experienceBand: pick(["0-1", "2-4", "5-9", "10+"]),
        workAuthorization: "open_work_rights", rateMin: openTo.includes("private_tutoring") ? 500 + Math.floor(rnd() * 4) * 100 : null, rateMax: openTo.includes("private_tutoring") ? 1000 + Math.floor(rnd() * 4) * 100 : null,
      })
      .onConflictDoNothing();
    await db.insert(schema.educatorContacts).values((await db.select({ id: schema.educatorProfiles.id }).from(schema.educatorProfiles).where(eq(schema.educatorProfiles.userId, id))).map((p) => ({ educatorId: p.id, channel: "email", value: `${id}${EMAIL_SUFFIX}` }))).onConflictDoNothing();
    n++;
  }
  const schools = await db.select({ id: schema.organizations.id, city: schema.organizations.city, type: schema.organizations.type }).from(schema.organizations).where(and(eq(schema.organizations.source, "osm_import"), sql`${schema.organizations.latitude} is not null`)).limit(4000);
  const demoJobs = [];
  for (let i = 0; i < 60 && schools.length > 0; i++) {
    const s = pick(schools);
    demoJobs.push({ organizationId: s.id, title: `[demo] ${pick(["English teacher", "Homeroom teacher", "After-school helper", "Phonics teacher"])}`, type: pick(["full_time", "part_time"] as const), city: s.city, subjects: some(SUBJECTS, 1), applyContact: "demo@demo.invalid", salaryMin: 45000, salaryMax: 65000, salaryUnit: "month" as const, status: "open" as const });
  }
  if (demoJobs.length) await db.insert(schema.jobs).values(demoJobs);
  console.log(`Seeded ${n} demo educators and ${demoJobs.length} demo job posts.`);
}

main().then(() => closeDb()).catch((err) => { console.error(err); process.exit(1); });
