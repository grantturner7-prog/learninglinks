import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth/session";
import { getEducatorForAudience, getMemberAudience } from "@/lib/directory/service";
import { getDb, schema } from "@/lib/db";
import { readPhoto } from "@/lib/uploads/photos";

export const runtime = "nodejs";

const notFound = () => new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });

/**
 * Profile photos are as private as profiles: only the educator themself, or a paying member who is allowed
 * to see this educator (right audience, published), may fetch one. Everyone else gets the same 404 whether or
 * not the educator exists.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return notFound();
  const user = await getCurrentUser();
  if (!user) return notFound();
  const db = getDb();
  const [row] = await db.select({ userId: schema.educatorProfiles.userId, photoKey: schema.educatorProfiles.photoKey }).from(schema.educatorProfiles).where(eq(schema.educatorProfiles.id, id)).limit(1);
  if (!row?.photoKey) return notFound();
  if (row.userId !== user.id) {
    const audience = await getMemberAudience(db, user);
    if (!audience || !(await getEducatorForAudience(db, audience, id))) return notFound();
  }
  const bytes = await readPhoto(row.photoKey);
  if (!bytes) return notFound();
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "image/webp",
      "Content-Disposition": "inline",
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex, noimageindex",
    },
  });
}
