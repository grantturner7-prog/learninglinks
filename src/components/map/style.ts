import type { Map as MlMap, LayerSpecification, StyleSpecification } from "maplibre-gl";
import type { CountryMapConfig } from "@/lib/geo";

/**
 * The night map (owner choice, 26 Nov 2026): charcoal land on a darker sea, warming where there are more people,
 * with amber for what is chosen. Literals, because MapLibre paints need real colour values; they follow the night
 * tokens in globals.css.
 */
export const PALETTE = {
  land: "#2b2622",
  landEdge: "#151311",
  countyLine: "#151311",
  districtLine: "#1c1917",
  shadow: "rgba(244, 238, 229, 0.07)",
  /** Density ramp, fewest to most (below the first step an area has no one and keeps the land colour). */
  ramp: ["#39322b", "#473d31", "#574a38", "#685841", "#7a6748"],
  hoverLine: "#d9cfc1",
  amber: "#f2b45a",
  amberDeep: "#ffe6b8",
} as const;

/** No tiles, no glyphs, no sprites: nothing is requested from any other server. The sea is CSS. */
export const BASE_STYLE: StyleSpecification = { version: 8, sources: {}, layers: [] };

export const SOURCE = { counties: "counties", districts: "districts" } as const;

/** Layer ids other layers are inserted relative to. */
export const LAYER = { districtLine: "district-line", countyLine: "county-line" } as const;

export function addBase(map: MlMap, country: CountryMapConfig): void {
  map.addSource(SOURCE.counties, { type: "geojson", data: country.countiesUrl, promoteId: "key" });
  map.addSource(SOURCE.districts, { type: "geojson", data: country.districtsUrl, promoteId: "key" });

  const layers: LayerSpecification[] = [
    // A faint glow around the coast; the land fill drawn next hides the half that falls on land.
    {
      id: "land-glow", type: "line", source: SOURCE.counties,
      layout: { "line-join": "round" },
      paint: { "line-color": PALETTE.shadow, "line-width": ["interpolate", ["linear"], ["zoom"], 5, 4, 10, 12], "line-blur": ["interpolate", ["linear"], ["zoom"], 5, 5, 10, 12], "line-translate": [0, 2] },
    },
    { id: "land", type: "fill", source: SOURCE.counties, paint: { "fill-color": PALETTE.land } },
    // Fine inner edge so the land reads as a slightly raised sheet.
    {
      id: "land-inner", type: "line", source: SOURCE.counties,
      layout: { "line-join": "round" },
      paint: { "line-color": "rgba(244, 238, 229, 0.05)", "line-width": ["interpolate", ["linear"], ["zoom"], 5, 3, 10, 9], "line-blur": ["interpolate", ["linear"], ["zoom"], 5, 3, 10, 7], "line-offset": ["interpolate", ["linear"], ["zoom"], 5, -1.5, 10, -4] },
    },
    {
      id: LAYER.districtLine, type: "line", source: SOURCE.districts,
      paint: { "line-color": PALETTE.districtLine, "line-width": ["interpolate", ["linear"], ["zoom"], 7, 0.5, 12, 1.1], "line-opacity": ["interpolate", ["linear"], ["zoom"], 6.8, 0, 8.2, 1] },
    },
    {
      id: LAYER.countyLine, type: "line", source: SOURCE.counties,
      layout: { "line-join": "round" },
      paint: { "line-color": PALETTE.countyLine, "line-width": ["interpolate", ["linear"], ["zoom"], 5, 0.7, 10, 1.5] },
    },
  ];
  for (const l of layers) map.addLayer(l);
}

/** Resolve when the given sources have their data (feature state can be set from then on). */
export function whenLoaded(map: MlMap, sources: readonly string[], cb: () => void): () => void {
  const ready = () => sources.every((s) => map.getSource(s) && map.isSourceLoaded(s));
  if (ready()) {
    cb();
    return () => {};
  }
  const on = () => {
    if (ready()) {
      map.off("sourcedata", on);
      cb();
    }
  };
  map.on("sourcedata", on);
  return () => map.off("sourcedata", on);
}

/** Room to keep the framed area clear of the controls (right), legend and attribution (bottom). */
export function fitPadding(el: HTMLElement): { top: number; bottom: number; left: number; right: number } {
  return el.clientWidth < 520 ? { top: 20, bottom: 100, left: 16, right: 64 } : { top: 36, bottom: 60, left: 36, right: 72 };
}
