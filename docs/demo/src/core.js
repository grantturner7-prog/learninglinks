/* ---------- tiny helpers ---------- */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const h = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const nt = (n) => "NT$" + Number(n).toLocaleString("en-US");
const isoDay = (d) => d.toISOString().slice(0, 10);
const TODAY = isoDay(new Date());
const addMonths = (s, n) => { const d = new Date(s + "T00:00:00Z"); d.setUTCMonth(d.getUTCMonth() + n); return isoDay(d); };

/* ---------- state (kept in this browser only, if the browser allows it) ---------- */
const KEY = "learninglinks-demo-v1";
const fresh = () => ({
  lang: "en", role: "visitor", view: "home", args: {}, form: {}, people: {}, orders: [], memberships: [], owners: {},
  jobs: JSON.parse(JSON.stringify(SEED_JOBS)), reveals: [], reports: [], suspended: {}, removedJobs: {}, myProfile: null,
  payReview: [{ id: "r1", ref: "LL-7K3Q-9FXD", note: "ECPay reported NT$1,000 for an order of NT$2,000. The site did not start a membership.", done: false }],
  seq: 1, toast: "", custom: [],
});
let st = fresh();
try { const raw = localStorage.getItem(KEY); if (raw) st = Object.assign(fresh(), JSON.parse(raw)); } catch (e) { /* storage may be blocked: the demo still works, it just forgets on reload */ }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* ignore */ } };
const L = () => (st.lang === "zh" ? 1 : 0);
const T = (en, zh) => (st.lang === "zh" ? zh : en);
const lab = (pair) => pair[L()];
const uid = (p) => p + st.seq++;

/* ---------- the compliance notice: the canonical wording from the notice.json message files ---------- */
const noticeFull = () => NOTICE[st.lang];

/* ---------- who is looking ---------- */
const me = () => st.people[st.role] || null;
const pid = () => (me() ? me().id : null);
const familyActive = (p) => st.memberships.some((m) => m.holder === p && m.kind === "family" && m.end > TODAY);
/** Any school in the demo: the pretend ones, the Ministry's lists, or one the visitor added. */
const schoolById = (id) => SCHOOLS.find((s) => s.id === id) || REAL_BY_ID.get(id) || st.custom.find((s) => s.id === id) || null;
const ownedCampuses = (p) => Object.keys(st.owners).filter((id) => st.owners[id] === p).map(schoolById).filter(Boolean);
const campusActive = (p, sid) => st.memberships.some((m) => m.holder === p && m.kind === "campus" && m.schoolId === sid && m.end > TODAY);
const paidCampusIds = (p) => ownedCampuses(p).filter((s) => campusActive(p, s.id)).map((s) => s.id);
const hasMembership = () => { const m = me(); if (!m) return false; return m.type === "family" ? familyActive(m.id) : m.type === "school" ? paidCampusIds(m.id).length > 0 : false; };
const myOrders = () => st.orders.filter((o) => o.by === pid());

/* ---------- educators: the fictional ones plus the visitor's own published profile ---------- */
function allEducators() {
  const list = EDU.slice();
  const p = st.myProfile;
  if (p && p.published) list.push(Object.assign({ id: "e-me", mine: true }, p));
  return list.filter((e) => !st.suspended[e.id]);
}
/** The rule that decides who may see whom (the real site: src/lib/visibility.ts). */
function visibleTo(type) {
  const all = allEducators();
  if (type === "family") return all.filter((e) => e.openTo.includes("private_tutoring"));
  if (type === "school") return all.filter((e) => e.openTo.includes("full_time") || e.openTo.includes("part_time"));
  return [];
}
const eduById = (id) => allEducators().find((e) => e.id === id) || null;
const placeName = (e) => (e.district && DIST[e.district] ? lab(DIST[e.district]) + ", " : "") + lab(CITY[e.city]);
const openJobs = () => st.jobs.filter((j) => j.status === "open" && !st.removedJobs[j.id] && schoolHasMembership(j.schoolId));
const schoolHasMembership = (sid) => { const o = st.owners[sid]; return o ? campusActive(o, sid) : SEED_JOBS.some((j) => j.schoolId === sid); };

/* ---------- money ---------- */
function newOrder(type, campusIds, method, invoice) {
  const amount = type === "family" ? PRICE_FAMILY : PRICE_CAMPUS * campusIds.length;
  const code = () => Math.random().toString(36).replace(/[^a-z0-9]/g, "").toUpperCase().padEnd(4, "X").slice(0, 4);
  const o = { id: uid("o"), ref: `LL-${code()}-${code()}`, type, campusIds, amount, method, invoice, status: "pending", by: pid(), created: TODAY, info: null, tries: 0 };
  st.orders.push(o);
  return o;
}
/** Payment confirmed (by ECPay's signed notice, or by an admin for a bank transfer): the 12 months start now. */
function settle(o, actor) {
  if (o.status === "paid") return;
  o.status = "paid"; o.paidOn = TODAY; o.actor = actor;
  if (o.type === "family") st.memberships.push({ id: uid("m"), holder: o.by, kind: "family", start: TODAY, end: addMonths(TODAY, 12), orderId: o.id });
  else o.campusIds.forEach((sid) => st.memberships.push({ id: uid("m"), holder: o.by, kind: "campus", schoolId: sid, start: TODAY, end: addMonths(TODAY, 12), orderId: o.id }));
}

/* ---------- navigation and rendering ---------- */
function go(view, args = {}, keepScroll = false) {
  st.view = view; st.args = args; st.form = {};
  save(); render(!keepScroll);
}
function toast(msg) { st.toast = msg; render(false); setTimeout(() => { if (st.toast === msg) { st.toast = ""; const t = $(".toast"); if (t) t.remove(); } }, 3200); }
const val = (k, d = "") => (st.form[k] === undefined ? d : st.form[k]);
const sel = (k, v) => (st.form[k] === v ? 'aria-pressed="true"' : 'aria-pressed="false"');
const has = (k, v) => (st.form[k] || []).includes(v);
const selm = (k, v) => `aria-pressed="${has(k, v)}"`;

/* ---------- map ---------- */
const FILLS = ["#fffaf6", "#ebe3f8", "#dccff3", "#b7a0e3", "#9a80d1"];
const fillFor = (n) => FILLS[n <= 0 ? 0 : n <= 2 ? 1 : n <= 4 ? 2 : n <= 7 ? 3 : 4];
/** Schools of one city sit on a small ring around the city's middle, so pins never cover each other. */
function mapPins(s) {
  const c = MAP.c[s.city]; const mates = (mapPins.set || SCHOOLS).filter((x) => x.city === s.city); const n = mates.length; const i = mates.indexOf(s);
  if (n === 1) return { x: c.x, y: c.y };
  const ang = (2 * Math.PI * i) / n + 0.6, r = Math.min(12, 5 + n * 1.6);
  return { x: Math.round((c.x + Math.cos(ang) * r) * 10) / 10, y: Math.round((c.y + Math.sin(ang) * r) * 10) / 10 };
}

/** Taiwan with a count bubble per city; click a city to filter the list beside it. */
function educatorMap(counts, selected, note) {
  const paths = Object.entries(MAP.c).map(([k, c]) => `<path class="city${selected === k ? " sel" : ""}" d="${c.d}" fill="${fillFor(counts[k] || 0)}" data-act="city" data-v="${k}" role="button" tabindex="0" aria-label="${h(lab(CITY[k]))}: ${counts[k] || 0}"><title>${h(lab(CITY[k]))}</title></path>`).join("");
  const NUDGE = { taipei: [-3, -4], "new-taipei": [7, 5], keelung: [6, -3], taoyuan: [-6, 0], "hsinchu-city": [-3, 2] };
  const bubbles = Object.keys(counts).filter((k) => counts[k] > 0 && MAP.c[k]).map((k) => { const n = NUDGE[k] || [0, 0]; const c = { x: MAP.c[k].x + n[0], y: MAP.c[k].y + n[1] }; const r = 5.5 + Math.min(4, Math.log2(counts[k] + 1)); return `<g class="bub" data-act="city" data-v="${k}"><circle cx="${c.x}" cy="${c.y}" r="${r}"/><text x="${c.x}" y="${c.y}">${counts[k]}</text></g>`; }).join("");
  const labels = Object.keys(counts).filter((k) => counts[k] > 0 && MAP.c[k] && ["taichung", "tainan", "kaohsiung", "hsinchu-city"].includes(k)).map((k) => { const c = MAP.c[k]; return `<text class="lbl" x="${c.x}" y="${c.y + 15}">${h(lab(CITY[k]).replace(" City", ""))}</text>`; }).join("");
  return `<div class="map"><svg viewBox="0 0 ${MAP.W} ${MAP.H}" role="group" aria-label="${T("Map of Taiwan", "臺灣地圖")}">${paths}${labels}${bubbles}</svg>
    <div class="legend"><b>${T("Educators per area", "各地區教師人數")}</b><div class="scale">${FILLS.map((f) => `<i style="background:${f}"></i>`).join("")}</div><div class="row small" style="gap:14px;justify-content:space-between"><span>${T("Fewer", "較少")}</span><span>${T("More", "較多")}</span></div></div></div>
    <p class="mapnote">${note}</p>`;
}

/** Taiwan with a pin per school; schools with open job posts carry an apricot dot. */
function jobMap(schools, jobCount, selectedSchool, selectedCity) {
  mapPins.set = schools;
  const counts = {}; schools.forEach((s) => { counts[s.city] = (counts[s.city] || 0) + 1; });
  const paths = Object.entries(MAP.c).map(([k, c]) => `<path class="city${selectedCity === k ? " sel" : ""}" d="${c.d}" fill="${fillFor(counts[k] || 0)}" data-act="city" data-v="${k}"><title>${h(lab(CITY[k]))}</title></path>`).join("");
  const pins = schools.map((s) => { const p = mapPins(s); const j = jobCount[s.id] || 0; return `<g class="pin" data-act="pin" data-v="${s.id}" role="button" tabindex="0" aria-label="${h(s.name)}"><circle class="s" cx="${p.x}" cy="${p.y}" r="${selectedSchool === s.id ? 6 : 4.4}"/>${j ? `<circle class="j" cx="${p.x + 3.8}" cy="${p.y - 3.8}" r="2.7"/>` : ""}<title>${h(s.name)}</title></g>`; }).join("");
  return `<div class="map"><svg viewBox="0 0 ${MAP.W} ${MAP.H}" role="group" aria-label="${T("Map of schools", "學校地圖")}">${paths}${pins}</svg>
    <div class="legend"><div><span class="dot" style="background:var(--lilac-600)"></span>${T("School", "學校")}</div><div><span class="dot" style="background:var(--apricot-500)"></span>${T("Has open job posts", "有開放職缺")}</div></div></div>
    <p class="mapnote">${T("Schools are shown by area in this demo. Pins with an apricot dot have open job posts.", "此示範以地區顯示學校。有橘色圓點的標記代表有開放職缺。")}</p>`;
}

/* ---------- guided flow frame: one question at a time, Link asks, a receipt or preview beside it ---------- */
const LINK = `<svg width="56" height="56" viewBox="0 0 64 64" aria-hidden="true"><circle cx="26" cy="32" r="17" fill="#fde3cc" stroke="#f08f45" stroke-width="4.2"/><circle cx="38" cy="32" r="17" fill="#ebe3f8" fill-opacity=".85" stroke="#2b1730" stroke-width="4.2"/><path d="M28.95 15.26A17 17 0 0 1 35 17.58" fill="none" stroke="#f08f45" stroke-width="4.2"/><circle cx="28.6" cy="29.2" r="1.9" fill="#2b1730"/><circle cx="35.4" cy="29.2" r="1.9" fill="#2b1730"/><path d="M27.4 35.2Q32 40.2 36.6 35.2" fill="none" stroke="#2b1730" stroke-width="2.2" stroke-linecap="round"/></svg>`;
const MARK = `<svg width="44" height="30" viewBox="0 0 44 30" role="img" aria-label="LearningLinks"><circle cx="15" cy="15" r="11" fill="none" stroke="#f08f45" stroke-width="4"/><circle cx="29" cy="15" r="11" fill="none" stroke="#2b1730" stroke-width="4"/><path d="M17.6 4.5A11 11 0 0 1 22.4 6.2" fill="none" stroke="#f08f45" stroke-width="4"/></svg>`;

function dots(step, total) {
  let out = "";
  for (let i = 1; i <= total; i++) { out += `<i class="${i < step ? "done" : i === step ? "here" : ""}"></i>`; if (i < total) out += `<s class="${i < step ? "done" : ""}"></s>`; }
  return `<div class="dots" aria-label="${T("Step", "步驟")} ${step} / ${total}">${out}</div>`;
}
function frame({ step, total, say, q, body, aside, back, next, nextLabel, nextDisabled, exit }) {
  return `<div class="flow ${aside ? "has-aside" : ""}"><div class="card soft">
    ${exit ? `<div class="small"><button class="link-btn" data-act="${exit.act}" data-v="${exit.v || ""}">${exit.label}</button></div>` : ""}
    <div class="eyebrow" style="margin-top:6px">${T("Step", "步驟")} ${step} ${T("of", "／")} ${total}</div>${dots(step, total)}
    <div class="say">${LINK}<div class="bubble">${say}</div></div>
    <h2 class="q">${q}</h2>${body}
    <div class="nav-row">${back ? `<button class="btn" data-act="${back}">← ${T("Back", "上一步")}</button>` : ""}${next ? `<button class="btn btn-primary btn-lg" data-act="${next}" ${nextDisabled ? "disabled" : ""}>${nextLabel}</button>` : ""}</div>
  </div>${aside ? `<aside class="card receipt">${aside}</aside>` : ""}</div>`;
}
const ackBox = (name) => `<label class="ack"><input type="checkbox" data-f="${name}" id="f-${name}" ${val(name) ? "checked" : ""}><span>${h(noticeFull().acknowledge)}</span></label>`;
const noticeBox = () => `<div class="notice" role="note"><b>${h(noticeFull().lead)}</b> ${h(noticeFull().full)}</div>`;
const money = (n) => `<span class="num">${nt(n)}</span>`;
const fmtDate = (s) => new Date(s + "T00:00:00Z").toLocaleDateString(st.lang === "zh" ? "zh-TW" : "en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
