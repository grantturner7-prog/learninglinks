/**
 * DEVELOPMENT ONLY: creates a few clearly fictional accounts with a known password so a person can sign in and walk
 * through every side of the site. Run it with the dev server up (it signs the accounts up through the real sign-up
 * endpoint, so passwords are hashed the normal way):
 *
 *   npm run dev            # in one window
 *   npm run db:demo-accounts   # in another  (add -- --remove to delete them again)
 *
 * Refuses to run in production. Run `npm run db:seed-demo` as well for 120 fictional educators and 60 job posts.
 */
import { and, eq, inArray, like } from "drizzle-orm";
import { closeDb, getDb, schema } from "../src/lib/db";
import { confirmOrderPaid, createFamilyOrder, createSchoolOrder } from "../src/lib/billing/orders";

if (process.env.NODE_ENV === "production") throw new Error("demo-accounts must never run in production");

const BASE = process.env.DEMO_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE)) throw new Error(`demo-accounts only runs against a local server (got ${BASE}). It creates accounts with a publicly known password.`);
const PASSWORD = "demo-password-1234";
const SUFFIX = "@demo.test";
const today = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Taipei" }).format(new Date());

const ACCOUNTS = [
  { key: "family", email: `family${SUFFIX}`, type: "family", name: "Demo Family (paid)" },
  { key: "newfamily", email: `newfamily${SUFFIX}`, type: "family", name: "Demo Family (not paid yet)" },
  { key: "school", email: `school${SUFFIX}`, type: "school", name: "Demo School Owner" },
  { key: "educator", email: `educator${SUFFIX}`, type: "educator", name: "Demo Educator" },
] as const;

/** The first address in ADMIN_EMAILS, so the demo has a working admin desk (that address is an admin once verified). */
const ADMIN_EMAIL = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean)[0];

async function signUp(email: string, type: string, name: string): Promise<void> {
  const r = await fetch(`${BASE}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: BASE },
    body: JSON.stringify({ email, password: PASSWORD, name, accountType: type, noticeAcknowledged: true }),
  });
  if (!r.ok && r.status !== 422 && r.status !== 400) throw new Error(`Sign-up for ${email} failed: ${r.status} ${await r.text()}`);
  if (!r.ok) {
    const body = await r.text();
    if (!/exist|already/i.test(body)) throw new Error(`Sign-up for ${email} failed: ${r.status} ${body}`);
  }
}

async function main() {
  const db = getDb();
  const emails = [...ACCOUNTS.map((a) => a.email), ...(ADMIN_EMAIL ? [ADMIN_EMAIL] : [])];

  if (process.argv.includes("--remove")) {
    const users = await db.select({ id: schema.user.id }).from(schema.user).where(inArray(schema.user.email, emails));
    const ids = users.map((u) => u.id);
    if (ids.length > 0) {
      await db.delete(schema.memberships).where(inArray(schema.memberships.orderId, db.select({ id: schema.orders.id }).from(schema.orders).where(inArray(schema.orders.createdByUserId, ids))));
      await db.delete(schema.orders).where(inArray(schema.orders.createdByUserId, ids));
      await db.delete(schema.organizations).where(and(like(schema.organizations.name, "Demo Campus%"), eq(schema.organizations.source, "demo")));
      await db.delete(schema.user).where(inArray(schema.user.id, ids));
    }
    console.log("Demo accounts removed.");
    return;
  }

  for (const a of ACCOUNTS) await signUp(a.email, a.type, a.name);
  if (ADMIN_EMAIL) await signUp(ADMIN_EMAIL, "educator", "Demo Admin");
  await db.update(schema.user).set({ emailVerified: true }).where(inArray(schema.user.email, emails));
  const users = Object.fromEntries((await db.select().from(schema.user).where(inArray(schema.user.email, emails))).map((u) => [u.email, u]));
  const u = (key: (typeof ACCOUNTS)[number]["key"]) => users[ACCOUNTS.find((a) => a.key === key)!.email]!;
  const actor = u("family").id;

  // 1. a family that has paid
  const fam = u("family");
  const hasFamilyOrder = (await db.select({ id: schema.orders.id }).from(schema.orders).where(eq(schema.orders.createdByUserId, fam.id)).limit(1)).length > 0;
  if (!hasFamilyOrder) {
    const o = await createFamilyOrder(db, { id: fam.id, accountType: "family" });
    await confirmOrderPaid(db, o.id, actor, { receivedAmount: o.amount, receivedOn: today(), note: "demo account" });
  }

  // 2. a school with two campuses, one of them paid
  const sch = u("school");
  let campuses = await db.select({ id: schema.organizations.id }).from(schema.orgMembers).innerJoin(schema.organizations, eq(schema.organizations.id, schema.orgMembers.organizationId)).where(eq(schema.orgMembers.userId, sch.id));
  if (campuses.length === 0) {
    const made = await db
      .insert(schema.organizations)
      .values([
        { name: "Demo Campus: Sunshine English (Xitun)", type: "cram_school", status: "claimed", city: "taichung", district: "taichung:xitun", latitude: 24.1814, longitude: 120.6153, source: "demo" },
        { name: "Demo Campus: Rainbow Kindergarten (Nantun)", type: "kindergarten", status: "claimed", city: "taichung", district: "taichung:nantun", latitude: 24.1379, longitude: 120.6447, source: "demo" },
      ])
      .returning({ id: schema.organizations.id });
    await db.insert(schema.orgMembers).values(made.map((m) => ({ organizationId: m.id, userId: sch.id })));
    campuses = made;
    const o = await createSchoolOrder(db, { id: sch.id, accountType: "school" }, [made[0]!.id]);
    await confirmOrderPaid(db, o.id, actor, { receivedAmount: o.amount, receivedOn: today(), note: "demo account" });
  }

  // 3. an educator with a published profile
  const edu = u("educator");
  const has = (await db.select({ id: schema.educatorProfiles.id }).from(schema.educatorProfiles).where(eq(schema.educatorProfiles.userId, edu.id)).limit(1)).length > 0;
  if (!has) {
    const [p] = await db
      .insert(schema.educatorProfiles)
      .values({
        userId: edu.id, displayName: "Demo Educator", headline: "Fictional demo educator", bio: "A fictional profile for trying the site. Not a real person.", status: "published", publishedAt: new Date(),
        city: "taichung", districts: ["taichung:xitun", "taichung:nantun"], openTo: ["full_time", "part_time", "private_tutoring"], subjects: ["english-conversation", "phonics"], levels: ["elementary-lower", "elementary-upper"], languages: ["en"], teachingModes: ["in_person"],
        experienceBand: "5-9", workAuthorization: "open_work_rights", rateMin: 800, rateMax: 1200,
      })
      .returning({ id: schema.educatorProfiles.id });
    await db.insert(schema.educatorContacts).values({ educatorId: p!.id, channel: "email", value: `educator${SUFFIX}` });
  }

  console.log("\nDemo accounts (password for all: " + PASSWORD + ")\n");
  console.log(`  Family, already paid:        family${SUFFIX}      sees tutors, list and map`);
  console.log(`  Family, not paid yet:        newfamily${SUFFIX}   try checkout and online payment`);
  console.log(`  School, 1 of 2 campuses paid: school${SUFFIX}      sees educators, posts jobs, pays the second campus`);
  console.log(`  Educator:                    educator${SUFFIX}    sees the school map and job posts`);
  console.log(ADMIN_EMAIL ? `  Admin desk:                  ${ADMIN_EMAIL}   open /admin after signing in\n` : "  Admin desk: set ADMIN_EMAILS in .env.local, run this again, then sign in with that address\n");
}

main().then(() => closeDb()).catch(async (err) => { console.error(err instanceof Error ? err.message : err); await closeDb().catch(() => {}); process.exit(1); });
