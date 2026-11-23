"use client";

import type { ExpressionSpecification, LayerSpecification, MapMouseEvent } from "maplibre-gl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { anchorOf, bboxOfKey, cityOfKey, levelOfKey, requireCountryMap, type AreaLevel, type BBox, type CountryMapConfig } from "@/lib/geo";
import { areaAt, lngLatOf, useAreaInView, useMapCtx, useViewVersion, useZoomAtLeast } from "./context";
import { MapShell } from "./MapShell";
import { MarkerLayer, type MarkerItem } from "./MarkerLayer";
import { placeBubbles, placeNames, placePills, reservedBoxes, squareOf, type Box, type NameCandidate } from "./place-names";
import { fitPadding, LAYER, PALETTE, SOURCE, whenLoaded } from "./style";
import { fmt, plural, type AreaBubble, type GestureMode, type MapLabels } from "./types";

export interface AreaMapProps {
  /** One entry per area that has educators. Provide city level, district level, or both (district wins when zoomed in). */
  bubbles: readonly AreaBubble[];
  /** Controlled selection. Leave undefined to let the map keep its own. `null` = nothing selected. */
  selectedKey?: string | null;
  onSelect?: (key: string, level: AreaLevel) => void;
  /** Called when the "show everything" control is pressed. */
  onClear?: () => void;
  /** Any "xx-CC" locale; decides the language of area names. */
  locale: string;
  labels: MapLabels;
  /** Country code of a registered map config (see src/lib/geo). Default "TW". */
  country?: string;
  className?: string;
  gestures?: GestureMode;
}

const NO_MATCH: ExpressionSpecification = ["==", ["get", "key"], ""];
const matchKey = (key: string | null): ExpressionSpecification => ["==", ["get", "key"], key ?? ""];

/** Everything except the selection is veiled, so the chosen area stands out. */
function dimFilters(selected: string | null): { c: ExpressionSpecification; d: ExpressionSpecification } {
  if (!selected) return { c: NO_MATCH, d: NO_MATCH };
  if (levelOfKey(selected) === "city") return { c: ["!=", ["get", "key"], selected], d: ["!=", ["get", "city"], selected] };
  return { c: NO_MATCH, d: ["!=", ["get", "key"], selected] };
}

function levelOf(count: number, max: number): number {
  if (count <= 0 || max <= 0) return 0;
  return Math.min(5, Math.max(1, Math.ceil(5 * Math.sqrt(count / max))));
}

/**
 * The area map shows people by district, never by address, and has no street background. Past this zoom a single
 * district fills the frame as one flat colour, so there is nothing more to see.
 */
const AREA_MAX_ZOOM = 12.2;

/**
 * What to frame when a city is chosen: the districts where its educators are (a city such as Taichung is mostly
 * mountain, and framing all of it squeezes the part people want into a corner). Falls back to the whole city.
 */
function populatedBounds(country: CountryMapConfig, city: string, districts: ReadonlyMap<string, number>): BBox | null {
  const whole = bboxOfKey(country, city);
  let w = 180, s = 90, e = -180, n = -90, any = false;
  for (const k of districts.keys()) {
    if (cityOfKey(k) !== city) continue;
    const b = country.districtBbox[k];
    if (!b) continue;
    any = true;
    w = Math.min(w, b[0]); s = Math.min(s, b[1]); e = Math.max(e, b[2]); n = Math.max(n, b[3]);
  }
  if (!any) return whole;
  const mx = (e - w) * 0.06;
  const my = (n - s) * 0.06;
  return [w - mx, s - my, e + mx, n + my];
}

const sizeFor = (count: number, max: number, narrow: boolean) => Math.round((narrow ? 26 : 28) + (narrow ? 14 : 18) * Math.sqrt(Math.max(count, 0) / Math.max(max, 1)));
const shortCount = (n: number, locale: string) => (n >= 10_000 ? `${Math.floor(n / 1000)}k` : new Intl.NumberFormat(locale).format(n));

export function AreaMap({ bubbles, selectedKey, onSelect, onClear, locale, labels, country = "TW", className, gestures }: AreaMapProps) {
  const cfg = requireCountryMap(country);
  const [internal, setInternal] = useState<string | null>(null);
  const selected = selectedKey === undefined ? internal : selectedKey;

  const pick = useCallback(
    (key: string, level: AreaLevel) => {
      setInternal(key);
      onSelect?.(key, level);
    },
    [onSelect],
  );
  const clear = useCallback(() => {
    setInternal(null);
    onClear?.();
  }, [onClear]);

  return (
    <MapShell country={cfg} labels={labels} className={className} gestures={gestures} onReset={clear} maxZoom={AREA_MAX_ZOOM} legend={<Legend labels={labels} />}>
      <AreaLayers bubbles={bubbles} selected={selected} onPick={pick} onClear={clear} locale={locale} />
    </MapShell>
  );
}

function Legend({ labels }: { labels: MapLabels }) {
  return (
    <div className="ll-legend__box">
      <div className="ll-legend__title">{labels.legendEducators}</div>
      <div className="ll-legend__ramp" aria-hidden="true">
        {PALETTE.ramp.map((c) => (
          <span key={c} style={{ background: c }} />
        ))}
      </div>
      <div className="ll-legend__ends">
        <span>{labels.legendFewer}</span>
        <span>{labels.legendMore}</span>
      </div>
    </div>
  );
}

interface Candidate {
  key: string;
  level: AreaLevel;
  count: number;
  lng: number;
  lat: number;
  size: number;
}

function AreaLayers({ bubbles, selected, onPick, onClear, locale }: { bubbles: readonly AreaBubble[]; selected: string | null; onPick: (key: string, level: AreaLevel) => void; onClear: () => void; locale: string }) {
  const { map, country, labels, reducedMotion } = useMapCtx();
  const dz = country.districtZoom;
  const districtMode = useZoomAtLeast(map, dz);
  const view = useViewVersion(map);
  const here = useAreaInView(map, view, districtMode && !selected, "hit-district");
  const [hover, setHover] = useState<string | null>(null);

  // ---- aggregate what we were given ----
  const agg = useMemo(() => {
    const districts = new Map<string, number>();
    const explicitCity = new Map<string, number>();
    for (const b of bubbles) {
      if (b.count <= 0) continue;
      if (b.level === "district" && country.districtAnchors[b.key]) districts.set(b.key, (districts.get(b.key) ?? 0) + b.count);
      else if (b.level === "city" && country.cityAnchors[b.key]) explicitCity.set(b.key, (explicitCity.get(b.key) ?? 0) + b.count);
    }
    const sums = new Map<string, number>();
    for (const [k, n] of districts) sums.set(cityOfKey(k), (sums.get(cityOfKey(k)) ?? 0) + n);
    const cityTotals = new Map<string, number>();
    for (const c of new Set([...sums.keys(), ...explicitCity.keys()])) cityTotals.set(c, explicitCity.get(c) ?? sums.get(c) ?? 0);
    const cityHasDistricts = new Set(sums.keys());
    return { districts, cityTotals, cityHasDistricts };
  }, [bubbles, country]);

  /** The area a click or hover on `key` should act on, or null if nothing is selectable there. */
  const resolve = useCallback(
    (key: string): { key: string; level: AreaLevel } | null => {
      if (levelOfKey(key) === "city") return agg.cityTotals.has(key) ? { key, level: "city" } : null;
      if (agg.districts.has(key)) return { key, level: "district" };
      const c = cityOfKey(key);
      return !agg.cityHasDistricts.has(c) && agg.cityTotals.has(c) ? { key: c, level: "city" } : null;
    },
    [agg],
  );
  const latest = useRef({ resolve, onPick, districtMode });
  useEffect(() => {
    latest.current = { resolve, onPick, districtMode };
  });

  // ---- layers: choropleth, hit targets, hover and selection highlights ----
  useEffect(() => {
    const step = (): ExpressionSpecification => [
      "step", ["coalesce", ["feature-state", "lvl"], 0],
      "rgba(0,0,0,0)", 1, PALETTE.ramp[0], 2, PALETTE.ramp[1], 3, PALETTE.ramp[2], 4, PALETTE.ramp[3], 5, PALETTE.ramp[4],
    ];
    const fadeOut: ExpressionSpecification = ["interpolate", ["linear"], ["zoom"], dz - 0.9, 0.96, dz - 0.2, 0];
    const fadeIn: ExpressionSpecification = ["interpolate", ["linear"], ["zoom"], dz - 0.9, 0, dz - 0.2, 0.96];

    const below: LayerSpecification[] = [
      { id: "area-county-fill", type: "fill", source: SOURCE.counties, paint: { "fill-color": step(), "fill-opacity": fadeOut } },
      { id: "area-district-fill", type: "fill", source: SOURCE.districts, paint: { "fill-color": step(), "fill-opacity": fadeIn } },
      { id: "area-dim-c", type: "fill", source: SOURCE.counties, filter: NO_MATCH, paint: { "fill-color": PALETTE.land, "fill-opacity": ["interpolate", ["linear"], ["zoom"], dz - 0.9, 0.62, dz - 0.2, 0] } },
      { id: "area-dim-d", type: "fill", source: SOURCE.districts, filter: NO_MATCH, paint: { "fill-color": PALETTE.land, "fill-opacity": ["interpolate", ["linear"], ["zoom"], dz - 0.9, 0, dz - 0.2, 0.62] } },
    ];
    for (const l of below) map.addLayer(l, LAYER.districtLine);

    const above: LayerSpecification[] = [
      { id: "hit-county", type: "fill", source: SOURCE.counties, paint: { "fill-color": "#000", "fill-opacity": 0.004 } },
      { id: "hit-district", type: "fill", source: SOURCE.districts, paint: { "fill-color": "#000", "fill-opacity": 0.004 } },
    ];
    for (const [suffix, source] of [["c", SOURCE.counties], ["d", SOURCE.districts]] as const) {
      above.push(
        { id: `hl-hover-fill-${suffix}`, type: "fill", source, filter: NO_MATCH, paint: { "fill-color": PALETTE.amber, "fill-opacity": 0.1 } },
        { id: `hl-hover-line-${suffix}`, type: "line", source, filter: NO_MATCH, layout: { "line-join": "round" }, paint: { "line-color": PALETTE.brand700, "line-width": 1.8, "line-opacity": 0.85 } },
        { id: `hl-sel-glow-${suffix}`, type: "line", source, filter: NO_MATCH, layout: { "line-join": "round" }, paint: { "line-color": PALETTE.amber, "line-width": 10, "line-blur": 7, "line-opacity": 0.6 } },
        { id: `hl-sel-line-${suffix}`, type: "line", source, filter: NO_MATCH, layout: { "line-join": "round" }, paint: { "line-color": PALETTE.amberDeep, "line-width": 2.4 } },
      );
    }
    for (const l of above) map.addLayer(l);

    return () => {
      if (!map.getStyle()) return;
      for (const l of [...below, ...above]) if (map.getLayer(l.id)) map.removeLayer(l.id);
    };
  }, [map, dz]);

  // ---- density shading via feature-state ----
  useEffect(() => {
    let off = () => {};
    off = whenLoaded(map, [SOURCE.counties, SOURCE.districts], () => {
      map.removeFeatureState({ source: SOURCE.counties });
      map.removeFeatureState({ source: SOURCE.districts });
      const maxCity = Math.max(1, ...agg.cityTotals.values());
      const maxDistrict = Math.max(1, ...agg.districts.values());
      for (const [k, n] of agg.cityTotals) map.setFeatureState({ source: SOURCE.counties, id: k }, { lvl: levelOf(n, maxCity) });
      for (const k of Object.keys(country.districtAnchors)) {
        const c = cityOfKey(k);
        const own = agg.districts.get(k);
        // A city we only know as a whole is shaded evenly across its districts.
        const lvl = own !== undefined ? levelOf(own, maxDistrict) : agg.cityHasDistricts.has(c) ? 0 : levelOf(agg.cityTotals.get(c) ?? 0, maxCity);
        if (lvl > 0) map.setFeatureState({ source: SOURCE.districts, id: k }, { lvl });
      }
    });
    return off;
  }, [map, agg, country]);

  // ---- hover and selection highlights ----
  useEffect(() => {
    for (const s of ["c", "d"]) for (const id of [`hl-hover-fill-${s}`, `hl-hover-line-${s}`]) if (map.getLayer(id)) map.setFilter(id, hover ? matchKey(hover) : NO_MATCH);
  }, [map, hover]);
  useEffect(() => {
    for (const s of ["c", "d"]) for (const id of [`hl-sel-glow-${s}`, `hl-sel-line-${s}`]) if (map.getLayer(id)) map.setFilter(id, selected ? matchKey(selected) : NO_MATCH);
    const dim = dimFilters(selected);
    if (map.getLayer("area-dim-c")) map.setFilter("area-dim-c", dim.c);
    if (map.getLayer("area-dim-d")) map.setFilter("area-dim-d", dim.d);
  }, [map, selected]);

  // ---- fly to the selection; when it is cleared (the bar, the page's link, the back button) show everything again ----
  const hadSelection = useRef(false);
  useEffect(() => {
    if (!selected) {
      if (hadSelection.current) map.fitBounds(country.bounds.main as unknown as [number, number, number, number], { padding: fitPadding(map.getContainer()), duration: reducedMotion ? 0 : 700 });
      hadSelection.current = false;
      return;
    }
    hadSelection.current = true;
    const level = levelOfKey(selected);
    const bbox = level === "city" ? populatedBounds(country, selected, agg.districts) : bboxOfKey(country, selected);
    if (!bbox) return;
    const el = map.getContainer();
    const base = fitPadding(el);
    // A district is framed with room around it, so its neighbours (and their names) stay in view for context.
    const extra = level === "district" ? Math.round(Math.min(el.clientWidth, el.clientHeight) * 0.17) : 0;
    const padding = { top: base.top + extra, bottom: base.bottom + extra, left: base.left + extra, right: base.right + extra };
    const cam = map.cameraForBounds([[bbox[0], bbox[1]], [bbox[2], bbox[3]]], { padding, maxZoom: level === "city" ? 11 : AREA_MAX_ZOOM });
    if (!cam?.center) return;
    // For a city, make sure we end up zoomed in far enough for its district bubbles to appear.
    const zoom = level === "city" ? Math.max(cam.zoom ?? 0, dz + 0.15) : cam.zoom;
    map.flyTo({ center: cam.center, zoom, duration: reducedMotion ? 0 : 900, curve: 1.3 });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only a new selection moves the map; new counts (a changed filter) must not
  }, [map, selected, country, dz, reducedMotion]);

  // ---- pointer interaction on the polygons ----
  useEffect(() => {
    const canvas = map.getCanvas();
    const keyAt = (e: MapMouseEvent) => {
      const layer = latest.current.districtMode ? "hit-district" : "hit-county";
      if (!map.getLayer(layer)) return null;
      const f = map.queryRenderedFeatures(e.point, { layers: [layer] })[0];
      const k = f?.properties?.key;
      return typeof k === "string" ? latest.current.resolve(k) : null;
    };
    const onMove = (e: MapMouseEvent) => {
      const hit = keyAt(e);
      canvas.style.cursor = hit ? "pointer" : "";
      setHover(hit?.key ?? null);
    };
    const onClick = (e: MapMouseEvent) => {
      const hit = keyAt(e);
      if (hit) latest.current.onPick(hit.key, hit.level);
    };
    const onLeave = () => setHover(null);
    map.on("mousemove", onMove);
    map.on("click", onClick);
    canvas.addEventListener("mouseleave", onLeave);
    return () => {
      map.off("mousemove", onMove);
      map.off("click", onClick);
      canvas.removeEventListener("mouseleave", onLeave);
    };
  }, [map]);

  // ---- bubbles (real buttons): never overlap each other, and show a name only where there is room ----
  const items = useMemo<MarkerItem[]>(() => {
    void view; // recompute after every pan, zoom or resize
    const el = map.getContainer();
    const w = el.clientWidth;
    const h = el.clientHeight;
    const narrow = w < 520;
    const maxCity = Math.max(1, ...agg.cityTotals.values());
    const maxDistrict = Math.max(1, ...agg.districts.values());
    const bubbleCands: Candidate[] = [];
    const add = (key: string, level: AreaLevel, count: number, max: number) => {
      const a = anchorOf(country, key);
      if (a) bubbleCands.push({ key, level, count, lng: a[0], lat: a[1], size: sizeFor(count, max, narrow) });
    };
    if (districtMode) {
      for (const [k, n] of agg.districts) add(k, "district", n, maxDistrict);
      for (const [c, n] of agg.cityTotals) if (!agg.cityHasDistricts.has(c)) add(c, "city", n, maxCity);
    } else {
      for (const [c, n] of agg.cityTotals) add(c, "city", n, maxCity);
    }
    bubbleCands.sort((a, b) => (a.key === selected ? -1 : b.key === selected ? 1 : b.count - a.count));


    // Pass 1: place the bubbles, biggest first. One that would cover another is moved just clear of it.
    const byKey = new Map(bubbleCands.map((c, i) => [c.key, { c, i }]));
    const spots = placeBubbles(bubbleCands.map((c) => { const p = map.project([c.lng, c.lat]); return { key: c.key, x: p.x, y: p.y, size: c.size, pinned: c.key === selected }; }), { w, h });
    const placed = spots.map((sp) => ({ ...byKey.get(sp.key)!, x: sp.x, y: sp.y, dx: sp.dx, dy: sp.dy }));
    const boxes: Box[] = placed.map((p) => squareOf({ x: p.x, y: p.y, size: p.c.size }));
    // Pass 2: give a name to every bubble that has room for one (the selected one always gets its name).
    const reserved = reservedBoxes(w, h, narrow, { crumb: !!selected || districtMode });
    const sides = placePills(placed.map((p) => ({ key: p.c.key, name: country.label(p.c.key, locale), x: p.x, y: p.y, size: p.c.size, force: p.c.key === selected })), boxes, reserved, { w, h }, narrow);

    // Pass 3: quiet names for every other area that has room, so the map reads like a map: every district when
    // zoomed in, the cities and counties when zoomed out. They are text only (not buttons) and never cover a bubble.
    const withBubble = new Set(placed.map((p) => p.c.key));
    const selCity = selected ? cityOfKey(selected) : null;
    const cands: NameCandidate[] = [];
    const offer = (key: string, tier: "city" | "district") => {
      if (withBubble.has(key)) return;
      const a = anchorOf(country, key);
      const bb = bboxOfKey(country, key);
      if (!a || !bb) return;
      const p = map.project([a[0], a[1]]);
      if (p.x < 0 || p.y < 0 || p.x > w || p.y > h) return;
      const sw = map.project([bb[0], bb[1]]);
      const ne = map.project([bb[2], bb[3]]);
      const areaW = ne.x - sw.x;
      const areaH = sw.y - ne.y;
      cands.push({ key, name: country.label(key, locale), tier, x: p.x, y: p.y, areaW, areaH, priority: (tier === "city" ? 2e9 : 0) + (cityOfKey(key) === selCity ? 1e9 : 0) + areaW * areaH });
    };
    for (const c of Object.keys(country.cityAnchors)) offer(c, "city");
    if (districtMode) for (const k of Object.keys(country.districtAnchors)) offer(k, "district");
    const names = placeNames(cands, [...boxes, ...reserved], { w, h }, narrow, { inside: (c, x, y) => areaAt(map, "hit-district", x, y)?.[c.tier] === c.key });
    // A name on the deepest shade needs light text; everywhere else the ink colour reads well (4.5:1 or better).
    const onDeep = (key: string): boolean => {
      if (levelOfKey(key) !== "district" || !districtMode) return false;
      if (selected && (levelOfKey(selected) === "city" ? cityOfKey(key) !== selected : key !== selected)) return false; // veiled, so light
      const c = cityOfKey(key);
      const own = agg.districts.get(key);
      const lvl = own !== undefined ? levelOf(own, maxDistrict) : agg.cityHasDistricts.has(c) ? 0 : levelOf(agg.cityTotals.get(c) ?? 0, maxCity);
      return lvl >= 5;
    };
    const quiet: MarkerItem[] = names.map((n) => ({
      key: `name:${n.key}`,
      ...lngLatOf(map, n.x, n.y),
      z: 10,
      node: (
        <span className={`ll-name ll-name--${n.tier}`} data-on={onDeep(n.key) ? "deep" : "light"} data-plate={n.tier === "city" && (districtMode || agg.cityTotals.has(n.key)) ? "1" : "0"} data-out={selCity && cityOfKey(n.key) !== selCity ? "1" : "0"} data-area={n.key} aria-hidden="true">
          {n.name}
        </span>
      ),
    }));

    const bubbleItems = placed.map(({ c, i, dx, dy }) => {
      const name = country.label(c.key, locale);
      const sel = c.key === selected;
      const side = sides.get(c.key);
      return {
        key: `${c.level}:${c.key}`,
        lng: c.lng,
        lat: c.lat,
        z: sel ? 1000 : 500 - i,
        node: (
          <button
            type="button"
            className="ll-bubble"
            style={{ ["--size" as string]: `${c.size}px`, translate: dx || dy ? `${Math.round(dx)}px ${Math.round(dy)}px` : undefined }}
            data-selected={sel ? "1" : "0"}
            data-label={side ? "1" : "0"}
            data-side={side ?? "below"}
            aria-pressed={sel}
            aria-label={fmt(plural(labels.areaOne, labels.areaOther, c.count), { name: country.longLabel(c.key, locale), count: c.count })}
            onClick={() => onPick(c.key, c.level)}
            onMouseEnter={() => setHover(c.key)}
            onMouseLeave={() => setHover(null)}
            onFocus={() => setHover(c.key)}
            onBlur={() => setHover(null)}
          >
            <span className="ll-bubble__n">{shortCount(c.count, locale)}</span>
            <span className="ll-bubble__name">{name}</span>
          </button>
        ),
      };
    });
    return [...quiet, ...bubbleItems];
  }, [agg, districtMode, selected, view, map, country, locale, labels, onPick]);

  // ---- the "where am I" bar: the chosen area with a way back out, or (nothing chosen) the area in view ----
  // "Taiwan" always shows the whole country again, whether an area was chosen or the person only zoomed in by hand.
  const showAll = () => {
    map.fitBounds(country.bounds.main as unknown as [number, number, number, number], { padding: fitPadding(map.getContainer()), duration: reducedMotion ? 0 : 700 });
    onClear();
  };
  const selCity = selected ? cityOfKey(selected) : null;
  const selDistrict = selected && levelOfKey(selected) === "district" ? selected : null;
  return (
    <>
      <MarkerLayer items={items} />
      {selected && selCity ? (
        <nav className="ll-crumb" aria-label={labels.crumbAria} data-testid="map-crumb">
          <ol>
            <li>
              <button type="button" className="ll-crumb__btn" onClick={showAll}>{labels.crumbRoot}</button>
            </li>
            <li>
              {selDistrict ? (
                <button type="button" className="ll-crumb__btn" onClick={() => onPick(selCity, "city")}>{country.label(selCity, locale)}</button>
              ) : (
                <span className="ll-crumb__here" aria-current="true">{country.label(selCity, locale)}</span>
              )}
            </li>
            {selDistrict ? (
              <li>
                <span className="ll-crumb__here" aria-current="true">{country.longLabel(selDistrict, locale)}</span>
              </li>
            ) : null}
          </ol>
        </nav>
      ) : districtMode ? (
        <nav className="ll-crumb" aria-label={labels.hereAria} data-testid="map-here">
          <ol>
            <li>
              <button type="button" className="ll-crumb__btn" onClick={showAll}>{labels.crumbRoot}</button>
            </li>
            {here ? (
              <li>
                {agg.cityTotals.has(here.city) ? (
                  <button type="button" className="ll-crumb__btn" onClick={() => onPick(here.city, "city")}>{country.label(here.city, locale)}</button>
                ) : (
                  <span className="ll-crumb__here">{country.label(here.city, locale)}</span>
                )}
              </li>
            ) : null}
          </ol>
        </nav>
      ) : null}
    </>
  );
}
