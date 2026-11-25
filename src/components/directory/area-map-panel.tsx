"use client";

import { AreaMap, type AreaBubble, type MapLabels } from "@/components/map";
import { cityOfKey } from "@/lib/geo";
import { useRouter } from "@/i18n/navigation";

/**
 * The members' educator map. Selecting an area writes it into the URL filters (city / district), so the list,
 * the filter form and the map always show the same selection.
 */
export function AreaMapPanel({ bubbles, selectedKey, locale, labels, params, basePath = "/educators" }: {
  bubbles: AreaBubble[];
  selectedKey: string | null;
  locale: string;
  labels: MapLabels;
  /** Current query parameters (filters, view). */
  params: Record<string, string>;
  basePath?: string;
}) {
  const router = useRouter();
  const go = (next: Record<string, string | undefined>) => {
    const q = new URLSearchParams(params);
    for (const [k, v] of Object.entries(next)) {
      if (v) q.set(k, v);
      else q.delete(k);
    }
    q.delete("page");
    const s = q.toString();
    router.push(`${basePath}${s ? `?${s}` : ""}`, { scroll: false });
  };
  return (
    <AreaMap
      bubbles={bubbles}
      selectedKey={selectedKey}
      locale={locale}
      labels={labels}
      gestures="auto"
      className="h-[380px] sm:h-[480px] lg:h-[min(560px,calc(100dvh-13rem))]"
      onSelect={(key, level) => (level === "district" ? go({ city: cityOfKey(key), district: key }) : go({ city: key, district: undefined }))}
      onClear={() => go({ city: undefined, district: undefined })}
    />
  );
}
