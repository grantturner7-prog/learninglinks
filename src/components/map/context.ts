"use client";

import type { Map as MlMap } from "maplibre-gl";
import { createContext, useContext, useEffect, useState } from "react";
import type { CountryMapConfig } from "@/lib/geo";
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
