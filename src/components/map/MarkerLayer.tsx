"use client";

import type { Marker } from "maplibre-gl";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useMapCtx } from "./context";

export interface MarkerItem {
  key: string;
  lng: number;
  lat: number;
  node: ReactNode;
  z?: number;
}

/**
 * Renders React nodes as real DOM markers on the map. DOM (not canvas text) keeps bubbles keyboard-focusable,
 * screen-reader friendly and crisp in any script, and needs no glyph server.
 */
export function MarkerLayer({ items }: { items: readonly MarkerItem[] }) {
  const { map, ml } = useMapCtx();
  const store = useRef(new Map<string, { marker: Marker; el: HTMLDivElement }>());
  const [els, setEls] = useState<ReadonlyMap<string, HTMLDivElement>>(() => new Map());

  useEffect(() => {
    const s = store.current;
    const keep = new Set(items.map((i) => i.key));
    for (const [k, v] of s) {
      if (!keep.has(k)) {
        v.marker.remove();
        s.delete(k);
      }
    }
    for (const it of items) {
      let entry = s.get(it.key);
      if (!entry) {
        const el = document.createElement("div");
        el.className = "ll-marker";
        const marker = new ml.Marker({ element: el, anchor: "center" }).setLngLat([it.lng, it.lat]).addTo(map);
        entry = { marker, el };
        s.set(it.key, entry);
      } else {
        entry.marker.setLngLat([it.lng, it.lat]);
      }
      entry.el.style.zIndex = String(it.z ?? 0);
    }
    // Syncing React with elements owned by the map (an external system): one extra render is intended here.
    setEls(new Map([...s].map(([k, v]) => [k, v.el])));
  }, [items, map, ml]);

  useEffect(() => {
    const s = store.current;
    return () => {
      for (const v of s.values()) v.marker.remove();
      s.clear();
    };
  }, []);

  return (
    <>
      {items.map((it) => {
        const el = els.get(it.key);
        return el ? createPortal(it.node, el, it.key) : null;
      })}
    </>
  );
}
