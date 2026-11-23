/* ================= the zoomable map: Taiwan, its 22 cities and counties and all 368 districts =================
   Drawn from shapes built into this file (docs/demo/export-map.ts): no map service, nothing is fetched.
   Same behaviour as the real site's map: bubbles per city, then per district once you zoom in; people appear by
   area only, never at a point. The map element is created once and kept across re-renders, so panning and gliding
   are not interrupted when the page around it is redrawn. */

const MAP_DZ = 1.8;       // how far in (times the opening view) before cities give way to districts
const MAP_ZMAX = 24;      // deepest zoom: about 16 km across, so even the smallest district keeps its neighbours in view
const MAP_CITY_ZMAX = 12; // deepest a tap on a city takes you
const MAP_DIST_ZMAX = 18; // deepest a tap on a district takes you

/* ---------- shapes, decoded once ---------- */
const GEO = (() => {
  const arcs = MAPD.arcs.map((a) => { const p = a.slice(); for (let i = 2; i < p.length; i++) p[i] += p[i - 2]; return p; });
  const ring = (r) => {
    const out = [];
    r.forEach((i) => {
      const a = arcs[i < 0 ? ~i : i], n = a.length / 2;
      if (i >= 0) for (let k = out.length ? 1 : 0; k < n; k++) out.push(a[2 * k], a[2 * k + 1]);
      else for (let k = out.length ? n - 2 : n - 1; k >= 0; k--) out.push(a[2 * k], a[2 * k + 1]);
    });
    return out;
  };
  const shape = (polys) => {
    let d = "", bbox = null; const rings = [];
    polys.forEach((poly, pi) => poly.forEach((r, ri) => {
      const p = ring(r); rings.push(p);
      d += "M" + p[0] + " " + p[1] + "l";
      for (let k = 2; k < p.length; k += 2) d += (p[k] - p[k - 2]) + " " + (p[k + 1] - p[k - 1]) + " ";
      d += "z";
      if (pi === 0 && ri === 0) { bbox = [Infinity, Infinity, -Infinity, -Infinity]; for (let k = 0; k < p.length; k += 2) { bbox[0] = Math.min(bbox[0], p[k]); bbox[2] = Math.max(bbox[2], p[k]); bbox[1] = Math.min(bbox[1], p[k + 1]); bbox[3] = Math.max(bbox[3], p[k + 1]); } }
    }));
    return { d, rings, bbox };
  };
  const d = MAPD.d.map(([key, en, zh, ax, ay, r, polys]) => Object.assign({ key, city: key.split(":")[0], en, zh, ax, ay, r }, shape(polys)));
  const c = MAPD.c.map(([key, ax, ay, r, polys]) => Object.assign({ key, ax, ay, r }, shape(polys)));
  c.forEach((x) => {
    x.dists = d.filter((y) => y.city === x.key);
    // What "show me this city" frames: its districts' main land (an islet far offshore does not shrink the view).
    x.fit = x.dists.reduce((b, y) => [Math.min(b[0], y.bbox[0]), Math.min(b[1], y.bbox[1]), Math.max(b[2], y.bbox[2]), Math.max(b[3], y.bbox[3])], [Infinity, Infinity, -Infinity, -Infinity]);
  });
  return { d, c, dBy: new Map(d.map((x) => [x.key, x])), cBy: new Map(c.map((x) => [x.key, x])), main: MAPD.main, all: MAPD.all };
})();
GEO.d.forEach((x) => { if (!DIST[x.key]) DIST[x.key] = [x.en, x.zh]; });
[["kinmen", "Kinmen County", "金門縣"], ["lienchiang", "Lienchiang County", "連江縣"]].forEach(([k, en, zh]) => { if (!CITY[k]) CITY[k] = [en, zh]; });

const cityOfDist = (k) => String(k || "").split(":")[0];
/** "Xitun" / "西屯區": the short name drawn on the map. */
const distName = (k) => lab(DIST[k] || [k, k]);
/** "Xitun District" / "西屯區": the full name for the breadcrumb, headings and screen readers. */
function distFull(k) {
  const pair = DIST[k] || [k, k];
  if (st.lang === "zh") return pair[1];
  const suffix = { "區": "District", "鄉": "Township", "鎮": "Township", "市": "City" }[pair[1].slice(-1)] || "";
  return suffix && !pair[0].endsWith(suffix) ? pair[0] + " " + suffix : pair[0];
}
function inShape(sh, x, y) {
  let inside = false;
  sh.rings.forEach((p) => { for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) { const xi = p[i], yi = p[i + 1], xj = p[j], yj = p[j + 1]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside; } });
  return inside;
}

/* ---------- where a school's pin sits: inside its own district (or its city), never at an address ---------- */
function pinSpots(schools) {
  const groups = new Map();
  schools.forEach((s) => { const k = s.district && GEO.dBy.has(s.district) ? s.district : s.city; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(s); });
  const out = new Map();
  groups.forEach((list, k) => {
    const g = GEO.dBy.get(k) || GEO.cBy.get(k);
    if (!g) return;
    list.forEach((s, i) => {
      let x = g.ax, y = g.ay;
      if (list.length > 1) {
        const ang = (2 * Math.PI * i) / list.length + 0.6;
        for (let f = 0.5; f > 0.05; f *= 0.6) { x = g.ax + Math.cos(ang) * g.r * f; y = g.ay + Math.sin(ang) * g.r * f; if (inShape(g, x, y)) break; }
      }
      out.set(s.id, { x, y, area: k });
    });
  });
  return out;
}

/* ---------- one map: state that survives re-renders ---------- */
const MV = {};
let MAP_PENDING = {}, MAP_FORCE = false;
const mapReduced = () => { try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } };
const clampN = (v, a, b) => Math.max(a, Math.min(b, v));
const RAMP = ["", "var(--lilac-100)", "var(--lilac-200)", "var(--lilac-300)", "var(--lilac-400)"];
const lvl = (n, max) => (n > 0 && max > 0 ? clampN(Math.ceil(4 * Math.sqrt(n / max)), 1, 4) : 0);

let _measure = null; const _widths = new Map();
function textW(text, font) {
  const k = font + "|" + text;
  if (_widths.has(k)) return _widths.get(k);
  let w;
  try { _measure = _measure || document.createElement("canvas").getContext("2d"); _measure.font = font; w = _measure.measureText(text).width; } catch (e) { w = 0; }
  if (!w) w = [...text].reduce((n, ch) => n + (/[぀-鿿]/.test(ch) ? 12.5 : 6.6), 0);
  _widths.set(k, w);
  return w;
}
const FONT_PILL = '800 12px "Plus Jakarta Sans", "PingFang TC", "Noto Sans TC", "Microsoft JhengHei", sans-serif';
const FONT_QUIET = '700 11.5px "Plus Jakarta Sans", "PingFang TC", "Noto Sans TC", "Microsoft JhengHei", sans-serif';

/** Views call this: it leaves a slot in the page and remembers what to show there (see mapsMount). */
function mapSlot(id, o) { MAP_PENDING[id] = o; return `<div class="zslot" id="${id}"></div>`; }

/** Runs after every render: put each map back into its slot and bring it up to date. */
function mapsMount() {
  Object.keys(MV).forEach((id) => { if (!MAP_PENDING[id]) { cancelAnimationFrame(MV[id].raf); delete MV[id]; } });
  Object.keys(MAP_PENDING).forEach((id) => { const slot = document.getElementById(id); if (slot) mapUpdate(id, slot, MAP_PENDING[id]); });
  MAP_PENDING = {}; MAP_FORCE = false;
}
/** After a keyboard press on the map (not a mouse click), keep focus somewhere useful: the breadcrumb's current place.
    The bubble that was pressed may be gone by now (a city's bubble gives way to its districts). */
function mapKeyFocus(el, e) {
  if (!e || e.detail !== 0 || (el.closest && el.closest(".zctl"))) return;
  const cur = document.querySelector('.zcrumb [aria-current="location"]');
  if (cur) cur.focus({ preventScroll: true });
}

function mapCreate(id, kind) {
  const el = document.createElement("div");
  el.className = "map zmap"; el.dataset.kind = kind; el.dataset.mode = "country";
  const land = GEO.c.map((x) => x.d).join("");
  const cities = GEO.c.map((x) => `<path class="zc" data-k="${x.key}" d="${x.d}"><title>${h(lab(CITY[x.key]))}</title></path>`).join("");
  const dists = GEO.d.map((x) => `<path class="zd" data-k="${x.key}" d="${x.d}"><title>${h(distFull(x.key))}, ${h(lab(CITY[x.city]))}</title></path>`).join("");
  el.innerHTML = `<svg class="zsvg" role="img" aria-label="${kind === "jobs" ? T("Map of schools in Taiwan", "臺灣學校地圖") : T("Map of Taiwan", "臺灣地圖")}" preserveAspectRatio="xMidYMid meet" focusable="false">
      <path class="zshadow" d="${land}"/><path class="zland" d="${land}"/><g class="zg-c">${cities}</g><g class="zg-d">${dists}</g><path class="zcl" d="${land}"/><path class="zsel-glow" d=""/><path class="zsel" d=""/></svg>
    <nav class="zcrumb" aria-label="${T("Where the map is", "地圖目前位置")}"></nav>
    <div class="zctl" role="group" aria-label="${T("Map controls", "地圖控制")}">
      <button type="button" id="${id}-in" data-act="mzoom" data-v="in" aria-label="${T("Zoom in", "放大")}" title="${T("Zoom in", "放大")}"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></button>
      <button type="button" id="${id}-out" data-act="mzoom" data-v="out" aria-label="${T("Zoom out", "縮小")}" title="${T("Zoom out", "縮小")}"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14"/></svg></button>
      <button type="button" id="${id}-all" data-act="mall" aria-label="${T("Show all of Taiwan", "顯示全臺灣")}" title="${T("Show all of Taiwan", "顯示全臺灣")}"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9V5a1 1 0 0 1 1-1h4M20 9V5a1 1 0 0 0-1-1h-4M4 15v4a1 1 0 0 0 1 1h4M20 15v4a1 1 0 0 1-1 1h-4"/><circle cx="12" cy="12" r="2.4"/></svg></button>
    </div>
    <div class="zov"></div>
    <div class="legend"></div>`;
  const m = { id, kind, el, lang: st.lang, svg: el.querySelector(".zsvg"), ov: el.querySelector(".zov"), crumb: el.querySelector(".zcrumb"), ctl: el.querySelector(".zctl"), legend: el.querySelector(".legend"),
    selGlow: el.querySelector(".zsel-glow"), selLine: el.querySelector(".zsel"), pc: new Map(), pd: new Map(), cx: 0, cy: 0, s: 1, has: false, sel: "", raf: 0, target: null, bubs: [], names: [], pins: [], reserved: [] };
  el.querySelectorAll(".zc").forEach((p) => m.pc.set(p.dataset.k, p));
  el.querySelectorAll(".zd").forEach((p) => m.pd.set(p.dataset.k, p));
  mapEvents(m);
  return m;
}

/* ---------- pointer, wheel and touch ---------- */
function mapEvents(m) {
  const el = m.el;
  const onUi = (t) => !!(t && t.closest && t.closest(".zctl, .zcrumb, .legend"));
  const local = (e) => { const r = el.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const stop = () => { cancelAnimationFrame(m.raf); m.target = null; };
  /** Zoom by `f` keeping the point under (px, py) where it is. */
  m.zoomAt = (f, px, py, ms) => {
    const s = clampN(m.s * f, m.sMin, m.sHome * MAP_ZMAX);
    const wx = m.cx + (px - m.cw / 2) / m.s, wy = m.cy + (py - m.ch / 2) / m.s;
    const t = mapClamp(m, { s, cx: wx - (px - m.cw / 2) / s, cy: wy - (py - m.ch / 2) / s });
    if (ms) mapGlide(m, t, ms); else { stop(); Object.assign(m, t); mapLayout(m); }
  };
  el.addEventListener("wheel", (e) => { if (onUi(e.target)) return; e.preventDefault(); const p = local(e); m.zoomAt(Math.exp(-clampN(e.deltaY, -240, 240) * (e.ctrlKey ? 0.01 : 0.0022)), p.x, p.y, 0); }, { passive: false });
  el.addEventListener("dblclick", (e) => { if (onUi(e.target) || (e.target.closest && e.target.closest("button"))) return; e.preventDefault(); const p = local(e); m.zoomAt(2, p.x, p.y, 260); });

  // A mouse (or pen) drags the map. A finger is left alone here, so one finger still scrolls the page.
  let drag = null, justDragged = false;
  el.addEventListener("pointerdown", (e) => { if (e.pointerType === "touch" || e.button !== 0 || onUi(e.target)) return; drag = { id: e.pointerId, x: e.clientX, y: e.clientY, cx: m.cx, cy: m.cy, moved: false }; });
  el.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.moved) { if (Math.hypot(dx, dy) < 5) return; drag.moved = true; stop(); el.dataset.drag = "1"; try { el.setPointerCapture(e.pointerId); } catch (err) { /* older browsers */ } }
    Object.assign(m, mapClamp(m, { s: m.s, cx: drag.cx - dx / m.s, cy: drag.cy - dy / m.s }));
    mapLayout(m);
  });
  const end = (e) => { if (!drag || e.pointerId !== drag.id) return; if (drag.moved) { justDragged = true; setTimeout(() => { justDragged = false; }, 0); } drag = null; delete el.dataset.drag; };
  el.addEventListener("pointerup", end); el.addEventListener("pointercancel", end);
  // The click that ends a drag must not also select whatever is under the pointer.
  el.addEventListener("click", (e) => { if (justDragged) { e.stopPropagation(); e.preventDefault(); } }, true);

  // Two fingers pinch and move the map.
  let pinch = null;
  const two = (e) => { const r = el.getBoundingClientRect(); const a = e.touches[0], b = e.touches[1]; return { d: Math.max(1, Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)), x: (a.clientX + b.clientX) / 2 - r.left, y: (a.clientY + b.clientY) / 2 - r.top }; };
  el.addEventListener("touchstart", (e) => { if (e.touches.length !== 2) { pinch = null; return; } e.preventDefault(); stop(); const t = two(e); pinch = { d: t.d, s: m.s, wx: m.cx + (t.x - m.cw / 2) / m.s, wy: m.cy + (t.y - m.ch / 2) / m.s }; }, { passive: false });
  el.addEventListener("touchmove", (e) => {
    if (!pinch || e.touches.length !== 2) return;
    e.preventDefault();
    const t = two(e); const s = clampN(pinch.s * (t.d / pinch.d), m.sMin, m.sHome * MAP_ZMAX);
    Object.assign(m, mapClamp(m, { s, cx: pinch.wx - (t.x - m.cw / 2) / s, cy: pinch.wy - (t.y - m.ch / 2) / s }));
    mapLayout(m);
  }, { passive: false });
  el.addEventListener("touchend", (e) => { if (e.touches.length < 2) pinch = null; });
}
window.addEventListener("resize", () => Object.values(MV).forEach((m) => { if (m.el.isConnected) { mapMeasure(m); Object.assign(m, mapClamp(m, m)); mapLayout(m); } }));
// Names are measured to keep them from overlapping; measure again once the page's own font has arrived.
try { const again = () => { _widths.clear(); Object.values(MV).forEach((m) => { if (m.el.isConnected) mapUpdate(m.id, m.el.parentNode, m.o); }); }; document.fonts.ready.then(again); document.fonts.addEventListener("loadingdone", again); } catch (e) { /* no font loading API: estimates are fine */ }

/* ---------- framing ---------- */
function mapFit(m, b, zmax, zmin, room) {
  const padX = m.cw < 520 ? 26 : 40, padT = 54, padB = m.cw < 520 ? 70 : 62;
  const raw = Math.min((m.cw - 2 * padX) / Math.max(1, b[2] - b[0]), (m.ch - padT - padB) / Math.max(1, b[3] - b[1])) * (room || 1);
  const s = m.sHome ? clampN(raw, (zmin || 0) * m.sHome, (zmax || MAP_ZMAX) * m.sHome) : raw;
  return { s, cx: (b[0] + b[2]) / 2, cy: (b[1] + b[3]) / 2 + (padB - padT) / (2 * s) };
}
function mapMeasure(m) {
  m.cw = m.el.clientWidth || 360; m.ch = m.el.clientHeight || 420;
  m.sHome = 0; m.home = mapFit(m, GEO.main); m.sHome = m.home.s;
  m.sMin = Math.min(m.sHome, mapFit(m, GEO.all, 1, 0).s) * 0.94;
  const base = m.el.getBoundingClientRect();
  m.reserved = [m.crumb, m.ctl, m.legend].map((x) => { const r = x.getBoundingClientRect(); return r.width ? [r.left - base.left - 4, r.top - base.top - 4, r.right - base.left + 4, r.bottom - base.top + 4] : null; }).filter(Boolean);
}
/** Keep the zoom within its limits and the middle of the view over the islands: the wider the view, the less it may wander. */
function mapClamp(m, v) {
  const s = clampN(v.s, m.sMin, m.sHome * MAP_ZMAX);
  const lim = (lo, hi, half, c) => { const mid = (lo + hi) / 2, span = (hi - lo) / 2, k = Math.min(1, half / span) * 0.5; return clampN(c, mid - span * (1 - k), mid + span * (1 - k)); };
  return { s, cx: lim(GEO.all[0], GEO.all[2], m.cw / (2 * s), v.cx), cy: lim(GEO.all[1], GEO.all[3], m.ch / (2 * s), v.cy) };
}
/** Where the current selection wants the view to be. */
function mapTarget(m) {
  const o = m.o;
  const school = o.pin ? (o.schools || []).find((s) => s.id === o.pin) : null;
  const dk = o.district || (school && school.district && GEO.dBy.has(school.district) ? school.district : "");
  const ck = o.city || (school ? school.city : "");
  if (dk && GEO.dBy.has(dk)) return mapFit(m, GEO.dBy.get(dk).bbox, MAP_DIST_ZMAX, MAP_DZ * 1.15, 0.62);
  if (ck && GEO.cBy.has(ck)) return mapFit(m, (m.focus && m.focus[ck]) || GEO.cBy.get(ck).fit, MAP_CITY_ZMAX, MAP_DZ * 1.15);
  return m.home;
}
function mapGlide(m, t, ms) {
  cancelAnimationFrame(m.raf);
  if (mapReduced() || !ms) { Object.assign(m, { s: t.s, cx: t.cx, cy: t.cy }); m.target = null; mapLayout(m); return; }
  const a = { s: m.s, cx: m.cx, cy: m.cy }; const t0 = performance.now(); m.target = t;
  const step = (now) => {
    const u = Math.min(1, (now - t0) / ms), e = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
    m.s = a.s * Math.pow(t.s / a.s, e);
    // The place we are heading for slides to the middle at an even pace on screen, whatever the change of zoom.
    const k = ((1 - e) * a.s) / m.s;
    m.cx = t.cx - (t.cx - a.cx) * k; m.cy = t.cy - (t.cy - a.cy) * k;
    mapLayout(m);
    if (u < 1) m.raf = requestAnimationFrame(step); else m.target = null;
  };
  m.raf = requestAnimationFrame(step);
}

/* ---------- bring one map up to date with the page ---------- */
function mapUpdate(id, slot, o) {
  let m = MV[id];
  if (!m || m.lang !== st.lang || m.kind !== o.kind) { const old = m; m = MV[id] = mapCreate(id, o.kind); if (old) { cancelAnimationFrame(old.raf); Object.assign(m, { cx: old.cx, cy: old.cy, s: old.s, has: old.has, sel: old.sel }); } }
  if (m.el.parentNode !== slot) slot.appendChild(m.el);
  m.o = o;
  mapPaint(m);
  mapMeasure(m);
  const sel = [o.city || "", o.district || "", o.pin || ""].join("|");
  if (!m.has) { Object.assign(m, mapTarget(m)); m.has = true; }
  else if (sel !== m.sel || MAP_FORCE) mapGlide(m, mapTarget(m), 650);
  else Object.assign(m, mapClamp(m, m));
  m.sel = sel;
  mapLayout(m);
}

/** Colours, bubbles, pins, names, breadcrumb and legend for what the page wants shown. */
function mapPaint(m) {
  const o = m.o, id = m.id, narrow = (m.el.clientWidth || 400) < 520;
  const cityN = {}, distN = {}, cityJobs = {};
  let pinAt = new Map();
  if (m.kind === "edu") {
    o.list.forEach((e) => { if (!GEO.cBy.has(e.city)) return; cityN[e.city] = (cityN[e.city] || 0) + 1; if (e.district && GEO.dBy.has(e.district) && cityOfDist(e.district) === e.city) distN[e.district] = (distN[e.district] || 0) + 1; });
  } else {
    o.schools.forEach((s) => { if (!GEO.cBy.has(s.city)) return; cityN[s.city] = (cityN[s.city] || 0) + 1; if (o.jobs[s.id]) cityJobs[s.city] = (cityJobs[s.city] || 0) + o.jobs[s.id]; });
    pinAt = pinSpots(o.schools.filter((s) => GEO.cBy.has(s.city)));
  }
  const maxC = Math.max(1, ...Object.values(cityN)), maxD = Math.max(1, ...Object.values(distN));
  // "Show me this city" frames the districts that have something in them (with room around), not empty mountains.
  m.focus = {};
  const grow = (k, g) => { const b = m.focus[k]; m.focus[k] = b ? [Math.min(b[0], g.bbox[0]), Math.min(b[1], g.bbox[1]), Math.max(b[2], g.bbox[2]), Math.max(b[3], g.bbox[3])] : g.bbox.slice(); };
  Object.keys(distN).forEach((k) => grow(cityOfDist(k), GEO.dBy.get(k)));
  pinAt.forEach((p) => { if (GEO.dBy.has(p.area)) grow(cityOfDist(p.area), GEO.dBy.get(p.area)); });
  Object.keys(m.focus).forEach((k) => {
    const b = m.focus[k], f = GEO.cBy.get(k).fit, mx = Math.max((b[2] - b[0]) * 0.22, (f[2] - f[0]) * 0.06), my = Math.max((b[3] - b[1]) * 0.22, (f[3] - f[1]) * 0.06);
    m.focus[k] = [Math.max(f[0], b[0] - mx), Math.max(f[1], b[1] - my), Math.min(f[2], b[2] + mx), Math.min(f[3], b[3] + my)];
  });
  const cityHasD = new Set(Object.keys(distN).map(cityOfDist));
  const selD = m.kind === "edu" && o.district && GEO.dBy.has(o.district) ? o.district : "";
  const selC = o.city && GEO.cBy.has(o.city) ? o.city : "";

  // shapes: shade by how many, mark what can be tapped, dim what is outside the selection
  m.pc.forEach((p, k) => {
    const n = cityN[k] || 0;
    p.style.fill = RAMP[lvl(n, maxC)];
    p.classList.toggle("on", n > 0); p.classList.toggle("dim", !!selC && k !== selC);
    if (n > 0) { p.dataset.act = "mcity"; p.dataset.v = k; } else { delete p.dataset.act; delete p.dataset.v; }
  });
  m.pd.forEach((p, k) => {
    const n = distN[k] || 0;
    p.style.fill = RAMP[lvl(n, maxD)];
    p.classList.toggle("on", n > 0); p.classList.toggle("dim", selD ? k !== selD : !!selC && cityOfDist(k) !== selC);
    if (n > 0) { p.dataset.act = "mdist"; p.dataset.v = k; } else { delete p.dataset.act; delete p.dataset.v; }
  });
  const outline = selD ? GEO.dBy.get(selD).d : selC ? GEO.cBy.get(selC).d : "";
  m.selGlow.setAttribute("d", outline); m.selLine.setAttribute("d", outline);

  // bubbles (real buttons) and names
  const size = (n, max, small) => Math.round((small ? 24 : narrow ? 25 : 27) + (small ? 12 : narrow ? 13 : 17) * Math.sqrt(n / Math.max(1, max)));
  const eduLabel = (name, n) => T(`${name}: ${n} educator${n === 1 ? "" : "s"}`, `${name}：${n} 位教師`);
  const defs = [];
  Object.keys(cityN).forEach((k) => {
    const g = GEO.cBy.get(k), n = cityN[k], name = lab(CITY[k]);
    const aria = m.kind === "edu" ? eduLabel(name, n) : T(`${name}: ${n} school${n === 1 ? "" : "s"}${cityJobs[k] ? `, ${cityJobs[k]} open job post${cityJobs[k] === 1 ? "" : "s"}` : ""}`, `${name}：${n} 所學校${cityJobs[k] ? `，${cityJobs[k]} 個開放職缺` : ""}`);
    defs.push({ key: k, level: "city", n, x: g.ax, y: g.ay, size: size(n, maxC), mode: m.kind === "edu" && !cityHasD.has(k) ? "both" : "country", sel: k === selC && !selD, name, aria, badge: !!cityJobs[k] });
  });
  Object.keys(distN).forEach((k) => {
    const g = GEO.dBy.get(k), n = distN[k];
    defs.push({ key: k, level: "district", n, x: g.ax, y: g.ay, size: size(n, maxD, true), mode: "district", sel: k === selD, name: distName(k), aria: eduLabel(`${distFull(k)}, ${lab(CITY[g.city])}`, n) });
  });
  defs.sort((a, b) => (a.sel ? -1 : b.sel ? 1 : b.n - a.n || (a.key < b.key ? -1 : 1)));
  const withPins = new Set([...pinAt.values()].map((p) => p.area));
  const bubHtml = defs.map((b, i) => `<button type="button" class="zb${m.kind === "jobs" ? " zb-cluster" : ""}" id="zb-${id}-${b.key.replace(":", "-")}" data-i="${i}" data-act="${b.level === "city" ? "mcity" : "mdist"}" data-v="${b.key}" aria-pressed="${b.sel}" aria-label="${h(b.aria)}" style="--size:${b.size}px" hidden><span class="zb-n">${b.n}</span>${b.badge ? '<span class="zb-badge" aria-hidden="true"></span>' : ""}<span class="zb-name">${h(b.name)}</span></button>`).join("");
  const pinList = m.kind === "jobs" ? o.schools.filter((s) => pinAt.has(s.id)) : [];
  const pinHtml = pinList.map((s, i) => { const j = o.jobs[s.id] || 0; return `<button type="button" class="zp${j ? " zp-jobs" : ""}" id="zp-${id}-${s.id}" data-i="${i}" data-act="pin" data-v="${s.id}" aria-pressed="${o.pin === s.id}" aria-label="${h(s.name)}${j ? T(`, ${j} open job post${j === 1 ? "" : "s"}`, `，${j} 個開放職缺`) : ""}" title="${h(s.name)}" hidden><span class="zp-dot" aria-hidden="true"></span>${j ? `<span class="zp-badge" aria-hidden="true">${j}</span>` : ""}<span class="zp-name">${h(s.name)}</span></button>`; }).join("");
  const bubKeys = new Set(defs.filter((b) => b.level === "district").map((b) => b.key));
  // Names are placed in this order: districts with pins, then the chosen city's own, then the roomiest first.
  const rank = (g) => (withPins.has(g.key) ? 2 : 0) + (selC && g.city === selC ? 1 : 0);
  const nameList = GEO.d.filter((g) => !bubKeys.has(g.key)).sort((a, b) => rank(b) - rank(a) || b.r - a.r);
  const nameHtml = nameList.map((g, i) => `<span class="zn" data-i="${i}" hidden>${h(distName(g.key))}</span>`).join("");
  m.ov.innerHTML = nameHtml + pinHtml + bubHtml;
  const els = (sel) => [...m.ov.querySelectorAll(sel)];
  const bEls = els(".zb"), pEls = els(".zp"), nEls = els(".zn");
  m.bubs = defs.map((b, i) => Object.assign(b, { el: bEls[i], w: textW(b.name, FONT_PILL) + 20 }));
  m.pins = pinList.map((s, i) => Object.assign({ id: s.id, el: pEls[i], sel: o.pin === s.id, w: Math.min(220, textW(s.name, FONT_PILL) + 20) }, pinAt.get(s.id)));
  m.names = nameList.map((g, i) => ({ key: g.key, el: nEls[i], x: g.ax, y: g.ay, r: g.r, w: textW(distName(g.key), FONT_QUIET) + 6, pins: withPins.has(g.key), sel: g.key === o.district }));

  // breadcrumb: every part is a button
  const school = o.pin ? (o.schools || []).find((s) => s.id === o.pin) : null;
  const crumbC = selC || (school && GEO.cBy.has(school.city) ? school.city : "");
  const crumbD = selD || (school && school.district && GEO.dBy.has(school.district) ? school.district : "");
  const parts = [`<button type="button" data-act="mall" ${!crumbC ? 'aria-current="location"' : ""}>${T("Taiwan", "全臺灣")}</button>`];
  if (crumbC) parts.push(`<button type="button" data-act="mcity" data-v="${crumbC}" ${!crumbD ? 'aria-current="location"' : ""}>${h(lab(CITY[crumbC]))}</button>`);
  if (crumbD) parts.push(`<button type="button" data-act="${m.kind === "edu" ? "mdist" : "mfit"}" data-v="${crumbD}" aria-current="location">${h(distFull(crumbD))}</button>`);
  m.crumb.innerHTML = parts.join('<span class="zsep" aria-hidden="true">›</span>');
  m.legend.innerHTML = m.kind === "edu"
    ? `<b>${T("Educators per area", "各地區教師人數")}</b><div class="scale"><i style="background:#fffaf6"></i>${RAMP.slice(1).map((f) => `<i style="background:${f}"></i>`).join("")}</div><div class="row small" style="gap:14px;justify-content:space-between"><span>${T("Fewer", "較少")}</span><span>${T("More", "較多")}</span></div>`
    : `<div><span class="dot" style="background:var(--lilac-600)"></span>${T("School", "學校")}</div><div><span class="dot" style="background:var(--apricot-500)"></span>${T("Has open job posts", "有開放職缺")}</div>`;
}

/* ---------- every frame: the view box, and where bubbles, pins and names sit on screen ---------- */
function mapShow(it, x, y, flag) {
  if (it.shown !== true) { it.el.hidden = false; it.shown = true; }
  const tr = `translate(${Math.round(x * 10) / 10}px,${Math.round(y * 10) / 10}px) translate(-50%,-50%)`;
  if (it.tr !== tr) { it.el.style.transform = tr; it.tr = tr; }
  if (flag !== undefined && it.flag !== flag) { it.el.dataset.label = flag; it.flag = flag; }
}
function mapHide(it) { if (it.shown !== false) { it.el.hidden = true; it.shown = false; } }

function mapLayout(m) {
  const { cw, ch, s } = m;
  const district = s / m.sHome >= MAP_DZ;
  const mode = district ? "district" : "country";
  if (m.el.dataset.mode !== mode) m.el.dataset.mode = mode;
  m.svg.setAttribute("viewBox", `${(m.cx - cw / (2 * s)).toFixed(2)} ${(m.cy - ch / (2 * s)).toFixed(2)} ${(cw / s).toFixed(2)} ${(ch / s).toFixed(2)}`);
  const X = (wx) => (wx - m.cx) * s + cw / 2, Y = (wy) => (wy - m.cy) * s + ch / 2;
  const over = (a, b) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
  const boxes = m.reserved.slice();
  const free = (b) => b[0] >= 4 && b[1] >= 4 && b[2] <= cw - 4 && b[3] <= ch - 4 && !boxes.some((o) => over(o, b));

  // 1. school pins: only once districts are showing; pushed apart on screen so no pin covers another
  const live = [];
  m.pins.forEach((p) => { if (!district) return mapHide(p); p.px = X(p.x); p.py = Y(p.y); if (p.px < -20 || p.py < -20 || p.px > cw + 20 || p.py > ch + 20) return mapHide(p); live.push(p); });
  for (let pass = 0; pass < 12; pass++) {
    let moved = false;
    for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
      const a = live[i], b = live[j]; let dx = b.px - a.px, dy = b.py - a.py; let d = Math.hypot(dx, dy);
      if (d >= 27) continue;
      if (d < 0.01) { dx = Math.cos(i * 2.4 + j); dy = Math.sin(i * 2.4 + j); d = 1; }
      const push = (27 - d) / 2 + 0.2; a.px -= (dx / d) * push; a.py -= (dy / d) * push; b.px += (dx / d) * push; b.py += (dy / d) * push; moved = true;
    }
    if (!moved) break;
  }
  live.forEach((p) => { mapShow(p, p.px, p.py, p.sel ? "1" : "0"); boxes.push([p.px - 13, p.py - 13, p.px + 13, p.py + 13]); });
  live.filter((p) => p.sel).forEach((p) => boxes.push([p.px - p.w / 2, p.py + 15, p.px + p.w / 2, p.py + 37]));

  // 2. bubbles: nudged apart on screen so every city shows at the opening view; if two still collide (districts seen
  //    from far away), the smaller waits until you zoom in
  const cands = [];
  m.bubs.forEach((b) => {
    if (b.mode !== "both" && b.mode !== mode) return mapHide(b);
    const x = X(b.x), y = Y(b.y);
    if (x < 0 || y < 0 || x > cw || y > ch) return mapHide(b);
    cands.push({ b, x, y, x0: x, y0: y, r: b.size / 2 });
  });
  const reach = district ? 16 : 30;
  for (let pass = 0; pass < 16; pass++) {
    let moved = false;
    for (let i = 0; i < cands.length; i++) for (let j = i + 1; j < cands.length; j++) {
      const a = cands[i], c = cands[j]; let dx = c.x - a.x, dy = c.y - a.y; let d = Math.hypot(dx, dy); const need = a.r + c.r + 3;
      if (d >= need) continue;
      if (d < 0.01) { dx = Math.cos(i + j * 1.7); dy = Math.sin(i + j * 1.7); d = 1; }
      const push = (need - d) / 2 + 0.1; a.x -= (dx / d) * push; a.y -= (dy / d) * push; c.x += (dx / d) * push; c.y += (dy / d) * push; moved = true;
    }
    cands.forEach((c) => { const dx = c.x - c.x0, dy = c.y - c.y0, d = Math.hypot(dx, dy); if (d > reach) { c.x = c.x0 + (dx / d) * reach; c.y = c.y0 + (dy / d) * reach; } });
    if (!moved) break;
  }
  const placed = [];
  cands.forEach((c) => {
    if (!c.b.sel && placed.some((o) => Math.hypot(o.x - c.x, o.y - c.y) < o.r + c.r)) return mapHide(c.b);
    // Zoomed in, a bubble half under the breadcrumb, the controls or the key could not be pressed: it waits until the map moves.
    if (district && !c.b.sel && m.reserved.some((o) => over(o, [c.x - c.r, c.y - c.r, c.x + c.r, c.y + c.r]))) return mapHide(c.b);
    placed.push(c); boxes.push([c.x - c.r - 1, c.y - c.r - 1, c.x + c.r + 1, c.y + c.r + 1]);
  });
  // a name beside every bubble that has room for one: below it if possible, else above, right or left
  //    (the selected one always gets its name)
  placed.forEach(({ b, x, y, r }) => {
    const spots = [["1", [x - b.w / 2, y + r + 5, x + b.w / 2, y + r + 26]], ["t", [x - b.w / 2, y - r - 26, x + b.w / 2, y - r - 5]], ["r", [x + r + 6, y - 10.5, x + r + 6 + b.w, y + 10.5]], ["l", [x - r - 6 - b.w, y - 10.5, x - r - 6, y + 10.5]]];
    const hit = spots.find((sp) => free(sp[1])) || (b.sel ? spots[0] : null);
    if (hit) boxes.push(hit[1]);
    mapShow(b, x, y, hit ? hit[0] : "0");
  });

  // 3. quiet district names: only where the district is big enough on screen to carry its name, and nothing is in the way
  m.names.forEach((n) => {
    if (!district) return mapHide(n);
    const x = X(n.x), y = Y(n.y);
    if (x < -40 || y < -20 || x > cw + 40 || y > ch + 20) return mapHide(n);
    const room = 2 * n.r * s;
    if (!n.pins && !n.sel && (room < n.w * 0.62 || room < 15)) return mapHide(n);
    const tries = n.pins ? [26, -26, 44, -44] : [0];
    for (const dy of tries) {
      const box = [x - n.w / 2, y + dy - 9, x + n.w / 2, y + dy + 9];
      if (free(box)) { boxes.push(box); return mapShow(n, x, y + dy); }
    }
    mapHide(n);
  });
}

/* ---------- what the views call ---------- */
/** The members' educator map: counts per city, then per district. `list` is already filtered to what this member may see. */
function educatorMap(list, city, district, note) {
  return `${mapSlot("map-edu", { kind: "edu", list, city: city || "", district: district || "" })}<p class="mapnote">${note}</p>`;
}
/** The educators' school map: a bubble per city, then a pin per school inside its district; an apricot badge means open job posts. */
function jobMap(schools, jobCount, selectedSchool, selectedCity) {
  return `${mapSlot("map-jobs", { kind: "jobs", schools, jobs: jobCount, pin: selectedSchool || "", city: selectedCity || "", district: "" })}
    <p class="mapnote">${T("In this demo a school's pin sits inside its district, not at its street address. An apricot badge means open job posts.", "此示範將學校標示在所屬的行政區內，而不是實際地址。橘色標記代表有開放職缺。")}</p>`;
}
