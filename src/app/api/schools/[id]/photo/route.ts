import { and, eq, ne } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth/session";
import { getDb, schema } from "@/lib/db";
import { getJobViewer } from "@/lib/jobs/service";
import { readSchoolPhoto } from "@/lib/uploads/school-photos";
import { canSeeJobs } from "@/lib/visibility";

export const runtime = "nodejs";

const notFound = () => new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });

/**
 * A school's picture. Same gate as the school map it is shown on: signed-in educators who have a profile (and
 * admins, who look after the pictures). Everyone else gets the same 404 whether or not the school has a picture.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return notFound();
  const user = await getCurrentUser();
  if (!user) return notFound();
  const db = getDb();
  if (!user.isAdmin && !canSeeJobs(await getJobViewer(db, user))) return notFound();
  const [row] = await db
    .select({ photoKey: schema.organizationPhotos.photoKey })
    .from(schema.organizationPhotos)
    .innerJoin(schema.organizations, eq(schema.organizations.id, schema.organizationPhotos.organizationId))
    .where(and(eq(schema.organizationPhotos.organizationId, id), ne(schema.organizations.status, "suspended")))
    .limit(1);
  if (!row) return notFound();
  const bytes = await readSchoolPhoto(row.photoKey);
  if (!bytes) return notFound();
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "image/webp",
      "Content-Disposition": "inline",
      // The address carries a version, so a changed picture gets a new address and this copy can be kept for a day.
      "Cache-Control": "private, max-age=86400",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex, noimageindex",
    },
  });
}
