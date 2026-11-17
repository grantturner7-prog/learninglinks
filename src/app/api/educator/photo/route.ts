import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { setPhotoKey } from "@/lib/educators/service";
import { allow } from "@/lib/rate-limit";
import { isSameOrigin } from "@/lib/same-origin";
import { MAX_PHOTO_BYTES, PhotoError, deletePhoto, processPhoto, storePhoto } from "@/lib/uploads/photos";

export const runtime = "nodejs";

const json = (body: Record<string, unknown>, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

async function educatorOrNull(request: Request) {
  if (!isSameOrigin(request)) return null;
  const user = await getCurrentUser();
  return user && user.accountType === "educator" ? user : null;
}

export async function POST(request: Request) {
  const user = await educatorOrNull(request);
  if (!user) return json({ error: "forbidden" }, 403);
  if (!allow(`photo:${user.id}`, 10, 60 * 60 * 1000)) return json({ error: "rateLimited" }, 429);
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_PHOTO_BYTES + 64 * 1024) return json({ error: "tooLarge" }, 413);

  let file: FormDataEntryValue | null;
  try {
    file = (await request.formData()).get("photo");
  } catch {
    return json({ error: "notAnImage" }, 400);
  }
  if (!(file instanceof File)) return json({ error: "notAnImage" }, 400);

  let key: string | null = null;
  try {
    const webp = await processPhoto(Buffer.from(await file.arrayBuffer()));
    key = await storePhoto(webp);
    const db = getDb();
    const { previous, updated } = await setPhotoKey(db, user.id, key);
    if (!updated) {
      await deletePhoto(key);
      return json({ error: "needsProfile" }, 409);
    }
    await deletePhoto(previous);
    return json({ ok: true });
  } catch (err) {
    if (key) await deletePhoto(key);
    if (err instanceof PhotoError) return json({ error: err.code }, err.code === "tooLarge" ? 413 : 400);
    console.error("photo upload failed", err);
    return json({ error: "server" }, 500);
  }
}

export async function DELETE(request: Request) {
  const user = await educatorOrNull(request);
  if (!user) return json({ error: "forbidden" }, 403);
  const { previous } = await setPhotoKey(getDb(), user.id, null);
  await deletePhoto(previous);
  return json({ ok: true });
}
