/* ================= shell ================= */
/* The menu follows the person, as on the real site: a visitor sees what the site is, a family its tutors and membership,
   a school its educators, job posts and campuses, an educator the jobs map and their profile. The name at the right
   opens that person's own page. Nobody can jump between kinds of account: you sign out and sign in as someone else. */
const KIND_LABEL = { family: () => T("Family", "家庭"), school: () => T("School", "學校"), educator: () => T("Educator", "教師"), admin: () => T("Site owner", "網站管理員") };
function navItems() {
  const m = me();
  if (!m) return [["home", T("Home", "首頁")], ["educators", T("Find educators", "尋找教師")]];
  if (m.type === "family") return [["educators", T("Find tutors", "找家教")], ["dashboard", T("My membership", "我的會員")]];
  if (m.type === "school") return [["educators", T("Find educators", "尋找教師")], ["myjobs", T("My job posts", "我的職缺")], ["campuses", T("My campuses", "我的校區")], ["dashboard", T("Membership", "會員")]];
  if (m.type === "educator") return [["jobs", T("Jobs map", "職缺地圖")], ["profile", T("My profile", "我的檔案")], ["dashboard", T("Who asked", "誰索取過")]];
  return [["admin", T("Admin desk", "管理後台")]];
}
const GROUP = { claim: "campuses", addschool: "campuses", join: "dashboard", order: "dashboard", ecpay: "dashboard", educator: "educators", jobnew: "myjobs", report: "dashboard", signup: "home" };
function shell(inner) {
  const cur = GROUP[st.view] || st.view;
  const m = me();
  const account = m
    ? `<button class="acct" data-act="nav" data-v="${m.type === "admin" ? "admin" : "dashboard"}" data-testid="account"><span class="ini" aria-hidden="true">${h(([...(m.name || "?")][0] || "?").toUpperCase())}</span><span>${h(m.name)}</span><span class="kind">${KIND_LABEL[m.type]()}</span></button><button class="tlink" data-act="signout">${T("Sign out", "登出")}</button>`
    : `<button class="tlink" data-act="signinPage">${T("Sign in", "登入")}</button><button class="btn btn-primary" data-act="start" data-v="">${T("Sign up", "註冊")}</button>`;
  return `<div class="demo"><div class="wrap"><b>${T("DEMO", "示範")}</b><span>${T("Pretend people and data. Nothing is saved on a server and no money moves.", "虛構的人物與資料。沒有任何資料存到伺服器，也沒有任何款項移動。")}</span><button class="link" data-act="reset">${T("Start over", "重新開始")}</button></div></div>
    <div class="topbar"><div class="wrap"><header class="top"><button class="brand" data-act="nav" data-v="${m ? (m.type === "admin" ? "admin" : "dashboard") : "home"}">${MARK}<span>LearningLinks</span></button><nav class="nav" aria-label="${m ? T("Your pages", "您的頁面") : T("Main", "主要")}">${navItems().map(([v, l]) => `<button data-act="nav" data-v="${v}" ${cur === v ? 'aria-current="page"' : ""}>${l}</button>`).join("")}</nav>
      <div class="lang" role="group" aria-label="Language"><button data-act="lang" data-v="zh" aria-pressed="${st.lang === "zh"}">繁中</button><button data-act="lang" data-v="en" aria-pressed="${st.lang === "en"}">EN</button></div>${account}</header></div></div>
    <div class="wrap">
    <main id="main">${inner}</main>
    <footer class="fine"><div class="notice" role="note"><b>${h(noticeFull().lead)}</b> ${h(noticeFull().full)}</div><div class="links"><span>${T("In the real site: Terms, Privacy policy and Educator waiver (drafts, to be reviewed by your lawyer), Safety guide.", "真實網站中：服務條款、隱私權政策、教師刊登同意書（草稿，待律師審閱）、安全指南。")}</span></div></footer></div>${st.toast ? `<div class="toast" role="status">${h(st.toast)}</div>` : ""}`;
}

function render(scrollTop) {
  const a = document.activeElement;
  const aid = a && a.id, ss = a && a.selectionStart, se = a && a.selectionEnd;
  const y = window.scrollY;
  const fn = V[st.view] || V.home;
  MAP_PENDING = {};
  let inner;
  try { inner = fn(); } catch (err) { console.error(err); inner = `<div class="card">Something went wrong in this demo screen. <button class="btn" data-act="reset">Start over</button></div>`; }
  document.getElementById("app").innerHTML = shell(inner);
  mapsMount();
  document.title = "LearningLinks demo";
  document.documentElement.lang = st.lang === "zh" ? "zh-Hant-TW" : "en";
  if (aid) { const el = document.getElementById(aid); if (el) { el.focus({ preventScroll: true }); try { if (ss != null) el.setSelectionRange(ss, se); } catch (e) { /* not a text field */ } } }
  window.scrollTo(0, scrollTop ? 0 : y);
}

/* ================= people and presets ================= */
const DEFAULT_NAME = { family: "Demo Family", school: "Demo School", educator: "Demo Educator", admin: "Demo Admin" };
function clearPerson(type) {
  const id = "p-" + type;
  st.orders = st.orders.filter((o) => o.by !== id);
  st.memberships = st.memberships.filter((x) => x.holder !== id);
  Object.keys(st.owners).forEach((k) => { if (st.owners[k] === id) delete st.owners[k]; });
  st.reveals = st.reveals.filter((r) => r.by !== id);
  st.jobs = st.jobs.filter((j) => !j.mine || st.owners[j.schoolId]);
  if (type === "educator") st.myProfile = null;
}
function makePerson(type, name) { clearPerson(type); st.people[type] = { id: "p-" + type, type, name: name || DEFAULT_NAME[type] }; st.role = type; }
function payNow(o) { settle(o, "demo"); }
function preset(name) {
  if (name === "family_paid") { makePerson("family", "Mei"); const o = newOrder("family", [], "ecpay", null); payNow(o); go("educators"); }
  else if (name === "school_paid") { makePerson("school", "Sunny"); st.owners.s1 = "p-school"; st.owners.s2 = "p-school"; const o = newOrder("school", ["s1"], "ecpay", null); payNow(o); go("dashboard"); }
  else if (name === "educator") {
    makePerson("educator", "Lin");
    st.myProfile = { published: true, openTo: ["full_time", "private_tutoring"], city: "taichung", district: "taichung:xitun", subjects: ["english-conversation", "phonics"], levels: ["kindergarten", "elementary"], name: "Lin", head: "Friendly English teacher for young learners", bio: "I love songs, stories and games in class. Six years of teaching in Taichung.", rateMin: 700, rateMax: 1100, wish: "Kindergarten or cram school, afternoons", email: "lin@example.invalid", line: "lin-line", langs: ["en"], exp: "5-9" };
    go("dashboard");
  } else if (name === "admin") { makePerson("admin"); go("admin"); }
}

/* ================= actions ================= */
const A = {
  nav: (el) => { const v = el.dataset.v; if (v === "profile") return openProfile(); if (v === "dashboard" && !me()) return go("home"); go(v); },
  lang: (el) => { st.lang = el.dataset.v; save(); render(false); },
  reset: () => { st = fresh(); save(); render(true); },
  signinPage: () => go("signin"),
  /* Sign in as the account of that kind used earlier in this demo, or as a new one with nothing set up yet. */
  signin: (el) => { const v = el.dataset.v; if (!st.people[v]) { st.people[v] = { id: "p-" + v, type: v, name: DEFAULT_NAME[v] }; } st.role = v; go(v === "admin" ? "admin" : "dashboard"); },
  signout: () => { st.role = "visitor"; go("home"); },
  start: (el) => { const v = el.dataset.v; go("signup"); st.form.role = v || ""; render(true); },
  preset: (el) => preset(el.dataset.v),
  pick: (el) => { st.form[el.dataset.k] = el.dataset.v; render(false); },
  toggle: (el) => { const k = el.dataset.k, v = el.dataset.v; const a = st.form[k] || []; st.form[k] = a.includes(v) ? a.filter((x) => x !== v) : a.concat(v); render(false); },
  togglePick: (el) => { const a = st.form.picked || []; const v = el.dataset.v; st.form.picked = a.includes(v) ? a.filter((x) => x !== v) : a.concat(v); render(false); },
  city: (el) => { st.form.city = st.form.city === el.dataset.v ? "" : el.dataset.v; st.form.pin = ""; render(false); },
  pin: (el) => { st.form.pin = st.form.pin === el.dataset.v ? "" : el.dataset.v; render(false); },
  clearJobs: () => { st.form.city = ""; st.form.pin = ""; render(false); },
  /* the map: tap a city, tap a district, back out to all of Taiwan */
  mcity: (el, e) => { st.form.city = el.dataset.v; st.form.district = ""; st.form.pin = ""; MAP_FORCE = true; render(false); mapKeyFocus(el, e); },
  mdist: (el, e) => { st.form.city = cityOfDist(el.dataset.v); st.form.district = el.dataset.v; st.form.pin = ""; MAP_FORCE = true; render(false); mapKeyFocus(el, e); },
  mall: (el, e) => { st.form.city = ""; st.form.district = ""; st.form.pin = ""; MAP_FORCE = true; render(false); mapKeyFocus(el, e); },
  mfit: (el, e) => { MAP_FORCE = true; render(false); mapKeyFocus(el, e); },
  mzoom: (el) => { const slot = el.closest(".zslot"); const m = slot && MV[slot.id]; if (m) m.zoomAt(el.dataset.v === "in" ? 2 : 0.5, m.cw / 2, m.ch / 2, 240); },
  back: () => go(st.prev ? st.prev.view : "dashboard", st.prev ? st.prev.args : {}),

  signup1: () => { st.form.step = 2; render(true); },
  signupBack: () => { st.form.step = (st.form.step || 2) - 1; render(true); },
  signup2: () => { st.form.step = 3; render(true); },
  signup3: () => { const role = st.form.role, name = (st.form.name || "").trim(); makePerson(role, name); toast(T("Account created. Welcome!", "帳號已建立，歡迎！")); go("dashboard"); },

  join: (el) => go("join", { type: el.dataset.v }),
  joinNext: () => { st.form.step = (st.form.step || 1) + 1; render(true); },
  joinBack: () => { st.form.step = (st.form.step || 2) - 1; render(true); },
  placeOrder: () => {
    const type = st.args.type, f = st.form;
    const campusIds = type === "school" ? (f.picked || []) : [];
    const invoice = f.inv === "company" ? { tax: f.tax, title: f.title } : null;
    const o = newOrder(type, campusIds, f.method || "ecpay", invoice);
    go("order", { id: o.id });
  },
  order: (el) => go("order", { id: el.dataset.v }),
  cancelOrder: (el) => { const o = st.orders.find((x) => x.id === el.dataset.v); if (o && o.status === "pending") o.status = "cancelled"; toast(T("Order cancelled.", "訂單已取消。")); go("dashboard"); },
  toEcpay: (el) => go("ecpay", { id: el.dataset.v, m: el.dataset.m }),
  ecpayPay: (el) => { const o = st.orders.find((x) => x.id === el.dataset.v); settle(o, "system:ecpay"); toast(T("Payment received. In the real site ECPay tells our server, and your membership starts by itself.", "已收到付款。在真實網站中，綠界會通知我們的伺服器，您的會員資格會自動開始。")); go("order", { id: o.id }); },
  ecpayNumber: (el) => { const o = st.orders.find((x) => x.id === el.dataset.v); const k = el.dataset.m; const exp = addMonths(TODAY, 0).replace(/-\d\d$/, "-" + String(Math.min(28, Number(TODAY.slice(8)) + 3)).padStart(2, "0")); o.info = k === "ATM" ? { kind: "ATM", bank: "812", account: "9103" + String(Math.floor(Math.random() * 1e12)).padStart(12, "0"), expire: exp } : { kind: "CVS", code: "LLL" + String(Math.floor(Math.random() * 1e11)).padStart(11, "0"), expire: exp }; go("order", { id: o.id }); },
  simulateNotice: (el) => { const o = st.orders.find((x) => x.id === el.dataset.v); settle(o, "system:ecpay"); toast(T("Pretend notice received: membership started.", "已收到模擬通知：會員資格已開始。")); go("order", { id: o.id }); },
  adminAsk: () => { st.people.admin = st.people.admin || { id: "p-admin", type: "admin", name: DEFAULT_NAME.admin }; st.role = "admin"; go("admin"); },

  addNext: () => { st.form.step = (st.form.step || 1) + 1; render(true); },
  addBack: () => { st.form.step = (st.form.step || 2) - 1; render(true); },
  addSchool: () => {
    const f = st.form; const s = { id: uid("c"), name: f.name.trim(), kind: f.kind, ownership: null, city: f.city, district: f.district || null, custom: true };
    st.custom.push(s); st.owners[s.id] = pid(); if (f.bil) st.bil[s.id] = true; save(); toast(T("School added and claimed. (The real site asks an administrator to approve it first.)", "已新增並認領學校。（真實網站會先由管理員審核。）")); go("campuses");
  },
  claimStart: (el) => { go("claim", { id: el.dataset.v }); },
  claimBack: () => go("campuses"),
  claimSend: () => { const id = st.args.id; st.owners[id] = pid(); if (st.form.bil) st.bil[id] = true; save(); toast(T("Campus claimed. (The real site asks an administrator to approve this.)", "已認領校區。（真實網站會由管理員審核。）")); go("campuses"); },
  toggleBil: (el) => { const id = el.dataset.v; if (st.bil[id]) delete st.bil[id]; else st.bil[id] = true; save(); render(false); },
  jobPublish: () => {
    const f = st.form; const paid = ownedCampuses(pid()).filter((s) => campusActive(pid(), s.id));
    st.jobs.push({ id: uid("j"), mine: true, schoolId: f.campus || paid[0].id, title: f.title.trim(), type: f.jtype || "full_time", subject: f.subject || "english-conversation", desc: f.desc.trim(), contact: f.contact.trim(), status: "open" });
    toast(T("Job post published. Signed-in educators with a profile can see it.", "職缺已發布。已登入且有檔案的教師可以看到。")); go("myjobs");
  },
  closeJob: (el) => { const j = st.jobs.find((x) => x.id === el.dataset.v); if (j) j.status = "closed"; render(false); },

  viewEdu: (el) => { st.prev = { view: st.view, args: st.args }; go("educator", { id: el.dataset.v }); },
  reveal: (el) => {
    const m = me(); const id = el.dataset.v;
    if (st.reveals.some((r) => r.eduId === id && r.by === m.id)) return render(false);
    if (st.reveals.filter((r) => r.by === m.id && r.day === TODAY).length >= REVEAL_CAP) return toast(T("You have reached today's limit.", "您已達今日上限。"));
    st.reveals.push({ eduId: id, by: m.id, byType: m.type, byName: m.name, day: TODAY }); save(); render(false);
  },
  reportOpen: (el) => { st.prev = { view: st.view, args: st.args }; go("report", { t: el.dataset.t, id: el.dataset.v }); },
  reportSubmit: () => { st.reports.push({ id: uid("r"), type: st.args.t, targetId: st.args.id, reason: st.form.reason || "misleading", details: st.form.details || "", by: me() ? me().type : "visitor", status: "open" }); toast(T("Report sent to an administrator. Thank you.", "檢舉已送交管理員，謝謝您。")); go(st.prev ? st.prev.view : "dashboard", st.prev ? st.prev.args : {}); },

  hideProfile: () => { st.myProfile.published = false; toast(T("Profile hidden.", "檔案已隱藏。")); go("dashboard"); },
  profNext: () => { st.form.step = (st.form.step || 1) + 1; render(true); },
  profBack: () => { st.form.step = (st.form.step || 2) - 1; render(true); },
  profPublish: () => {
    const f = st.form;
    st.myProfile = { published: true, openTo: f.open, city: f.city, district: f.district || null, subjects: f.subjects, levels: f.levels, name: f.name.trim(), head: f.head.trim(), bio: f.bio.trim(), rateMin: Number(f.rateMin) || null, rateMax: Number(f.rateMax) || null, wish: f.wish, email: f.email.trim(), line: f.line, langs: ["en"], exp: "2-4" };
    toast(T("Your profile is published.", "您的檔案已發布。")); go("dashboard");
  },

  adminConfirm: (el) => {
    const o = st.orders.find((x) => x.id === el.dataset.v); const amt = Number(String(st.form["amt-" + o.id] ?? o.amount).replace(/[,\s]/g, ""));
    if (amt !== o.amount) { st.form.adminMsg = "The amount does not match the order total. Check the bank statement; a short payment is not confirmed."; st.form.adminOk = false; return render(false); }
    settle(o, "admin"); st.form.adminMsg = `Confirmed ${o.ref}. The membership has started and the buyer has been emailed.`; st.form.adminOk = true; save(); render(false);
  },
  openRefund: (el) => { st.form = { openRefund: el.dataset.v }; render(false); },
  closeRefund: () => { st.form = {}; render(false); },
  /** Pretend version of the real refund button: same rules as the server (never more than was paid, a reason, a tick). */
  adminRefund: (el) => {
    const o = st.orders.find((x) => x.id === el.dataset.v); const f = st.form;
    const bad = (m) => { f.refundMsg = m; f.refundOk = false; render(false); };
    const raw = String(f["rf-amt"] ?? "0").replace(/[,\s]/g, ""); const amt = raw === "" ? 0 : Number(raw);
    const left = o.amount - (o.refunds || []).reduce((a, r) => a + r.amt, 0);
    const ends = st.memberships.filter((m) => m.orderId === o.id && f["rf-end-" + m.id] && !m.endedEarly && m.end > TODAY);
    const reason = String(f["rf-reason"] || "").trim();
    if (!f["rf-ok"]) return bad("Tick the box to confirm you understand this takes effect straight away.");
    if (!Number.isInteger(amt) || amt < 0) return bad("Enter the refund as a whole number of NT$ (0 if no money is being returned).");
    if (!reason) return bad("Write the reason. It is kept in the record.");
    if (amt > left) return bad("That is more than is left to refund on this order.");
    if (amt === 0 && ends.length === 0) return bad("Enter a refund amount or tick a membership to end.");
    if (amt > 0) (o.refunds = o.refunds || []).push({ amt, method: f["rf-method"] || "ecpay_backoffice", reason, on: TODAY });
    ends.forEach((m) => { m.endedEarly = { on: TODAY, reason, was: m.end }; m.end = TODAY; });
    const bits = [amt > 0 ? `refund of ${nt(amt)} recorded` : null, ends.length ? `${ends.length} membership${ends.length === 1 ? "" : "s"} ended` : null].filter(Boolean);
    st.form = { refundMsg: `${o.ref}: ${bits.join(" and ")}. In the real site the buyer is emailed and the member loses access at once.`, refundOk: true };
    save(); render(false);
  },
  markChecked: (el) => { const r = st.payReview.find((x) => x.id === el.dataset.v); if (r) r.done = true; render(false); },
  suspend: (el) => { const r = st.reports.find((x) => x.id === el.dataset.v); r.status = "actioned"; if (r.type === "educator") st.suspended[r.targetId] = true; else st.removedJobs[r.targetId] = true; save(); render(false); },
  dismiss: (el) => { const r = st.reports.find((x) => x.id === el.dataset.v); r.status = "dismissed"; save(); render(false); },
  reinstate: (el) => { delete st.suspended[el.dataset.v]; save(); render(false); },
};

/* ================= events ================= */
document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-act]");
  if (!el || el.disabled) return;
  const fn = A[el.dataset.act];
  if (fn) { e.preventDefault(); fn(el, e); save(); }
});
document.addEventListener("keydown", (e) => {
  if ((e.key === "Enter" || e.key === " ") && e.target.matches && e.target.matches('[role="button"][data-act]')) { e.preventDefault(); e.target.dispatchEvent(new MouseEvent("click", { bubbles: true })); }
});
function onField(e) {
  const el = e.target;
  if (!el.dataset || !el.dataset.f) return;
  st.form[el.dataset.f] = el.type === "checkbox" ? el.checked : el.value;
  if (el.type === "checkbox" || el.tagName === "SELECT" || el.dataset.r || e.type === "input") render(false);
}
document.addEventListener("input", onField);
document.addEventListener("change", (e) => { if (e.target.type === "checkbox" || e.target.tagName === "SELECT") onField(e); });

render(true);
