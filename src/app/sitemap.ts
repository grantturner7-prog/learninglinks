import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-url";
import { routing } from "@/i18n/routing";

/** Marketing pages only. There are no public educator pages to list, by design. */
const PATHS = ["", "/educators", "/for-schools", "/for-families", "/safety"] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  return PATHS.flatMap((path) =>
    routing.locales.map((locale) => ({
      url: `${base}/${locale}${path}`,
      alternates: { languages: Object.fromEntries(routing.locales.map((l) => [l, `${base}/${l}${path}`])) },
    })),
  );
}
