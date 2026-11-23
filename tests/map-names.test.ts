import { describe, expect, it } from "vitest";
import { nameWidth, overlaps, placeBubbles, placeNames, placePills, reservedBoxes, spreadPins, squareOf, type Box, type NameCandidate } from "@/components/map/place-names";

const cand = (o: Partial<NameCandidate> & { key: string }): NameCandidate => ({ name: o.key, tier: "district", x: 400, y: 300, areaW: 200, areaH: 120, priority: 1, ...o });
const boxOf = (p: { name: string; tier: "city" | "district"; x: number; y: number }): Box => {
  const w = nameWidth(p.name, p.tier, false);
  const h = p.tier === "city" ? 22 : 17;
  return [p.x - w / 2, p.y - h / 2, p.x + w / 2, p.y + h / 2];
};
const frame = { w: 800, h: 576 };

describe("place names on the map", () => {
  it("shows a name where there is room", () => {
    const out = placeNames([cand({ key: "Xitun" })], [], frame, false);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ key: "Xitun", x: 400, y: 300 });
  });

  it("never puts two names on top of each other: the more important one wins", () => {
    const out = placeNames([cand({ key: "Small", priority: 1, x: 405, y: 303 }), cand({ key: "Big", priority: 9 })], [], frame, false);
    expect(out.map((n) => n.key)).toEqual(["Big"]);
    const far = placeNames([cand({ key: "Small", priority: 1, x: 600, y: 100 }), cand({ key: "Big", priority: 9 })], [], frame, false);
    expect(far.map((n) => n.key).sort()).toEqual(["Big", "Small"]);
    const [a, b] = far.map(boxOf);
    expect(overlaps(a!, b!)).toBe(false);
  });

  it("never covers a bubble or a pin that is already on the map", () => {
    const bubble: Box = [380, 280, 420, 320];
    expect(placeNames([cand({ key: "Xitun" })], [bubble], frame, false)).toHaveLength(0);
  });

  it("leaves out a name whose area is still a speck (it appears when the person zooms in)", () => {
    expect(placeNames([cand({ key: "Central", areaW: 9, areaH: 7 })], [], frame, false)).toHaveLength(0);
    expect(placeNames([cand({ key: "Central", areaW: 90, areaH: 70 })], [], frame, false)).toHaveLength(1);
  });

  it("keeps names inside the frame", () => {
    expect(placeNames([cand({ key: "Edge", x: 6, y: 300 })], [], frame, false)).toHaveLength(0);
    expect(placeNames([cand({ key: "Edge", x: 400, y: 572 })], [], frame, false)).toHaveLength(0);
  });

  it("keeps names clear of the controls, the legend, the credit line and the where-am-I bar", () => {
    const reserved = reservedBoxes(frame.w, frame.h, false, { crumb: true });
    const corners = [
      cand({ key: "top right", x: 770, y: 60 }),
      cand({ key: "bottom left", x: 90, y: 540 }),
      cand({ key: "bottom right", x: 680, y: 566 }),
      cand({ key: "top left", x: 120, y: 26 }),
      cand({ key: "middle", x: 400, y: 300 }),
    ];
    expect(placeNames(corners, reserved, frame, false).map((n) => n.key)).toEqual(["middle"]);
  });

  it("gives the same result for the same input, whatever order the areas arrive in", () => {
    const list = Array.from({ length: 40 }, (_, i) => cand({ key: `d${i}`, x: 60 + (i % 8) * 90, y: 60 + Math.floor(i / 8) * 40, priority: (i * 7) % 11 }));
    const a = placeNames(list, [], frame, false).map((n) => n.key);
    const b = placeNames([...list].reverse(), [], frame, false).map((n) => n.key);
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThan(5);
    const boxes = placeNames(list, [], frame, false).map(boxOf);
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) expect(overlaps(boxes[i]!, boxes[j]!)).toBe(false);
  });

  it("allows for Chinese names being wider per character, and city names being set larger", () => {
    expect(nameWidth("西屯區", "district", false)).toBeGreaterThan(nameWidth("abc", "district", false));
    expect(nameWidth("Taichung City", "city", false)).toBeGreaterThan(nameWidth("Taichung City", "district", false));
  });

  it("stops at the limit so a zoomed-out map is not a wall of text", () => {
    const many = Array.from({ length: 300 }, (_, i) => cand({ key: `d${i}`, name: "ab", x: 20 + (i % 30) * 26, y: 20 + Math.floor(i / 30) * 30, areaW: 60, areaH: 40 }));
    expect(placeNames(many, [], frame, false, { limit: 25 })).toHaveLength(25);
  });
});

describe("count bubbles on the map", () => {
  const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

  it("moves a bubble clear of a bigger one instead of hiding it (Taipei inside New Taipei)", () => {
    const out = placeBubbles([{ key: "new-taipei", x: 499, y: 82, size: 46 }, { key: "taipei", x: 492, y: 74, size: 44 }], frame);
    expect(out.map((b) => b.key)).toEqual(["new-taipei", "taipei"]);
    const [a, b] = out;
    expect(a).toMatchObject({ dx: 0, dy: 0 });
    expect(dist(a!, b!)).toBeGreaterThanOrEqual(a!.size / 2 + b!.size / 2);
    expect(Math.hypot(b!.dx, b!.dy)).toBeLessThanOrEqual(56);
    // moved away from the neighbour, not across it
    expect(b!.x).toBeLessThan(492);
    expect(b!.y).toBeLessThan(74);
  });

  it("leaves a bubble out only when there is no room near its spot", () => {
    const crowd = [{ key: "a", x: 400, y: 300, size: 60 }, { key: "b", x: 400, y: 300, size: 30 }];
    expect(placeBubbles(crowd, frame, 8).map((b) => b.key)).toEqual(["a"]);
    expect(placeBubbles(crowd, frame, 56).map((b) => b.key)).toEqual(["a", "b"]);
  });

  it("never draws two bubbles on top of each other, however many there are", () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ key: `d${i}`, x: 380 + (i % 6) * 9, y: 280 + Math.floor(i / 6) * 9, size: 28 + (i % 3) * 4 }));
    const out = placeBubbles(many, frame);
    expect(out.length).toBeGreaterThan(3);
    for (let i = 0; i < out.length; i++) for (let j = i + 1; j < out.length; j++) expect(dist(out[i]!, out[j]!)).toBeGreaterThanOrEqual(out[i]!.size / 2 + out[j]!.size / 2);
  });

  it("keeps the selected area exactly on its spot and skips areas that are off screen", () => {
    const out = placeBubbles([{ key: "big", x: 400, y: 300, size: 50 }, { key: "sel", x: 404, y: 302, size: 30, pinned: true }, { key: "off", x: -20, y: 300, size: 30 }], frame);
    expect(out.find((b) => b.key === "sel")).toMatchObject({ x: 404, y: 302, dx: 0, dy: 0 });
    expect(out.some((b) => b.key === "off")).toBe(false);
  });

  it("puts a name under a bubble, or above or beside it when underneath is taken", () => {
    const a = { key: "tainan", name: "Tainan City", x: 315, y: 406, size: 33 };
    const b = { key: "kaohsiung", name: "Kaohsiung City", x: 334, y: 452, size: 34 };
    const taken = [squareOf(a), squareOf(b)];
    const sides = placePills([b, a], taken, [], frame, false);
    expect(sides.get("kaohsiung")).toBe("below");
    expect(sides.get("tainan")).not.toBe("below"); // Kaohsiung's bubble is in the way underneath
    expect(sides.get("tainan")).toBeDefined();
    // no pill covers a bubble or another pill
    const pills = taken.slice(2);
    expect(pills).toHaveLength(2);
    expect(overlaps(pills[0]!, pills[1]!)).toBe(false);
    for (const p of pills) for (const sq of taken.slice(0, 2)) expect(overlaps(p, sq)).toBe(false);
  });

  it("always names the selected bubble, and leaves a name out when no side has room", () => {
    const b = { key: "x", name: "A very long district name", x: 30, y: 20, size: 30 };
    expect(placePills([b], [squareOf(b)], [], { w: 80, h: 50 }, false).has("x")).toBe(false);
    expect(placePills([{ ...b, force: true }], [squareOf(b)], [], { w: 80, h: 50 }, false).get("x")).toBe("below");
  });
});

describe("a name whose own spot is taken", () => {
  const count: Box = [370, 270, 430, 330]; // a school count sitting on the district's middle

  it("stays hidden unless the map can tell where the district is", () => {
    expect(placeNames([cand({ key: "Xinyi", areaW: 400, areaH: 300 })], [count], frame, false)).toHaveLength(0);
  });

  it("moves a little way inside its own district", () => {
    const out = placeNames([cand({ key: "Xinyi", areaW: 400, areaH: 300 })], [count], frame, false, { inside: () => true });
    expect(out).toHaveLength(1);
    const box = boxOf({ ...out[0]!, name: "Xinyi", tier: "district" });
    expect(overlaps(box, count)).toBe(false);
    expect(Math.hypot(out[0]!.x - 400, out[0]!.y - 300)).toBeLessThanOrEqual(150);
  });

  it("never moves into a neighbouring district", () => {
    const calls: [number, number][] = [];
    const out = placeNames([cand({ key: "Xinyi", areaW: 400, areaH: 300 })], [count], frame, false, { inside: (_c, x, y) => { calls.push([x, y]); return false; } });
    expect(out).toHaveLength(0);
    expect(calls.length).toBeGreaterThan(3); // it tried the other spots and was told no each time
  });

  it("uses its own spot when that is free, without asking", () => {
    let asked = 0;
    const out = placeNames([cand({ key: "Xinyi" })], [], frame, false, { inside: () => { asked++; return true; } });
    expect(out[0]).toMatchObject({ x: 400, y: 300 });
    expect(asked).toBe(0);
  });
});

describe("school pins that share a spot", () => {
  const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
  const at = (pins: { key: string; x: number; y: number }[], moved: Map<string, { dx: number; dy: number }>) => pins.map((p) => ({ key: p.key, x: p.x + moved.get(p.key)!.dx, y: p.y + moved.get(p.key)!.dy }));

  it("leaves a pin alone when nothing is in its way", () => {
    const pins = [{ key: "a", x: 100, y: 100 }, { key: "b", x: 300, y: 300 }];
    expect([...spreadPins(pins, []).values()]).toEqual([{ dx: 0, dy: 0 }, { dx: 0, dy: 0 }]);
  });

  it("fans out schools in the same building so each can be pressed (24px targets, none covered)", () => {
    const pins = Array.from({ length: 7 }, (_, i) => ({ key: `s${i}`, x: 400 + (i % 2), y: 300 }));
    const spots = at(pins, spreadPins(pins, []));
    expect(spots).toHaveLength(7); // every school is still on the map
    // the 24px squares never touch: apart by at least 24px across or down
    for (let i = 0; i < spots.length; i++) for (let j = i + 1; j < spots.length; j++) expect(Math.max(Math.abs(spots[i]!.x - spots[j]!.x), Math.abs(spots[i]!.y - spots[j]!.y))).toBeGreaterThanOrEqual(24);
    for (const s of spots) expect(dist(s, { x: 400, y: 300 })).toBeLessThanOrEqual(80); // still reads as one place
    expect(spots[0]).toMatchObject({ x: 400, y: 300 }); // the first one keeps the true spot
  });

  it("keeps pins off the school counts", () => {
    const pins = [{ key: "a", x: 410, y: 300 }];
    const [spot] = at(pins, spreadPins(pins, [{ x: 400, y: 300, size: 50 }]));
    expect(Math.max(Math.abs(spot!.x - 400), Math.abs(spot!.y - 300))).toBeGreaterThanOrEqual(25 + 12); // the count's square and the pin's square do not touch
  });

  it("gives the same layout every time", () => {
    const pins = Array.from({ length: 12 }, (_, i) => ({ key: `s${i}`, x: 200 + (i % 3) * 5, y: 200 + (i % 4) * 4 }));
    expect([...spreadPins(pins, []).entries()]).toEqual([...spreadPins(pins, []).entries()]);
  });

  it("never drops a pin, even in an impossible crowd", () => {
    const pins = Array.from({ length: 60 }, (_, i) => ({ key: `s${i}`, x: 400, y: 300 }));
    expect(spreadPins(pins, []).size).toBe(60);
  });
});
