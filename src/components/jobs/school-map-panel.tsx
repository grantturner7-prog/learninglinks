"use client";

import { useEffect, useState } from "react";
import { PointMap, type MapLabels, type MapPoint } from "@/components/map";
import { useRouter } from "@/i18n/navigation";

/**
 * The educators' school map: loads the pins (gated API) and writes the selected school into the URL.
 * The parent keys this component on `withJobs`, so changing the filter starts from a clean state.
 */
export function SchoolMapPanel({ selectedId, locale, labels, withJobs, params, loadError }: {
  selectedId: string | null;
  locale: string;
  labels: MapLabels;
  withJobs: boolean;
  params: Record<string, string>;
  loadError: string;
}) {
  const router = useRouter();
  const [points, setPoints] = useState<MapPoint[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    fetch(`/api/map/schools${withJobs ? "?withJobs=1" : ""}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { points: MapPoint[] }) => { if (live) setPoints(d.points); })
      .catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, [withJobs]);

  if (failed) return <p role="alert" className="notice-error">{loadError}</p>;
  return (
    <PointMap
      points={points ?? []}
      selectedId={selectedId}
      locale={locale}
      labels={labels}
      gestures="auto"
      className="h-[420px] sm:h-[520px]"
      onSelect={(id) => {
        const q = new URLSearchParams(params);
        q.set("school", id);
        router.push(`/jobs?${q.toString()}`, { scroll: false });
      }}
    />
  );
}
