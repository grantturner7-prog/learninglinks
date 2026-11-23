import type { AreaLevel } from "@/lib/geo";

/** Plain strings only, so a server component can pass translated labels straight in. `{name}` and `{count}` are replaced. */
export interface MapLabels {
  mapAria: string;
  zoomIn: string;
  zoomOut: string;
  reset: string;
  loading: string;
  noWebgl: string;
  /** e.g. "Boundaries: Ministry of the Interior open data" */
  attribution: string;
  legendEducators: string;
  legendFewer: string;
  legendMore: string;
  legendSchool: string;
  legendJobs: string;
  /** "{name}: {count} educator" / "{name}: {count} educators" (used for aria-labels and tooltips) */
  areaOne: string;
  areaOther: string;
  /** "{count} school, zoom in" / "{count} schools, zoom in" */
  clusterOne: string;
  clusterOther: string;
  /** "{count} open job" / "{count} open jobs" */
  jobsOne: string;
  jobsOther: string;
  /** Accessible name for a pin that has no name of its own. */
  pinFallback: string;
  /** First part of the "where am I" bar: the whole country, e.g. "Taiwan". Pressing it shows everything again. */
  crumbRoot: string;
  /** Accessible name of the bar when it shows the chosen area. */
  crumbAria: string;
  /** Accessible name of the bar when it only says which area is in view. */
  hereAria: string;
  gestureDesktop: string;
  gestureMac: string;
  gestureMobile: string;
}

/**
 * auto: one-finger drags and plain scrolling move the PAGE on touch devices (two fingers move the map), while
 *       a mouse can scroll-zoom freely. Right for a map beside a list.
 * cooperative: ctrl/cmd + scroll (desktop) and two fingers (touch) everywhere. Right for a map inside a long page.
 * free: the map always captures gestures. Right for a full-screen map.
 */
export type GestureMode = "auto" | "cooperative" | "free";

export interface AreaBubble {
  key: string;
  level: AreaLevel;
  count: number;
}

export interface MapPoint {
  id: string;
  lat: number;
  lng: number;
  /** Free-form category such as a school type. Not interpreted by the map. */
  kind?: string;
  /** Open job posts at this point. Pins with jobs get an amber badge. */
  jobs?: number;
  /** Public name, used for the pin's accessible label and tooltip. */
  name?: string;
}

export function fmt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ""));
}

export function plural(one: string, other: string, count: number): string {
  return count === 1 ? one : other;
}
