"use client";

import Supercluster from "supercluster";
import { useEffect, useMemo, useRef } from "react";
import { requireCountryMap } from "@/lib/geo";
import { useMapCtx, useViewVersion } from "./context";
import { MapShell } from "./MapShell";
import { MarkerLayer, type MarkerItem } from "./MarkerLayer";
import { fitPadding } from "./style";
import { fmt, plural, type GestureMode, type MapLabels, type MapPoint } from "./types";

export interface PointMapProps {
  /** Exact positions (public places such as schools). Never use this for people: use AreaMap. */
  points: readonly MapPoint[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  locale: string;
  labels: MapLabels;
  /** Country code of a registered map config (see src/lib/geo). Default "TW". */
  country?: string;
  className?: string;
  gestures?: GestureMode;
  /** Re-fit the view whenever this changes. Defaults to a signature of `points`, so filtering re-fits automatically. */
  fitKey?: string | number;
}

export function PointMap({ points, selectedId = null, onSelect, locale, labels, country = "TW", className, gestures, fitKey }: PointMapProps) {
  const cfg = requireCountryMap(country);
  return (
    <MapShell country={cfg} labels={labels} className={className} gestures={gestures} legend={<Legend labels={labels} />}>
      <PointLayers points={points} selectedId={selectedId} onSelect={onSelect} locale={locale} fitKey={fitKey} />
    </MapShell>
  );
}

function Legend({ labels }: { labels: MapLabels }) {
  return (
    <div className="ll-legend__box">
      <div className="ll-legend__row">
        <span className="ll-pin ll-pin--legend" aria-hidden="true" />
        <span>{labels.legendSchool}</span>
      </div>
      <div className="ll-legend__row">
        <span className="ll-pin ll-pin--legend ll-pin--jobs" aria-hidden="true" />
        <span>{labels.legendJobs}</span>
      </div>
    </div>
  );
}

interface PointProps {
  id: string;
  jobs: number;
  name: string;
  kind: string;
}
interface ClusterProps {
  jobs: number;
}

function PointLayers({ points, selectedId, onSelect, locale, fitKey }: { points: readonly MapPoint[]; selectedId: string | null; onSelect?: (id: string) => void; locale: string; fitKey?: string | number }) {
  const { map, country, labels, reducedMotion } = useMapCtx();
  const view = useViewVersion(map);
  const dur = (ms: number) => (reducedMotion ? 0 : ms);

  const index = useMemo(() => {
    const sc = new Supercluster<PointProps, ClusterProps>({
      radius: 72,
      maxZoom: country.pointMaxZoom - 1,
      minPoints: 3,
      map: (p) => ({ jobs: p.jobs }),
      reduce: (acc, p) => {
        acc.jobs += p.jobs;
      },
    });
    sc.load(
      points.map((p) => ({
        type: "Feature" as const,
        properties: { id: p.id, jobs: p.jobs ?? 0, name: p.name ?? "", kind: p.kind ?? "" },
        geometry: { type: "Point" as const, coordinates: [p.lng, p.lat] },
      })),
    );
    return sc;
  }, [points, country]);

  // ---- fit the view when the set of points changes (filters) ----
  const signature = fitKey ?? `${points.length}:${points[0]?.id ?? ""}:${points[points.length - 1]?.id ?? ""}`;
  const lastFit = useRef<string | number | null>(null);
  useEffect(() => {
    if (lastFit.current === signature) return;
    lastFit.current = signature;
    const pad = fitPadding(map.getContainer());
    if (points.length === 0) {
      map.fitBounds(country.bounds.main as unknown as [number, number, number, number], { padding: pad, duration: dur(700) });
      return;
    }
    if (points.length === 1) {
      const p = points[0]!;
      map.flyTo({ center: [p.lng, p.lat], zoom: 13, duration: dur(800) });
      return;
    }
    // Frame the main island when almost everything is on it; a few far offshore points (Kinmen, Matsu) must not
    // shrink it. They stay reachable by panning or zooming out.
    const [mw, ms, me, mn] = country.bounds.main;
    const onMain = points.filter((p) => p.lng >= mw && p.lng <= me && p.lat >= ms && p.lat <= mn);
    const framed = onMain.length >= points.length * 0.9 ? onMain : points;
    let w = 180, s = 90, e = -180, n = -90;
    for (const p of framed) {
      w = Math.min(w, p.lng); e = Math.max(e, p.lng); s = Math.min(s, p.lat); n = Math.max(n, p.lat);
    }
    map.fitBounds([[w, s], [e, n]], { padding: pad, maxZoom: 12.5, duration: dur(800) });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `points` is covered by `signature`; `dur` only depends on reducedMotion
  }, [map, country, signature]);

  // ---- fly to the selected point ----
  useEffect(() => {
    if (!selectedId) return;
    const p = points.find((x) => x.id === selectedId);
    if (!p) return;
    map.flyTo({ center: [p.lng, p.lat], zoom: Math.max(map.getZoom(), 13.2), duration: dur(800) });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to a new selection
  }, [map, selectedId]);

  const items = useMemo<MarkerItem[]>(() => {
    void view; // recompute after every pan, zoom or resize
    const b = map.getBounds();
    const padLng = (b.getEast() - b.getWest()) * 0.15;
    const padLat = (b.getNorth() - b.getSouth()) * 0.15;
    const zoom = Math.max(0, Math.min(country.pointMaxZoom, Math.round(map.getZoom())));
    const feats = index.getClusters([b.getWest() - padLng, b.getSouth() - padLat, b.getEast() + padLng, b.getNorth() + padLat], zoom);
    const out: MarkerItem[] = [];
    for (const f of feats) {
      const [lng, lat] = f.geometry.coordinates as [number, number];
      const props = f.properties;
      if ("cluster" in props && props.cluster) {
        const count = props.point_count;
        const size = Math.round(Math.min(54, 28 + 6.5 * Math.log2(count)));
        const clusterId = props.cluster_id;
        out.push({
          key: `c:${clusterId}`,
          lng,
          lat,
          z: 300,
          node: (
            <button
              type="button"
              className="ll-bubble ll-bubble--cluster"
              style={{ ["--size" as string]: `${size}px` }}
              aria-label={fmt(plural(labels.clusterOne, labels.clusterOther, count), { count })}
              onClick={() => {
                const z = Math.min(index.getClusterExpansionZoom(clusterId), country.pointMaxZoom);
                map.easeTo({ center: [lng, lat], zoom: z + 0.01, duration: dur(450) });
              }}
            >
              <span className="ll-bubble__n">{new Intl.NumberFormat(locale).format(count)}</span>
              {props.jobs > 0 ? <span className="ll-badge" aria-hidden="true" /> : null}
            </button>
          ),
        });
      } else {
        const p = props as PointProps;
        const sel = p.id === selectedId;
        const label = p.name || labels.pinFallback;
        const jobsText = p.jobs > 0 ? `, ${fmt(plural(labels.jobsOne, labels.jobsOther, p.jobs), { count: p.jobs })}` : "";
        out.push({
          key: `p:${p.id}`,
          lng,
          lat,
          z: sel ? 1000 : p.jobs > 0 ? 400 : 200,
          node: (
            <button
              type="button"
              className={`ll-pin${p.jobs > 0 ? " ll-pin--jobs" : ""}`}
              data-selected={sel ? "1" : "0"}
              aria-pressed={sel}
              aria-label={`${label}${jobsText}`}
              onClick={() => onSelect?.(p.id)}
            >
              {p.jobs > 0 ? <span className="ll-pin__badge">{p.jobs}</span> : null}
              {p.name ? <span className="ll-pin__name">{p.name}</span> : null}
            </button>
          ),
        });
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `dur` only depends on reducedMotion, which is stable per map
  }, [index, view, map, country, labels, locale, selectedId, onSelect]);

  return <MarkerLayer items={items} />;
}
