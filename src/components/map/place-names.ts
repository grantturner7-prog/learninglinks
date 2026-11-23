/**
 * Where place names go on the map. Pure geometry (no DOM, no MapLibre) so it can be unit-tested.
 *
 * Names are drawn as real text over the map. A name is only shown where it fits: inside the frame, clear of the
 * controls, and not on top of a bubble, a pin or another name. Names that do not fit are left out and appear as
 * the person zooms in, which is how a printed atlas behaves.
 */

/** [left, top, right, bottom] in screen pixels. */
export type Box = readonly [number, number, number, number];
export const overlaps = (a: Box, b: Box) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];

/** "city" names are set a little larger and bolder than "district" names. */
export type NameTier = "city" | "district";

const CJK = /[぀-ヿ㐀-鿿]/;

/** Rough on-screen width of a quiet name, in pixels. Chinese glyphs are wider than Latin ones. */
export function nameWidth(name: string, tier: NameTier, narrow: boolean): number {
  const cjk = CJK.test(name);
  const per = cjk ? (tier === "city" ? 13.5 : 12.5) : tier === "city" ? 7.4 : 6.6;
  return Math.round(name.length * per * (narrow ? 0.94 : 1) + (tier === "city" ? 20 : 8));
}

/** Rough width of the white name pill under a bubble. */
export function pillWidth(name: string, narrow: boolean): number {
  return Math.round(name.length * (CJK.test(name) ? (narrow ? 11 : 12.5) : narrow ? 5.9 : 6.5) + 22);
}

export const NAME_HEIGHT: Record<NameTier, number> = { city: 22, district: 17 };

export interface NameCandidate {
  key: string;
  name: string;
  tier: NameTier;
  /** Screen position of the area's anchor (the name is centred here). */
  x: number;
  y: number;
  /** On-screen size of the area's bounding box: a name is not shown on an area that is still a speck. */
  areaW: number;
  areaH: number;
  /** Higher goes first when two names want the same space. */
  priority: number;
}

export interface PlacedName {
  key: string;
  name: string;
  tier: NameTier;
  x: number;
  y: number;
}

/** The corners of the frame that hold the controls, the legend, the credit line and the "where am I" bar. */
export function reservedBoxes(w: number, h: number, narrow: boolean, opts: { crumb?: boolean; legend?: boolean } = {}): Box[] {
  const out: Box[] = [
    [w - (narrow ? 70 : 64), 0, w, narrow ? 170 : 150], // zoom controls, top right
    [w - (narrow ? w : 300), h - 30, w, h], // credit line, bottom right
  ];
  if (opts.legend !== false) out.push([0, h - (narrow ? 130 : 96), narrow ? 180 : 200, h]);
  if (opts.crumb) out.push([0, 0, Math.min(w - 70, narrow ? w - 70 : 420), 50]);
  return out;
}

/**
 * Choose which names to show. `taken` holds what is already on the map (bubbles, pins, name pills); the result never
 * overlaps those or each other. Deterministic: the same input gives the same names.
 */
export function placeNames(
  cands: readonly NameCandidate[],
  taken: readonly Box[],
  frame: { w: number; h: number },
  narrow: boolean,
  opts: {
    limit?: number;
    /**
     * Is this other spot still inside the candidate's own area? Without it a name only ever goes on the area's
     * anchor. With it, a name whose anchor is taken (a school count often sits right there) may move a little way
     * up, down, left or right, as long as it stays inside its own district.
     */
    inside?: (c: NameCandidate, x: number, y: number) => boolean;
  } = {},
): PlacedName[] {
  const limit = opts.limit ?? 80;
  const boxes: Box[] = [...taken];
  const out: PlacedName[] = [];
  const sorted = [...cands].sort((a, b) => b.priority - a.priority || a.key.localeCompare(b.key));
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  for (const c of sorted) {
    if (out.length >= limit) break;
    const lw = nameWidth(c.name, c.tier, narrow);
    const lh = NAME_HEIGHT[c.tier];
    // The area must be big enough on screen to carry a name at all.
    if (c.areaW < lw * 0.5 || c.areaH < lh * 0.9) continue;
    const fits = (x: number, y: number): Box | null => {
      const box: Box = [x - lw / 2, y - lh / 2, x + lw / 2, y + lh / 2];
      if (box[0] < 4 || box[1] < 4 || box[2] > frame.w - 4 || box[3] > frame.h - 4) return null;
      return boxes.some((b) => overlaps(b, box)) ? null : box;
    };
    let spot: { x: number; y: number; box: Box } | null = null;
    const home = fits(c.x, c.y);
    if (home) spot = { x: c.x, y: c.y, box: home };
    else if (opts.inside) {
      const dy = clamp(c.areaH * 0.22, 24, 90);
      const dx = clamp(c.areaW * 0.22, 36, 120);
      for (const [ox, oy] of [[0, -dy], [0, dy], [-dx, 0], [dx, 0], [-dx * 0.7, -dy * 0.8], [dx * 0.7, -dy * 0.8], [-dx * 0.7, dy * 0.8], [dx * 0.7, dy * 0.8]] as const) {
        const x = c.x + ox;
        const y = c.y + oy;
        const box = fits(x, y);
        if (box && opts.inside(c, x, y)) {
          spot = { x, y, box };
          break;
        }
      }
    }
    if (!spot) continue;
    boxes.push(spot.box);
    out.push({ key: c.key, name: c.name, tier: c.tier, x: spot.x, y: spot.y });
  }
  return out;
}

/* ------------------------------------------------------------------------------------------------------------------
 * Count bubbles. They are circles, placed biggest first. One that would sit on top of another is moved just clear of
 * it (Taipei lies inside New Taipei, so their middles almost coincide); only if that is not possible is it left out
 * until the person zooms in.
 * ---------------------------------------------------------------------------------------------------------------- */

export interface BubbleCandidate {
  key: string;
  x: number;
  y: number;
  /** Diameter in pixels. */
  size: number;
  /** The selected area: always shown, exactly on its spot. */
  pinned?: boolean;
}

export interface PlacedBubble {
  key: string;
  /** Where the bubble is drawn. */
  x: number;
  y: number;
  size: number;
  /** How far it was moved from its true spot (0, 0 for most). */
  dx: number;
  dy: number;
}

const GAP = 3;

export function placeBubbles(cands: readonly BubbleCandidate[], frame: { w: number; h: number }, maxNudge = 56): PlacedBubble[] {
  const out: PlacedBubble[] = [];
  const clash = (x: number, y: number, r: number) => out.find((o) => Math.hypot(o.x - x, o.y - y) < o.size / 2 + r + GAP);
  for (const c of cands) {
    if (c.x < 0 || c.y < 0 || c.x > frame.w || c.y > frame.h) continue; // its true spot must be on screen
    const r = c.size / 2;
    let x = c.x;
    let y = c.y;
    const first = c.pinned ? undefined : clash(x, y, r);
    if (first) {
      let ux = c.x - first.x;
      let uy = c.y - first.y;
      const len = Math.hypot(ux, uy);
      if (len < 0.5) {
        ux = 0;
        uy = -1;
      } else {
        ux /= len;
        uy /= len;
      }
      let ok = false;
      for (let d = 4; d <= maxNudge; d += 4) {
        const nx = c.x + ux * d;
        const ny = c.y + uy * d;
        if (nx < r || ny < r || nx > frame.w - r || ny > frame.h - r) break;
        if (!clash(nx, ny, r)) {
          x = nx;
          y = ny;
          ok = true;
          break;
        }
      }
      if (!ok) continue;
    }
    out.push({ key: c.key, x, y, size: c.size, dx: x - c.x, dy: y - c.y });
  }
  return out;
}

export const squareOf = (b: { x: number; y: number; size: number }): Box => [b.x - b.size / 2 - 1, b.y - b.size / 2 - 1, b.x + b.size / 2 + 1, b.y + b.size / 2 + 1];

export type PillSide = "below" | "above" | "right" | "left";
const SIDES: readonly PillSide[] = ["below", "above", "right", "left"];

/**
 * A name pill for each bubble that has room for one: under it if possible, otherwise above, right or left.
 * `taken` must already hold every bubble's square. Returns the side chosen per key, and adds the pills to `taken`.
 */
export function placePills(bubbles: readonly { key: string; name: string; x: number; y: number; size: number; force?: boolean }[], taken: Box[], reserved: readonly Box[], frame: { w: number; h: number }, narrow: boolean): Map<string, PillSide> {
  const out = new Map<string, PillSide>();
  const lh = narrow ? 19 : 21;
  const gap = 6;
  for (const b of bubbles) {
    const lw = pillWidth(b.name, narrow);
    const r = b.size / 2;
    const boxFor = (side: PillSide): Box =>
      side === "below" ? [b.x - lw / 2, b.y + r + gap, b.x + lw / 2, b.y + r + gap + lh]
      : side === "above" ? [b.x - lw / 2, b.y - r - gap - lh, b.x + lw / 2, b.y - r - gap]
      : side === "right" ? [b.x + r + gap, b.y - lh / 2, b.x + r + gap + lw, b.y + lh / 2]
      : [b.x - r - gap - lw, b.y - lh / 2, b.x - r - gap, b.y + lh / 2];
    const fits = (box: Box) => box[0] >= 4 && box[1] >= 4 && box[2] <= frame.w - 4 && box[3] <= frame.h - 4 && !taken.some((t) => overlaps(t, box)) && !reserved.some((t) => overlaps(t, box));
    const side = SIDES.find((sd) => fits(boxFor(sd))) ?? (b.force ? "below" : undefined);
    if (!side) continue;
    taken.push(boxFor(side));
    out.set(b.key, side);
  }
  return out;
}

/* ------------------------------------------------------------------------------------------------------------------
 * School pins. Two schools can share a building (an elementary school and its kindergarten), which would put one pin
 * on top of the other so only one could be pressed. Pins that collide are fanned out around the spot, close enough
 * to read as one place. Every pin is always shown: a school must never become unreachable.
 * ---------------------------------------------------------------------------------------------------------------- */

export function spreadPins(pins: readonly { key: string; x: number; y: number }[], fixed: readonly { x: number; y: number; size: number }[], minDist = 26, maxRings = 3): Map<string, { dx: number; dy: number }> {
  const placed: { x: number; y: number; r: number }[] = fixed.map((f) => ({ x: f.x, y: f.y, r: f.size / 2 + 1 }));
  const out = new Map<string, { dx: number; dy: number }>();
  const pr = minDist / 2;
  // A pin is a square press target, so "clear" means the squares do not touch (not merely the circles).
  const free = (x: number, y: number) => !placed.some((p) => Math.max(Math.abs(p.x - x), Math.abs(p.y - y)) < p.r + pr);
  for (const pin of pins) {
    let x = pin.x;
    let y = pin.y;
    if (!free(x, y)) {
      search: for (let ring = 1; ring <= maxRings; ring++) {
        // The cells of a square ring around the spot, starting straight up and going clockwise.
        const cells: [number, number][] = [];
        for (let i = -ring; i <= ring; i++) for (let j = -ring; j <= ring; j++) if (Math.max(Math.abs(i), Math.abs(j)) === ring) cells.push([i, j]);
        cells.sort((a, b) => ((Math.atan2(a[0], -a[1]) + 2 * Math.PI) % (2 * Math.PI)) - ((Math.atan2(b[0], -b[1]) + 2 * Math.PI) % (2 * Math.PI)));
        for (const [i, j] of cells) {
          const nx = pin.x + i * minDist;
          const ny = pin.y + j * minDist;
          if (free(nx, ny)) {
            x = nx;
            y = ny;
            break search;
          }
        }
      }
    }
    placed.push({ x, y, r: pr });
    out.set(pin.key, { dx: Math.round(x - pin.x), dy: Math.round(y - pin.y) });
  }
  return out;
}
