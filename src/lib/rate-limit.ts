/**
 * A small in-memory limiter for expensive endpoints (photo processing). It is per server process, which is
 * enough to stop one signed-in user hammering the image pipeline; sign-in and sign-up have their own
 * database-backed limits in Better Auth.
 */
const hits = new Map<string, number[]>();

export function allow(key: string, max: number, windowMs: number, now: number = Date.now()): boolean {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 10_000) for (const [k, v] of hits) if (v.every((t) => now - t >= windowMs)) hits.delete(k);
  return true;
}
