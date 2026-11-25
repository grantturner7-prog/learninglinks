import { and, count, isNotNull, ne } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { getDb, schema } from "@/lib/db";
import { ALL_TW_DISTRICTS } from "@/lib/geo";
import { CITIES } from "@/lib/geo/taiwan";

const { organizations } = schema;

export interface SiteNumbers {
  /** Schools that have a place on the map (not suspended). Null when the database could not be asked. */
  schools: number | null;
  districts: number;
  cities: number;
}

/** Counted at most once an hour: the home page shows it to everyone, and it only moves when schools are imported. */
const countSchoolsOnMap = unstable_cache(
  async (): Promise<number> => {
    const [row] = await getDb()
      .select({ n: count() })
      .from(organizations)
      .where(and(isNotNull(organizations.latitude), isNotNull(organizations.longitude), ne(organizations.status, "suspended")));
    return row?.n ?? 0;
  },
  ["site-numbers-schools"],
  { revalidate: 3600 },
);

/**
 * The true, public numbers the home page may quote: schools on the map (public government lists), and how much of
 * Taiwan the map covers. Never a number about educators: those are for members only.
 */
export async function getSiteNumbers(): Promise<SiteNumbers> {
  let schools: number | null = null;
  try {
    schools = await countSchoolsOnMap();
  } catch (err) {
    // The home page must still render if the database is briefly away.
    console.error("getSiteNumbers failed", err);
  }
  return { schools, districts: ALL_TW_DISTRICTS.length, cities: CITIES.length };
}

/** 11,911 -> 11,900 (shown as "11,900+"): honest when a few schools are added or removed. Small numbers stay exact. */
export function roundedDown(n: number): number {
  return n >= 1000 ? Math.floor(n / 100) * 100 : n;
}
