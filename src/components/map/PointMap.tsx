"use client";

import Supercluster from "supercluster";
import { useEffect, useMemo, useRef } from "react";
import { requireCountryMap } from "@/lib/geo";
import { anchorOf, bboxOfKey, cityOfKey } from "@/lib/geo";
import { areaAt, lngLatOf, useAreaInView, useMapCtx, useViewVersion, useZoomAtLeast } from "./context";
import { MapShell } from "./MapShell";
import { MarkerLayer, type MarkerItem } from "./MarkerLayer";
import { placeNames, reservedBoxes, spreadPins, type Box, type NameCandidate } from "./place-names";
import { fitPadding, SOURCE, whenLoaded } from "./style";
import { fmt, plural, type GestureMode, type MapLabels, type MapPoint } from "./types";

/** An invisible copy of the district shapes, used to tell which district a spot on the map is in. */
const HERE_LAYER = "here-district";

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
  const districtMode = useZoomAtLeast(map, country.districtZoom);
  const here = useAreaInView(map, view, districtMode, HERE_LAYER);

  // An invisible copy of the district shapes, only so the map can tell which district is in the middle of the view.
  useEffect(() => {
    const off = whenLoaded(map, [SOURCE.districts], () => {
      if (!map.getLayer(HERE_LAYER)) map.addLayer({ id: HERE_LAYER, type: "fill", source: SOURCE.districts, paint: { "fill-color": "#000", "fill-opacity": 0.004 } });
    });
    return () => {
      off();
      if (map.getStyle() && map.getLayer(HERE_LAYER)) map.removeLayer(HERE_LAYER);
    };
  }, [map]);

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
    const el = map.getContainer();
    const w = el.clientWidth;
    const h = el.clientHeight;
    const narrow = w < 520;
    const taken: Box[] = [];
    // Where everything lands on screen. Counts stay put; pins that would sit on top of each other (two schools in
    // one building) are fanned out around the spot, so each one can be seen and pressed.
    const clusterSize = (count: number) => Math.round(Math.min(54, 28 + 6.5 * Math.log2(count)));
    const spots = feats.map((f) => {
      const [lng, lat] = f.geometry.coordinates as [number, number];
      const at = map.project([lng, lat]);
      return { f, lng, lat, x: at.x, y: at.y };
    });
    const isCluster = (sp: (typeof spots)[number]) => "cluster" in sp.f.properties && !!sp.f.properties.cluster;
    const fixed = spots.filter(isCluster).map((sp) => ({ x: sp.x, y: sp.y, size: clusterSize((sp.f.properties as { point_count: number }).point_count) }));
    const pinOrder = spots
      .filter((sp) => !isCluster(sp))
      .map((sp) => ({ key: (sp.f.properties as PointProps).id, x: sp.x, y: sp.y, jobs: (sp.f.properties as PointProps).jobs }))
      .sort((a, b) => (a.key === selectedId ? -1 : b.key === selectedId ? 1 : b.jobs - a.jobs || a.key.localeCompare(b.key)));
    const moved = spreadPins(pinOrder, fixed);
    for (const { f, lng, lat, x, y } of spots) {
      const props = f.properties;
      if ("cluster" in props && props.cluster) {
        const count = props.point_count;
        const size = clusterSize(count);
        taken.push([x - size / 2 - 2, y - size / 2 - 2, x + size / 2 + 2, y + size / 2 + 2]);
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
        const mv = moved.get(p.id) ?? { dx: 0, dy: 0 };
        taken.push([x + mv.dx - 15, y + mv.dy - 15, x + mv.dx + 15, y + mv.dy + 15]);
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
              style={mv.dx || mv.dy ? { translate: `${mv.dx}px ${mv.dy}px` } : undefined}
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
    // Quiet names behind the pins, so a person can tell which city and district they are looking at.
    const cands: NameCandidate[] = [];
    const offer = (key: string, tier: "city" | "district") => {
      const a = anchorOf(country, key);
      const bb = bboxOfKey(country, key);
      if (!a || !bb) return;
      const p = map.project([a[0], a[1]]);
      if (p.x < 0 || p.y < 0 || p.x > w || p.y > h) return;
      const sw = map.project([bb[0], bb[1]]);
      const ne = map.project([bb[2], bb[3]]);
      const areaW = ne.x - sw.x;
      const areaH = sw.y - ne.y;
      cands.push({ key, name: country.label(key, locale), tier, x: p.x, y: p.y, areaW, areaH, priority: (tier === "city" ? 2e9 : 0) + areaW * areaH });
    };
    for (const c of Object.keys(country.cityAnchors)) offer(c, "city");
    if (districtMode) for (const k of Object.keys(country.districtAnchors)) offer(k, "district");
    for (const n of placeNames(cands, [...taken, ...reservedBoxes(w, h, narrow, { crumb: districtMode })], { w, h }, narrow, { inside: (c, px, py) => areaAt(map, HERE_LAYER, px, py)?.[c.tier] === c.key })) {
      out.push({ key: `name:${n.key}`, ...lngLatOf(map, n.x, n.y), z: 10, node: <span className={`ll-name ll-name--${n.tier}`} data-on="light" data-area={n.key} aria-hidden="true">{n.name}</span> });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `dur` only depends on reducedMotion, which is stable per map
  }, [index, view, map, country, labels, locale, selectedId, onSelect, districtMode]);

  const showAll = () => map.fitBounds(country.bounds.main as unknown as [number, number, number, number], { padding: fitPadding(map.getContainer()), duration: dur(700) });
  return (
    <>
      <MarkerLayer items={items} />
      {districtMode ? (
        <nav className="ll-crumb" aria-label={labels.hereAria} data-testid="map-here">
          <ol>
            <li>
              <button type="button" className="ll-crumb__btn" onClick={showAll}>{labels.crumbRoot}</button>
            </li>
            {here ? (
              <>
                <li><span className="ll-crumb__here">{country.label(cityOfKey(here.district), locale)}</span></li>
                <li><span className="ll-crumb__here">{country.label(here.district, locale)}</span></li>
              </>
            ) : null}
          </ol>
        </nav>
      ) : null}
    </>
  );
}
