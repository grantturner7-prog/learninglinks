import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { getJobViewer, listSchoolPoints } from "@/lib/jobs/service";
import { canSeeJobs } from "@/lib/visibility";

export const runtime = "nodejs";

/**
 * School pins for the educator map. Same gate as job posts: signed-in educators who have a profile.
 * Everyone else gets a plain 404, so the endpoint reveals nothing.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  const db = getDb();
  const viewer = user ? await getJobViewer(db, user) : null;
  if (!canSeeJobs(viewer)) return new NextResponse("Not found", { status: 404, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
  const url = new URL(request.url);
  const withJobs = url.searchParams.get("withJobs") === "1";
  const points = (await listSchoolPoints(db, viewer)).filter((p) => !withJobs || p.jobs > 0);
  return NextResponse.json(
    { points: points.map((p) => ({ id: p.id, lat: p.lat, lng: p.lng, kind: p.type, jobs: p.jobs, name: p.name })) },
    { headers: { "Cache-Control": "private, max-age=300", "X-Robots-Tag": "noindex" } },
  );
}
