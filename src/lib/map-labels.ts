import { getTranslations } from "next-intl/server";
import type { MapLabels } from "@/components/map";

/**
 * The map's translated strings as plain text, so a server page can hand them to the client map. The six templated
 * strings keep their {name}/{count} placeholders (the map fills them in), so they are read raw.
 */
export async function getMapLabels(overrides: Partial<MapLabels> = {}): Promise<MapLabels> {
  const t = await getTranslations("map");
  return {
    mapAria: t("mapAria"), zoomIn: t("zoomIn"), zoomOut: t("zoomOut"), reset: t("reset"), loading: t("loading"), noWebgl: t("noWebgl"),
    attribution: t("attribution"), legendEducators: t("legendEducators"), legendFewer: t("legendFewer"), legendMore: t("legendMore"),
    legendSchool: t("legendSchool"), legendJobs: t("legendJobs"), areaOne: t.raw("areaOne") as string, areaOther: t.raw("areaOther") as string,
    clusterOne: t.raw("clusterOne") as string, clusterOther: t.raw("clusterOther") as string, jobsOne: t.raw("jobsOne") as string, jobsOther: t.raw("jobsOther") as string,
    pinFallback: t("pinFallback"), crumbRoot: t("crumbRoot"), crumbAria: t("crumbAria"), hereAria: t("hereAria"), gestureDesktop: t("gestureDesktop"), gestureMac: t("gestureMac"), gestureMobile: t("gestureMobile"),
    ...overrides,
  };
}
