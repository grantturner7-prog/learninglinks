"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import "./map.css";
import type { Map as MlMap } from "maplibre-gl";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { CountryMapConfig } from "@/lib/geo";
import { MapContext, type MapCtx } from "./context";
import { addBase, BASE_STYLE, fitPadding } from "./style";
import type { GestureMode, MapLabels } from "./types";

export interface MapShellProps {
  country: CountryMapConfig;
  labels: MapLabels;
  className?: string;
  gestures?: GestureMode;
  /** Shown bottom-left, e.g. a colour legend. */
  legend?: ReactNode;
  /** Called when the user presses the "show everything" control. */
  onReset?: () => void;
  /**
   * How far in a person can zoom. There is no street background yet, so past the point where one district fills the
   * frame there is nothing more to see: the area map stops earlier than the school map, whose pins need the room.
   */
  maxZoom?: number;
  children?: ReactNode;
}

function webglAvailable(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") ?? c.getContext("webgl"));
  } catch {
    return false;
  }
}

const WORKER_URL = "/vendor/maplibre/maplibre-gl-worker.mjs";

/**
 * The map frame: creates the MapLibre map from this country's own boundary files, draws the base (coast shadow,
 * land, district and county lines) and provides zoom/reset controls, attribution and loading and no-WebGL states.
 * Layers and markers are supplied by children (see AreaMap and PointMap).
 */
export function MapShell({ country, labels, className = "", gestures = "auto", legend, onReset, maxZoom = 14.5, children }: MapShellProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [ctx, setCtx] = useState<MapCtx | null>(null);
  const [painted, setPainted] = useState(false);
  const [noGl, setNoGl] = useState(false);
  const labelsRef = useRef(labels);
  useEffect(() => {
    labelsRef.current = labels;
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let cancelled = false;
    let map: MlMap | null = null;

    (async () => {
      if (!webglAvailable()) {
        setNoGl(true);
        return;
      }
      const ml = await import("maplibre-gl");
      if (cancelled) return;
      // The worker is served from our own origin (see scripts/sync-map-worker.mjs); bundlers cannot locate it themselves.
      ml.setWorkerUrl(`${WORKER_URL}?v=${ml.getVersion()}`);
      const coop = gestures === "cooperative" || (gestures === "auto" && window.matchMedia("(pointer: coarse)").matches);
      const l = labelsRef.current;
      const [w, s, e, n] = country.bounds.all;
      const pad = fitPadding(container);
      try {
        map = new ml.Map({
          container,
          style: BASE_STYLE,
          bounds: country.bounds.main as unknown as [number, number, number, number],
          fitBoundsOptions: { padding: pad },
          maxBounds: [[w - 2.5, s - 2], [e + 2.5, n + 2]],
          minZoom: 5,
          maxZoom,
          attributionControl: false,
          cooperativeGestures: coop,
          locale: {
            "CooperativeGesturesHandler.WindowsHelpText": l.gestureDesktop,
            "CooperativeGesturesHandler.MacHelpText": l.gestureMac,
            "CooperativeGesturesHandler.MobileHelpText": l.gestureMobile,
          },
          dragRotate: false,
          pitchWithRotate: false,
          renderWorldCopies: false,
          fadeDuration: 0,
        });
      } catch {
        setNoGl(true);
        return;
      }
      const m = map;
      m.touchZoomRotate.disableRotation();
      m.keyboard.disableRotation();
      m.getCanvas().setAttribute("role", "application");
      m.getCanvas().setAttribute("aria-label", l.mapAria);
      m.on("load", () => {
        if (cancelled) return;
        addBase(m, country);
        setCtx({ map: m, ml, country, labels: labelsRef.current, reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches });
        m.once("idle", () => {
          if (!cancelled) setPainted(true);
        });
      });
    })();

    return () => {
      cancelled = true;
      setCtx(null);
      setPainted(false);
      map?.remove();
    };
  }, [country, gestures, maxZoom]);

  const reset = useCallback(() => {
    if (!ctx) return;
    const { map, country: c, reducedMotion } = ctx;
    map.fitBounds(c.bounds.main as unknown as [number, number, number, number], {
      padding: fitPadding(map.getContainer()),
      duration: reducedMotion ? 0 : 700,
    });
    onReset?.();
  }, [ctx, onReset]);

  return (
    <div className={`ll-map ${className}`} role="region" aria-label={labels.mapAria} data-painted={painted ? "1" : "0"}>
      <div ref={containerRef} className="ll-map__canvas" />
      {ctx ? <MapContext.Provider value={ctx}>{children}</MapContext.Provider> : null}

      {ctx ? (
        <div className="ll-ctl" role="group" aria-label={labels.mapAria}>
          <button type="button" className="ll-ctl__btn" onClick={() => ctx.map.zoomIn({ duration: ctx.reducedMotion ? 0 : 250 })} aria-label={labels.zoomIn} title={labels.zoomIn}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
          </button>
          <button type="button" className="ll-ctl__btn" onClick={() => ctx.map.zoomOut({ duration: ctx.reducedMotion ? 0 : 250 })} aria-label={labels.zoomOut} title={labels.zoomOut}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M5 12h14" /></svg>
          </button>
          <button type="button" className="ll-ctl__btn" onClick={reset} aria-label={labels.reset} title={labels.reset}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 9V5a1 1 0 0 1 1-1h4M20 9V5a1 1 0 0 0-1-1h-4M4 15v4a1 1 0 0 0 1 1h4M20 15v4a1 1 0 0 1-1 1h-4" /><circle cx="12" cy="12" r="2.4" /></svg>
          </button>
        </div>
      ) : null}

      {ctx && legend ? <div className="ll-legend">{legend}</div> : null}
      <div className="ll-attrib">{labels.attribution}</div>

      {!noGl ? (
        <div className="ll-veil" aria-hidden={painted} data-hidden={painted ? "1" : "0"}>
          <span className="ll-veil__dot" /> {labels.loading}
        </div>
      ) : (
        <div className="ll-fallback" role="status">
          {labels.noWebgl}
        </div>
      )}
    </div>
  );
}
