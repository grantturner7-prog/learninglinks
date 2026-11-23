"use client";

import type { Map as MlMap } from "maplibre-gl";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { cityOfKey, type CountryMapConfig } from "@/lib/geo";
import type { MapLabels } from "./types";

export type MlModule = typeof import("maplibre-gl");

export interface MapCtx {
  map: MlMap;
  ml: MlModule;
  country: CountryMapConfig;
  labels: MapLabels;
  reducedMotion: boolean;
}

export const MapContext = createContext<MapCtx | null>(null);

export function useMapCtx(): MapCtx {
  const v = useContext(MapContext);
  if (!v) throw new Error("Map components must be rendered inside <MapShell>");
  return v;
}

/** Increments after every move or resize: use it to recompute things that depend on what is on screen. */
export function useViewVersion(map: MlMap): number {
  const [v, setV] = useState(0);
  useEffect(() => {
    const bump = () => setV((n) => n + 1);
    map.on("moveend", bump);
    map.on("resize", bump);
    return () => {
      map.off("moveend", bump);
      map.off("resize", bump);
    };
  }, [map]);
  return v;
}

/** True while the map is zoomed in past `threshold`. Only re-renders when the flag flips. */
export function useZoomAtLeast(map: MlMap, threshold: number): boolean {
  const [on, setOn] = useState(() => map.getZoom() >= threshold);
  useEffect(() => {
    const check = () => setOn(map.getZoom() >= threshold);
    check();
    map.on("zoom", check);
    return () => {
      map.off("zoom", check);
    };
  }, [map, threshold]);
  return on;
}

export interface AreaInView {
  city: string;
  district: string;
}

/**
 * The city and district under the middle of the view (while `enabled`), read from the map's own district shapes.
 * `layer` must be a fill layer on the districts source. `view` is the value of useViewVersion, so it follows the map.
 */
export function useAreaInView(map: MlMap, view: number, enabled: boolean, layer: string): AreaInView | null {
  return useMemo(() => {
    void view;
    if (!enabled) return null;
    const el = map.getContainer();
    return areaAt(map, layer, el.clientWidth / 2, el.clientHeight / 2);
  }, [map, view, enabled, layer]);
}

/** The city and district drawn at a screen position (null over the sea). `layer` is a fill layer on the districts source. */
export function areaAt(map: MlMap, layer: string, x: number, y: number): AreaInView | null {
  if (!map.getLayer(layer)) return null;
  const k: unknown = map.queryRenderedFeatures([x, y], { layers: [layer] })[0]?.properties?.key;
  return typeof k === "string" && k.includes(":") ? { city: cityOfKey(k), district: k } : null;
}

export function lngLatOf(map: MlMap, x: number, y: number): { lng: number; lat: number } {
  const p = map.unproject([x, y]);
  return { lng: p.lng, lat: p.lat };
}
