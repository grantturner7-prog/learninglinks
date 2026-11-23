/* ================= educators: members only, audience-filtered, map and list together ================= */
const eduCard = (e, type) => {
  const tut = type === "family";
  return `<article class="card flat edu"><div class="row"><div class="avatar" style="background:${e.mine ? "var(--apricot-300)" : "var(--lilac-100)"}">${h((e.name || "?")[0])}</div><div class="grow"><div class="nm">${h(e.name)} ${e.mine ? `<span class="badge apricot">${T("You", "您")}</span>` : ""}</div><div class="where">${h(placeName(e))}</div></div></div>
    <div>${h(e.head || "")}</div><div class="tags">${(e.subjects || []).map((s) => `<span class="badge">${h(lab(SUBJECT[s]))}</span>`).join("")}</div>
    <div class="small muted">${tut ? (e.rateMin ? `${nt(e.rateMin)}–${nt(e.rateMax)} ${T("per hour", "每小時")} · ` : "") + (e.levels || []).map((l) => lab(LEVEL[l])).join(", ") : (e.openTo || []).filter((o) => o !== "private_tutoring").map((o) => lab(OPEN[o])).join(" · ")}</div>
    <div class="row" style="margin-top:4px"><button class="btn" data-act="viewEdu" data-v="${e.id}">${T("View profile", "查看檔案")}</button></div></article>`;
};

const wall = (type) => {
  const m = me();
  const dummy = EDU.slice(0, 3).map((e) => eduCard(e, "family")).join("");
  const cta = !m ? `<p>${T("Educators are shown to paying members only. Nobody sees an educator without a membership.", "教師僅顯示給付費會員。沒有會員資格的人看不到任何教師。")}</p><div class="row" style="justify-content:center;margin-top:14px"><button class="btn btn-primary btn-lg" data-act="start" data-v="family">${T("Join as a family", "以家庭加入")}</button><button class="btn btn-lg" data-act="start" data-v="school">${T("Join as a school", "以學校加入")}</button></div>`
    : m.type === "family" ? `<p>${T("Join for 12 months to see educators who offer private tutoring.", "加入 12 個月，即可查看提供私人家教的教師。")}</p><div class="row" style="justify-content:center;margin-top:14px"><button class="btn btn-primary btn-lg" data-act="join" data-v="family">${T("Join as a family", "以家庭加入")} · ${nt(PRICE_FAMILY)}</button></div>`
    : m.type === "school" ? `<p>${T("Pay for a campus to see educators who are open to full-time or part-time work.", "為校區付費後，即可查看開放全職或兼職的教師。")}</p><div class="row" style="justify-content:center;margin-top:14px"><button class="btn btn-primary btn-lg" data-act="${ownedCampuses(m.id).length ? "join" : "nav"}" data-v="${ownedCampuses(m.id).length ? "school" : "campuses"}">${ownedCampuses(m.id).length ? T("Pay for campuses", "支付校區費用") : T("Find my school", "尋找我的學校")}</button></div>`
    : `<p>${T("Families and schools see educators. As an educator you see job posts from schools instead.", "家庭與學校可查看教師；教師則查看學校的職缺。")}</p>`;
  return `<div class="stack"><h1>${T("Find educators", "尋找教師")}</h1><div class="wall"><div class="blur grid g3" aria-hidden="true">${dummy}</div><div class="wallcta"><div class="card soft">${cta}</div></div></div></div>`;
};

V.educators = () => {
  const m = me();
  const type = m && (m.type === "family" || m.type === "school") ? m.type : null;
  if (!type || !hasMembership()) return wall(type);
  const base = visibleTo(type);
  const f = { subject: val("subject"), city: val("city"), work: val("work") };
  const pass = (e) => (!f.subject || e.subjects.includes(f.subject)) && (type !== "school" || !f.work || e.openTo.includes(f.work));
  // A district only counts while its own city is the one chosen (the City box can change underneath it).
  if (st.form.district && (cityOfDist(st.form.district) !== f.city || !GEO.dBy.has(st.form.district))) st.form.district = "";
  const district = val("district");
  const onMap = base.filter(pass);
  const list = onMap.filter((e) => (!f.city || e.city === f.city) && (!district || e.district === district));
  const where = district ? (st.lang === "zh" ? lab(CITY[f.city]) + distFull(district) : distFull(district) + ", " + lab(CITY[f.city])) : f.city ? lab(CITY[f.city]) : "";
  const opt = (obj, cur) => Object.keys(obj).map((k) => `<option value="${k}" ${cur === k ? "selected" : ""}>${h(lab(obj[k]))}</option>`).join("");
  return `<div class="stack"><div><h1>${T("Find educators", "尋找教師")}</h1><p class="muted">${type === "family" ? T("Showing educators who offer private tutoring or coaching.", "顯示提供私人家教或輔導的教師。") : T("Showing educators who are open to full-time or part-time work.", "顯示開放全職或兼職工作的教師。")}</p></div>
    ${type === "family" ? `<div class="notice">${h(noticeFull().tutoringWork)}</div>` : ""}
    <div class="card flat filters"><div class="grid g3"><div><label class="lab" for="f-subject">${T("Subject", "科目")}</label><select class="field" id="f-subject" data-f="subject" data-r="1"><option value="">${T("Any", "不限")}</option>${opt(SUBJECT, f.subject)}</select></div>
      <div><label class="lab" for="f-city">${T("City", "縣市")}</label><select class="field" id="f-city" data-f="city" data-r="1"><option value="">${T("Any", "不限")}</option>${DEMO_CITIES.map((c) => `<option value="${c}" ${f.city === c ? "selected" : ""}>${h(lab(CITY[c]))}</option>`).join("")}</select></div>
      ${type === "school" ? `<div><label class="lab" for="f-work">${T("Open to", "開放型態")}</label><select class="field" id="f-work" data-f="work" data-r="1"><option value="">${T("Full-time or part-time", "全職或兼職")}</option><option value="full_time" ${f.work === "full_time" ? "selected" : ""}>${T("Full-time", "全職")}</option><option value="part_time" ${f.work === "part_time" ? "selected" : ""}>${T("Part-time", "兼職")}</option></select></div>` : ""}</div></div>
    <div class="mapgrid"><div>${educatorMap(onMap, f.city, district, T("Educators appear by area, never by address. Tap a city, then a district, to see who is there.", "教師只顯示所在地區，不顯示地址。先點選縣市，再點選行政區，即可查看該區的教師。") + " · " + onMap.length + " " + T("educators on the map", "位教師"))}${f.city ? `<button class="link-btn" data-act="mall">${T("Show all areas", "顯示所有地區")}</button>` : ""}</div>
    <div class="stack"><h2>${where ? T("Educators in", "教師位於") + " " + h(where) : T("Educators in all areas", "所有地區的教師")} <span class="muted small">(${list.length})</span></h2>${list.length ? `<div class="grid g2">${list.slice(0, 12).map((e) => eduCard(e, type)).join("")}</div>${list.length > 12 ? `<p class="muted small">${T("Showing the first 12. Narrow the filters to see others.", "僅顯示前 12 位。請縮小篩選條件查看其他教師。")}</p>` : ""}` : `<div class="card flat">${T("Nobody matches. Try removing a filter.", "沒有符合的教師，請試著移除篩選條件。")}</div>`}</div></div></div>`;
};

V.educator = () => {
  const m = me();
  const type = m && (m.type === "family" || m.type === "school") ? m.type : null;
  const e = type && hasMembership() ? visibleTo(type).find((x) => x.id === st.args.id) : null;
  if (!e) return `<div class="card">${T("This educator is not available to you. (Tutoring-only educators are never shown to schools, and school-work educators are never shown to families.)", "您無法查看這位教師。（只做家教的教師不會顯示給學校，只找學校工作的教師不會顯示給家庭。）")} <button class="link-btn" data-act="nav" data-v="educators">${T("Back", "返回")}</button></div>`;
  const rev = st.reveals.find((r) => r.eduId === e.id && r.by === m.id);
  const today = st.reveals.filter((r) => r.by === m.id && r.day === TODAY).length;
  const langs = { en: T("English", "英語"), zh: T("Mandarin", "華語") };
  return `<div class="stack"><button class="link-btn" data-act="nav" data-v="educators">← ${T("Back to the map and list", "回到地圖與清單")}</button>
    <div class="card soft"><div class="row"><div class="avatar" style="width:64px;height:64px;font-size:26px;background:var(--lilac-100)">${h(e.name[0])}</div><div><h1 style="font-size:32px">${h(e.name)}</h1><div class="muted">${h(placeName(e))}</div></div></div>
      <p style="margin:14px 0;font-size:18px">${h(e.head)}</p><p>${h(e.bio)}</p>
      <div class="tags" style="margin-top:12px">${e.subjects.map((s) => `<span class="badge">${h(lab(SUBJECT[s]))}</span>`).join("")}${e.levels.map((s) => `<span class="badge plain">${h(lab(LEVEL[s]))}</span>`).join("")}</div>
      <dl class="small" style="display:grid;grid-template-columns:auto 1fr;gap:6px 18px;margin:16px 0 0"><dt class="muted">${T("Languages", "教學語言")}</dt><dd style="margin:0">${e.langs.map((l) => langs[l]).join(", ")}</dd><dt class="muted">${T("Experience", "經驗")}</dt><dd style="margin:0">${e.exp} ${T("years", "年")}</dd>
      ${type === "family" ? `<dt class="muted">${T("Rate", "費用")}</dt><dd style="margin:0"><b>${nt(e.rateMin)}–${nt(e.rateMax)}</b> ${T("per hour", "每小時")}</dd>` : `<dt class="muted">${T("Open to", "開放型態")}</dt><dd style="margin:0">${e.openTo.filter((o) => o !== "private_tutoring").map((o) => lab(OPEN[o])).join(", ")}</dd><dt class="muted">${T("Looking for", "期望")}</dt><dd style="margin:0">${h(e.wish)}</dd>`}</dl>
      <p class="tiny muted" style="margin-top:10px">${type === "family" ? T("You see the tutoring side of this profile. School-work wishes are not shown to families.", "您看到的是此檔案的家教部分。找學校工作的意願不會顯示給家庭。") : T("You see the school-work side of this profile. Tutoring and rates are not shown to schools.", "您看到的是此檔案的學校工作部分。家教與費用不會顯示給學校。")}</p></div>
    ${type === "family" ? `<div class="notice">${h(noticeFull().tutoringWork)}</div>` : ""}
    <div class="card"><h3>${T("Contact details", "聯絡方式")}</h3>${rev ? `<dl class="small" style="display:grid;grid-template-columns:auto 1fr;gap:6px 18px;margin:10px 0 0"><dt class="muted">Email</dt><dd style="margin:0" data-testid="contact-email">${h(e.email)}</dd><dt class="muted">LINE</dt><dd style="margin:0">${h(e.line)}</dd></dl><p class="hint" style="margin-top:8px">${T("These are the contact details the educator chose to share. We are not an employer or an agent, and we do not run background checks.", "這些是教師選擇分享的聯絡方式。我們不是雇主或仲介，也不進行背景調查。")}</p>` : `<p class="muted" style="margin-top:6px">${T(`Showing contact details is logged. You have opened ${today} of ${REVEAL_CAP} educators today.`, `查看聯絡方式會留下紀錄。您今天已查看 ${today} / ${REVEAL_CAP} 位教師。`)}</p><div class="row" style="margin-top:12px"><button class="btn btn-primary btn-lg" data-act="reveal" data-v="${e.id}">${T("Show contact details", "顯示聯絡方式")}</button></div>`}</div>
    <div class="row"><button class="link-btn" data-act="reportOpen" data-t="educator" data-v="${e.id}">${T("Report this profile", "檢舉此檔案")}</button></div></div>`;
};

/* ================= schools: claim a campus, post jobs ================= */
V.campuses = () => {
  const m = me();
  if (!m || m.type !== "school") return V.home();
  const q = val("q").trim().toLowerCase(), g = val("g"), city = val("city");
  const pool = SCHOOLS.concat(st.custom, REAL_SCHOOLS).filter((s) => !st.owners[s.id] || st.owners[s.id] === m.id);
  const match = pool.filter((s) => (!g || inGroup(s, g)) && (!city || s.city === city) && (!q || s.name.toLowerCase().includes(q)));
  const browsing = q.length >= 2 || g || city;
  const shown = browsing ? match.slice(0, 40) : [];
  const cityOpts = Object.keys(CITY).filter((k) => pool.some((s) => s.city === k)).map((k) => `<option value="${k}" ${city === k ? "selected" : ""}>${h(lab(CITY[k]))}</option>`).join("");
  const addBtn = `<button class="btn" data-act="nav" data-v="addschool">${T("Cannot find it? Add my school", "找不到嗎？新增我的學校")}</button>`;
  return `<div class="stack"><div><h1>${T("Find your school", "尋找您的學校")}</h1><p class="muted">${T("The list holds the Ministry of Education's government and private schools, universities, schools for international residents, and cram schools. Claim each campus you want to pay for. Each campus is NT$10,000 for its own 12 months. In the real site an administrator checks every claim.", "清單包含教育部公布的公私立學校、大專校院、外國僑民學校與補習班。認領您要付費的每個校區。每個校區 NT$10,000，各有 12 個月。在真實網站中，每個認領都會由管理員審核。")}</p></div>
    ${ownedCampuses(m.id).length ? `<div class="card soft stack"><h2>${T("Your campuses", "您的校區")}</h2>${ownedCampuses(m.id).map((s) => `<div class="row" style="justify-content:space-between"><span><b>${h(s.name)}</b><br><span class="small muted">${s.ownership ? (s.ownership === "public" ? T("Government", "公立") : T("Private", "私立")) + " · " : ""}${h(lab(KIND[s.kind] || KIND.other))} · ${h(placeName(s))}${bilBadge(s)}</span></span><span class="row"><button class="link-btn" data-act="toggleBil" data-v="${s.id}" data-testid="bilingual-toggle">${st.bil[s.id] ? T("Remove the Bilingual badge", "移除「雙語」標章") : T("Show the Bilingual badge", "顯示「雙語」標章")}</button><span class="badge">${T("Your campus", "您的校區")}</span></span></div>`).join("")}</div>` : ""}
    <div class="card flat stack"><div class="lab">${T("Browse by kind", "依類型瀏覽")}</div><div class="pills"><button class="pill" data-act="pick" data-k="g" data-v="" aria-pressed="${!g}">${T("All", "全部")}</button>${Object.keys(GROUPS).map((k) => `<button class="pill" data-act="pick" data-k="g" data-v="${k}" aria-pressed="${g === k}">${h(lab(GROUPS[k]))}</button>`).join("")}</div>
      <div class="grid g2"><div><label class="lab" for="f-q">${T("Name (part of it is enough)", "校名（輸入一部分即可）")}</label><input class="field" id="f-q" data-f="q" value="${h(val("q"))}" placeholder="${T("e.g. Taipei American, 東海, Sunshine", "例如：Taipei American、東海、Sunshine")}"></div><div><label class="lab" for="f-city">${T("City or county", "縣市")}</label><select class="field" id="f-city" data-f="city" data-r="1"><option value="">${T("Any", "不限")}</option>${cityOpts}</select></div></div></div>
    ${browsing ? `<p class="muted small">${match.length.toLocaleString("en-US")} ${T("schools match", "間學校符合")}${match.length > 40 ? " · " + T("showing the first 40", "顯示前 40 間") : ""}</p>` : `<p class="muted">${T("Pick a kind or a city to browse, or type part of the name.", "請選擇類型或縣市瀏覽，或輸入校名的一部分。")} ${REAL_SCHOOLS.length.toLocaleString("en-US")} ${T("schools are in this demo's list.", "間學校在此示範的清單中。")}</p>`}
    <div class="grid g2" data-testid="school-hits">${shown.map((s) => { const mine = st.owners[s.id] === m.id; return `<div class="card flat"><b>${h(s.name)}</b><div class="small muted">${s.ownership ? `<span class="badge plain">${s.ownership === "public" ? T("Government", "公立") : T("Private", "私立")}</span> ` : ""}${h(lab(KIND[s.kind] || KIND.other))} · ${h(placeName(s))}${bilBadge(s)}</div><div class="row" style="margin-top:10px">${mine ? `<span class="badge">${T("Your campus", "您的校區")}</span>` : `<button class="btn" data-act="claimStart" data-v="${s.id}">${T("This is my school", "這是我的學校")}</button>`}</div></div>`; }).join("")}</div>
    ${browsing && !shown.length ? `<div class="card flat">${T("Nothing in the list matches. You can add your school below.", "清單中沒有符合的學校。您可以在下方新增您的學校。")}</div>` : ""}
    <div class="row">${addBtn}${ownedCampuses(m.id).length ? `<button class="btn btn-primary btn-lg" data-act="nav" data-v="dashboard">${T("Continue", "繼續")}</button>` : ""}</div></div>`;
};

/** Last question of claiming a school: anything to add, and (optional) whether it teaches bilingually. */
V.claim = () => {
  const m = me();
  const sc = schoolById(st.args.id);
  if (!m || m.type !== "school" || !sc) return V.home();
  const f = st.form;
  return frame({ step: 2, total: 2, aside: `<div class="eyebrow">${T("You are claiming", "您正在認領")}</div><p class="bold" style="font-size:20px;margin-top:6px">${h(sc.name)}</p><p class="small muted">${sc.ownership ? (sc.ownership === "public" ? T("Government", "公立") : T("Private", "私立")) + " · " : ""}${h(lab(KIND[sc.kind] || KIND.other))} · ${h(placeName(sc))}</p>`, exit: { act: "nav", v: "campuses", label: "← " + T("Back to the school list", "回到學校清單") },
    say: T("Only our team sees your details, to check the claim.", "只有我們的團隊會看到您的資料，用來審核認領。"), q: T("Anything else we should know?", "還有什麼想告訴我們的嗎？"),
    body: `<p class="hint">${T("In the real site you also give your name, role and phone number here, and an administrator checks the claim. In this demo the claim is accepted straight away.", "在真實網站中，您還會在這裡填寫姓名、職稱與電話，並由管理員審核認領。此示範會直接接受。")}</p>${bilTick()}`,
    back: "claimBack", next: "claimSend", nextLabel: T("Send my claim", "送出認領"), nextDisabled: false });
};

/** A school that is not on any list: it gives its kind, name and area, never a street address. */
V.addschool = () => {
  const m = me();
  if (!m || m.type !== "school") return V.home();
  const step = val("step", 1);
  const f = st.form;
  const kinds = Object.keys(KIND);
  const cities = Object.keys(CITY);
  const ds = f.city ? distsOf(f.city) : [];
  const exit = { act: "nav", v: "campuses", label: "← " + T("Back to the school list", "回到學校清單") };
  const aside = `<div class="eyebrow">${T("Your school", "您的學校")}</div><p class="bold" style="font-size:20px;margin-top:6px">${h(f.name || T("Its name", "學校名稱"))}</p><p class="small muted">${f.kind ? h(lab(KIND[f.kind])) : ""}${f.city ? " · " + h(lab(CITY[f.city])) : ""}${f.district ? ", " + h(lab(DIST[f.district])) : ""}</p><p class="tiny muted" style="margin-top:10px">${T("We only keep its name, kind and area. We never ask for a street address. It is shown on the map by area.", "我們只保留校名、類型與地區，不會要求街道地址，地圖上也只顯示地區。")}</p>`;
  if (step === 1) return frame({ step, total: 3, aside, exit, say: T("No problem. Plenty of good schools are not on a list yet.", "沒問題，很多好學校還沒出現在清單中。"), q: T("What kind of school is it?", "這是哪一種學校？"),
    body: `<div class="grid g3">${kinds.map((k) => `<button class="tile" data-act="pick" data-k="kind" data-v="${k}" ${sel("kind", k)}><span class="t">${h(lab(KIND[k]))}</span></button>`).join("")}</div>${bilTick()}`, next: "addNext", nextLabel: T("Continue", "繼續"), nextDisabled: !f.kind });
  if (step === 2) return frame({ step, total: 3, aside, exit, back: "addBack", say: T("Use the name people know it by.", "請使用大家熟悉的校名。"), q: T("What is it called?", "學校名稱是什麼？"),
    body: `<label class="lab" for="f-name">${T("School name", "學校名稱")}</label><input class="field" id="f-name" data-f="name" value="${h(f.name || "")}" maxlength="120" placeholder="${T("e.g. Maple Bilingual School", "例如：楓葉雙語學校")}">`, next: "addNext", nextLabel: T("Continue", "繼續"), nextDisabled: (f.name || "").trim().length < 2 });
  return frame({ step: 3, total: 3, aside, exit, back: "addBack", say: T("Only the area. The pin sits in the middle of it.", "只需要地區，標記會放在該地區的中央。"), q: T("Where is it?", "學校在哪裡？"),
    body: `<div class="pills">${cities.map((c) => `<button class="pill" data-act="pick" data-k="city" data-v="${c}" ${sel("city", c)}>${h(lab(CITY[c]))}</button>`).join("")}</div>${ds.length ? `<p class="lab" style="margin:16px 0 8px">${T("District (optional)", "行政區（選填）")}</p><div class="pills">${ds.map((d) => `<button class="pill" data-act="pick" data-k="district" data-v="${d}" ${sel("district", d)}>${h(lab(DIST[d]))}</button>`).join("")}</div>` : ""}<div class="notice" style="margin-top:14px">${T("In the real site an administrator checks every new school before it is shown to anyone. In this demo it is added straight away.", "在真實網站中，每間新學校都會由管理員審核後才會顯示給其他人。此示範會直接新增。")}</div>`, next: "addSchool", nextLabel: T("Add my school", "新增我的學校"), nextDisabled: !f.city });
};

const SUBST = /substitut|cover(?:ing)?\b|relief teacher|supply teacher|temp(?:orary)? (?:cover|teacher)|代課|臨時代班|代班/i;
V.jobnew = () => {
  const m = me();
  if (!m || m.type !== "school") return V.home();
  const paid = ownedCampuses(m.id).filter((s) => campusActive(m.id, s.id));
  if (!paid.length) return `<div class="card">${T("Only schools with an active membership can post jobs. Pay for a campus first.", "只有會員有效的學校才能刊登職缺，請先為校區付費。")} <button class="link-btn" data-act="nav" data-v="dashboard">${T("Back", "返回")}</button></div>`;
  const bad = SUBST.test(val("title") + " " + val("desc"));
  const ok = val("title").trim() && val("desc").trim() && /@/.test(val("contact")) && !bad;
  return `<div class="stack"><div><h1>${T("Post a job", "刊登職缺")}</h1><p class="muted">${T("Full-time or part-time only. Job posts are visible only to signed-in educators who have a profile.", "僅限全職或兼職。職缺只有已登入且有檔案的教師看得到。")}</p></div>
    <div class="card soft stack"><div><label class="lab" for="f-campus">${T("Campus", "校區")}</label><select class="field" id="f-campus" data-f="campus" data-r="1">${paid.map((s) => `<option value="${s.id}" ${val("campus", paid[0].id) === s.id ? "selected" : ""}>${h(s.name)}</option>`).join("")}</select></div>
      <div><label class="lab" for="f-title">${T("Job title", "職缺名稱")}</label><input class="field" id="f-title" data-f="title" value="${h(val("title"))}" placeholder="${T("e.g. Kindergarten English teacher", "例如：幼兒園英語教師")}"></div>
      <div><label class="lab">${T("Type", "型態")}</label><div class="pills"><button class="pill" data-act="pick" data-k="jtype" data-v="full_time" ${st.form.jtype === "part_time" ? 'aria-pressed="false"' : 'aria-pressed="true"'}>${T("Full-time", "全職")}</button><button class="pill" data-act="pick" data-k="jtype" data-v="part_time" ${sel("jtype", "part_time")}>${T("Part-time", "兼職")}</button></div></div>
      <div><label class="lab" for="f-subject">${T("Subject", "科目")}</label><select class="field" id="f-subject" data-f="subject">${Object.keys(SUBJECT).map((k) => `<option value="${k}" ${val("subject") === k ? "selected" : ""}>${h(lab(SUBJECT[k]))}</option>`).join("")}</select></div>
      <div><label class="lab" for="f-desc">${T("Description", "說明")}</label><textarea class="field" id="f-desc" data-f="desc" placeholder="${T("Hours, level, start date…", "時數、年級、開始日期…")}">${h(val("desc"))}</textarea></div>
      <div><label class="lab" for="f-contact">${T("How should educators apply? (email)", "教師如何應徵？（電子郵件）")}</label><input class="field" id="f-contact" data-f="contact" value="${h(val("contact"))}" placeholder="hr@yourschool.example"></div>
      ${bad ? `<p class="err" role="alert">${T("Job posts cannot offer substitute or cover work. LearningLinks does not offer substitute work. Schools and educators arrange that between themselves.", "職缺不可提供代課或臨時代班。LearningLinks 不提供代課服務，學校與教師須自行協商。")}</p>` : ""}
      <div class="row"><button class="btn btn-primary btn-lg" data-act="jobPublish" ${ok ? "" : "disabled"}>${T("Publish job post", "發布職缺")}</button></div></div></div>`;
};

V.myjobs = () => {
  const m = me();
  if (!m || m.type !== "school") return V.home();
  const mine = st.jobs.filter((j) => ownedCampuses(m.id).some((s) => s.id === j.schoolId));
  return `<div class="stack"><div class="row" style="justify-content:space-between"><h1>${T("My job posts", "我的職缺")}</h1><button class="btn btn-primary" data-act="nav" data-v="jobnew">${T("Post a job", "刊登職缺")}</button></div>
    ${mine.length ? mine.map((j) => `<div class="card flat"><div class="row" style="justify-content:space-between"><div><b>${h(j.title)}</b><div class="small muted">${h(schoolById(j.schoolId).name)} · ${h(lab(OPEN[j.type]))}</div></div><div class="row"><span class="badge ${j.status === "open" && !st.removedJobs[j.id] ? "" : "plain"}">${st.removedJobs[j.id] ? T("Removed", "已下架") : j.status === "open" ? T("Open", "開放中") : T("Closed", "已關閉")}</span>${j.status === "open" && !st.removedJobs[j.id] ? `<button class="btn" data-act="closeJob" data-v="${j.id}">${T("Close", "關閉")}</button>` : ""}</div></div></div>`).join("") : `<div class="card flat">${T("No job posts yet.", "尚無職缺。")}</div>`}</div>`;
};

/* ================= educators: the guided profile and the school/job map ================= */
const blankProfile = () => ({ open: [], city: "", district: "", subjects: [], levels: [], name: (me() || {}).name || "", head: "", bio: "", rateMin: "", rateMax: "", wish: "", email: "", line: "", waiver: false, ack: false });
function openProfile() {
  const p = st.myProfile;
  go("profile");
  st.form = p ? { open: p.openTo.slice(), city: p.city, district: p.district || "", subjects: p.subjects.slice(), levels: p.levels.slice(), name: p.name, head: p.head, bio: p.bio, rateMin: p.rateMin || "", rateMax: p.rateMax || "", wish: p.wish || "", email: p.email, line: p.line, waiver: true, ack: true } : blankProfile();
  render(true);
}
const looksPrivate = (s) => /@|\b\d{8,}\b|\b[A-Z][12]\d{8}\b|line\s*id|whatsapp|wechat/i.test(s || "");
V.profile = () => {
  const m = me();
  if (!m || m.type !== "educator") return V.home();
  const step = val("step", 1);
  const f = st.form;
  const tut = (f.open || []).includes("private_tutoring");
  const school = (f.open || []).some((o) => o === "full_time" || o === "part_time");
  const pv = val("pv", tut ? "family" : "school");
  const preview = `<div class="eyebrow">${T("Live preview", "即時預覽")}</div>${tut && school ? `<div class="seg" style="margin:8px 0"><button data-act="pick" data-k="pv" data-v="family" aria-pressed="${pv === "family"}">${T("As a family sees it", "家庭看到的")}</button><button data-act="pick" data-k="pv" data-v="school" aria-pressed="${pv === "school"}">${T("As a school sees it", "學校看到的")}</button></div>` : ""}
    ${eduCard({ id: "preview", mine: false, name: f.name || T("Your name", "您的名字"), city: f.city || "taichung", district: f.district || null, head: f.head || T("Your headline", "您的標題"), subjects: f.subjects || [], levels: f.levels || [], openTo: f.open || [], rateMin: Number(f.rateMin) || null, rateMax: Number(f.rateMax) || null }, pv).replace(/<button[^>]*data-act="viewEdu"[^>]*>.*?<\/button>/, "")}
    <p class="tiny muted" style="margin-top:8px">${T("Families see only the tutoring side and rates. Schools see only the school-work side. Nobody sees your address.", "家庭只看到家教部分與費用，學校只看到學校工作部分。沒有人會看到您的地址。")}</p>`;
  const common = { total: 6, aside: preview, exit: { act: "nav", v: "dashboard", label: "← " + T("Save later, back to my dashboard", "稍後再做，回到儀表板") } };
  if (step === 1) return frame({ ...common, step, say: T("Hi, I am Link. You decide what you are open to.", "嗨，我是 Link。由您決定開放什麼。"), q: T("What are you open to?", "您開放哪些型態？"),
    body: `<div class="grid g3">${Object.keys(OPEN).map((k) => `<button class="tile" data-act="toggle" data-k="open" data-v="${k}" ${selm("open", k)}><span class="t">${h(lab(OPEN[k]))}</span><span class="d">${k === "private_tutoring" ? T("Seen by families, with your rate", "家庭可見，含您的費用") : T("Seen by schools", "學校可見")}</span></button>`).join("")}</div>${tut ? `<div class="notice" style="margin-top:14px">${h(noticeFull().tutoringWork)}</div>` : ""}`, next: "profNext", nextLabel: T("Continue", "繼續"), nextDisabled: !(f.open || []).length });
  if (step === 2) return frame({ ...common, step, back: "profBack", say: T("Only the area is shown, never an address.", "只會顯示地區，絕不顯示地址。"), q: T("Where are you?", "您在哪裡？"),
    body: `<div class="pills">${DEMO_CITIES.map((c) => `<button class="pill" data-act="pick" data-k="city" data-v="${c}" ${sel("city", c)}>${h(lab(CITY[c]))}</button>`).join("")}</div>${f.city && distsOf(f.city).length ? `<p class="lab" style="margin:16px 0 8px">${T("District", "行政區")}</p><div class="pills">${distsOf(f.city).map((d) => `<button class="pill" data-act="pick" data-k="district" data-v="${d}" ${sel("district", d)}>${h(lab(DIST[d]))}</button>`).join("")}</div>` : ""}`, next: "profNext", nextLabel: T("Continue", "繼續"), nextDisabled: !f.city });
  if (step === 3) return frame({ ...common, step, back: "profBack", say: T("Pick as many as fit.", "符合的都可以選。"), q: T("What do you teach?", "您教什麼？"),
    body: `<p class="lab">${T("Subjects", "科目")}</p><div class="pills">${Object.keys(SUBJECT).map((k) => `<button class="pill" data-act="toggle" data-k="subjects" data-v="${k}" ${selm("subjects", k)}>${h(lab(SUBJECT[k]))}</button>`).join("")}</div><p class="lab" style="margin-top:16px">${T("Levels", "年級")}</p><div class="pills">${Object.keys(LEVEL).map((k) => `<button class="pill" data-act="toggle" data-k="levels" data-v="${k}" ${selm("levels", k)}>${h(lab(LEVEL[k]))}</button>`).join("")}</div>`, next: "profNext", nextLabel: T("Continue", "繼續"), nextDisabled: !(f.subjects || []).length || !(f.levels || []).length });
  if (step === 4) { const bad = looksPrivate(f.bio) || looksPrivate(f.head); return frame({ ...common, step, back: "profBack", say: T("A friendly line or two is plenty.", "一兩句友善的介紹就夠了。"), q: T("Tell people about you", "介紹一下您自己"),
    body: `<div class="stack"><div><label class="lab" for="f-name">${T("Display name", "顯示名稱")}</label><input class="field" id="f-name" data-f="name" value="${h(f.name)}" maxlength="40"></div><div><label class="lab" for="f-head">${T("Headline", "標題")}</label><input class="field" id="f-head" data-f="head" value="${h(f.head)}" maxlength="90" placeholder="${T("e.g. Patient English teacher for young learners", "例如：有耐心的兒童英語教師")}"></div><div><label class="lab" for="f-bio">${T("About you", "關於您")}</label><textarea class="field" id="f-bio" data-f="bio" maxlength="600">${h(f.bio)}</textarea></div>${bad ? `<p class="err" role="alert">${T("Please do not put contact details, ID numbers or messaging IDs in your profile text. You choose who sees your contact details later.", "請不要在檔案文字中放入聯絡方式、證件號碼或通訊軟體帳號。您之後可以自行決定誰能看到聯絡方式。")}</p>` : ""}</div>`, next: "profNext", nextLabel: T("Continue", "繼續"), nextDisabled: !(f.name || "").trim() || !(f.head || "").trim() || !(f.bio || "").trim() || bad }); }
  if (step === 5) return frame({ ...common, step, back: "profBack", say: T("Rates go to families only. Schools never see them.", "費用只給家庭看，學校不會看到。"), q: tut ? T("Your rate and wishes", "您的費用與期望") : T("What are you looking for?", "您在找什麼？"),
    body: `<div class="stack">${tut ? `<div class="grid g2"><div><label class="lab" for="f-rateMin">${T("Rate from (NT$ per hour)", "費用起（每小時 NT$）")}</label><input class="field" id="f-rateMin" data-f="rateMin" inputmode="numeric" value="${h(f.rateMin)}"></div><div><label class="lab" for="f-rateMax">${T("to", "至")}</label><input class="field" id="f-rateMax" data-f="rateMax" inputmode="numeric" value="${h(f.rateMax)}"></div></div>` : ""}${school ? `<div><label class="lab" for="f-wish">${T("What kind of school work? (schools only)", "想找哪種學校工作？（僅學校可見）")}</label><input class="field" id="f-wish" data-f="wish" value="${h(f.wish)}" placeholder="${T("e.g. Kindergarten, afternoons", "例如：幼兒園，下午時段")}"></div>` : ""}</div>`, next: "profNext", nextLabel: T("Continue", "繼續"), nextDisabled: (tut && !(Number(f.rateMin) > 0 && Number(f.rateMax) >= Number(f.rateMin))) || (school && !(f.wish || "").trim()) });
  return frame({ ...common, step: 6, back: "profBack", say: T("Last one. Your contact details stay hidden until a paying member asks.", "最後一步。付費會員提出申請前，您的聯絡方式都會保持隱藏。"), q: T("Contact details and consent", "聯絡方式與同意"),
    body: `<div class="stack"><div class="grid g2"><div><label class="lab" for="f-email">Email</label><input class="field" id="f-email" data-f="email" value="${h(f.email)}" placeholder="you@example.com"></div><div><label class="lab" for="f-line">LINE ID</label><input class="field" id="f-line" data-f="line" value="${h(f.line)}"></div></div>
    <div class="notice">${T("Publication waiver (summary, draft): I agree that my profile is shown by area to paying members who match what I am open to, that contact details are shown only when a member asks, and that I can hide or delete my profile at any time.", "刊登同意書（摘要，草稿）：我同意我的檔案以地區方式顯示給符合我開放條件的付費會員，聯絡方式僅在會員申請時顯示，且我可隨時隱藏或刪除檔案。")}</div>
    <label class="ack"><input type="checkbox" id="f-waiver" data-f="waiver" data-r="1" ${f.waiver ? "checked" : ""}><span>${T("I agree to the publication waiver.", "我同意刊登同意書。")}</span></label>${ackBox("ack")}</div>`,
    next: "profPublish", nextLabel: T("Publish my profile", "發布我的檔案"), nextDisabled: !(f.email || "").includes("@") || !f.waiver || !f.ack });
};

/** What an educator sees after tapping a school: a picture of the establishment (never people), its name, kind and address. */
function schoolCard(s) {
  const p = s.picture;
  const name = st.lang === "zh" && s.nameZh ? s.nameZh : s.name;
  const other = s.nameZh ? (st.lang === "zh" ? s.name : s.nameZh) : "";
  const pretendAddr = T(`No. ${10 + (s.seed % 180)}, Demo Road, ${placeName(s)}`, `${placeName(s)}示範路 ${10 + (s.seed % 180)} 號`);
  const pic = p
    ? `<img class="schoolpic" src="${p.src}" alt="${h(T(`${name}: the school from outside`, `${name}的學校外觀`))}" width="${p.width}" height="${p.height}" data-testid="school-photo">
       <figcaption class="small muted" data-testid="school-photo-credit">${T("Photo", "攝影")}: ${h(p.author)} · <a href="${h(p.licenceUrl)}" target="_blank" rel="noopener noreferrer">${h(p.licence)}</a> · <a href="${h(p.pageUrl)}" target="_blank" rel="noopener noreferrer">${T("via Wikimedia Commons", "取自維基共享資源")}</a></figcaption>`
    : `<div class="schoolpic none" data-testid="school-no-photo"><svg viewBox="0 0 64 64" width="52" height="52" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 54h48M14 54V30l18-12 18 12v24M26 54V40h12v14M32 18V8m0 0h9v6h-9"/><path d="M20 34h4M40 34h4M20 44h2M42 44h2"/></svg><b>${T("No picture yet", "尚無照片")}</b><span class="small muted">${T("A school can add its own picture when it joins.", "學校加入後可自行提供照片。")}</span></div>`;
  return `<article class="card flat schoolcard" data-testid="school-card"><figure>${pic}</figure>
    <div class="stack" style="gap:8px"><div class="row" style="justify-content:space-between;align-items:flex-start"><div><span class="badge">${T("Selected school", "已選擇的學校")}</span><h3 style="margin-top:6px;font-size:22px" data-testid="school-name">${h(name)}</h3>${other ? `<div class="muted">${h(other)}</div>` : ""}</div><button class="link-btn" data-act="pin" data-v="${s.id}">${T("Close", "關閉")}</button></div>
    <div class="row small" style="gap:8px"><span class="muted">${h(lab(KIND[s.kind]))}</span>${s.ownership ? `<span class="badge plain">${s.ownership === "public" ? T("Government school", "公立學校") : T("Private school", "私立學校")}</span>` : ""}${bilBadge(s)}</div>
    <dl class="facts"><dt>${T("Address", "地址")}</dt><dd data-testid="school-address">${h(s.address || pretendAddr)}${s.address ? "" : ` <span class="small muted">(${T("pretend address: this is a pretend school", "示範地址：這是示範學校")})</span>`}</dd></dl>
    <p class="small muted">${T("Contact details appear here once the school has joined and entered them itself.", "學校加入並自行填寫後，聯絡方式才會顯示在這裡。")}</p>
    ${s.realSchool ? `<p class="small muted">${T("A real school, shown with its public address and a picture that is free to reuse. It has not joined LearningLinks.", "這是真實的學校，顯示其公開地址與可自由使用的照片；該校尚未加入 LearningLinks。")}</p>` : ""}</div></article>`;
}

V.jobs = () => {
  const m = me();
  if (!m || m.type !== "educator" || !st.myProfile) return `<div class="stack"><h1>${T("Job posts from schools", "學校的職缺")}</h1><div class="card soft"><p>${T("Job posts are visible only to signed-in educators who have a profile. Not to the public, families, other schools or search engines.", "職缺只有已登入且有檔案的教師看得到，公眾、家庭、其他學校與搜尋引擎都看不到。")}</p>${m && m.type === "educator" ? `<div class="row" style="margin-top:14px"><button class="btn btn-primary btn-lg" data-act="nav" data-v="profile">${T("Create my profile", "建立我的檔案")}</button></div>` : `<div class="row" style="margin-top:14px"><button class="btn btn-primary btn-lg" data-act="start" data-v="educator">${T("I am an educator (free)", "我是教師（免費）")}</button></div>`}</div></div>`;
  const jobs = openJobs();
  const per = {}; jobs.forEach((j) => { per[j.schoolId] = (per[j.schoolId] || 0) + 1; });
  const city = val("city"), pin = val("pin");
  const withJobs = Object.keys(per).map(schoolById).filter((x) => x && !SCHOOLS.includes(x) && GEO.cBy.has(x.city));
  const schools = SCHOOLS.concat(withJobs);
  const shown = jobs.filter((j) => { const s = schoolById(j.schoolId); return (!city || s.city === city) && (!pin || j.schoolId === pin); });
  const ps = pin ? schoolById(pin) : null;
  return `<div class="stack"><div><h1>${T("Job posts from schools", "學校的職缺")}</h1><p class="muted">${T("Full-time and part-time jobs posted by schools. Only signed-in educators with a profile can see this page.", "學校刊登的全職與兼職職缺。只有已登入且有檔案的教師看得到此頁。")}</p></div>
    <div class="mapgrid"><div>${jobMap(schools, per, pin, city)}${city || pin ? `<button class="link-btn" data-act="mall">${T("Show all areas", "顯示所有地區")}</button>` : ""}</div>
    <div class="stack"><h2>${ps ? h(ps.name) : city ? h(lab(CITY[city])) : T("All open jobs", "所有開放職缺")} <span class="muted small">(${shown.length})</span></h2>
    ${ps ? schoolCard(ps) : ""}
    ${ps && !shown.length ? `<p class="muted">${T("This school has no open job posts right now.", "這所學校目前沒有職缺。")}</p>` : ""}
    ${shown.length ? shown.map((j) => { const s = schoolById(j.schoolId); return `<article class="card flat stack"><div class="row" style="justify-content:space-between"><div><b style="font-size:18px">${h(j.title)}</b><div class="small muted">${h(s.name)} · ${h(lab(KIND[s.kind]))} · ${h(placeName(s))}${bilBadge(s)}</div></div><span class="badge apricot">${h(lab(OPEN[j.type]))}</span></div><p>${h(j.desc)}</p><div class="tags"><span class="badge">${h(lab(SUBJECT[j.subject]))}</span></div><p class="small"><b>${T("Apply:", "應徵：")}</b> ${h(j.contact)}</p><div><button class="link-btn" data-act="reportOpen" data-t="job" data-v="${j.id}">${T("Report this job post", "檢舉此職缺")}</button></div></article>`; }).join("") : ""}
    <p class="small muted">${T("Job posts are written by schools. LearningLinks does not check them or the schools. Check every detail yourself.", "職缺由學校自行撰寫。LearningLinks 不會查核職缺或學校，請自行確認每個細節。")}</p></div></div></div>`;
};

/* ================= reports and the admin desk ================= */
V.report = () => {
  const t = st.args.t, id = st.args.id;
  const target = t === "educator" ? (eduById(id) || {}).name : (st.jobs.find((j) => j.id === id) || {}).title;
  const reasons = t === "job" ? [["misleading", T("Misleading information", "資訊誤導")], ["payment_or_documents", T("A request for payment or documents", "要求付款或文件")], ["substitute", T("Offers substitute or cover work", "提供代課或臨時代班")], ["discrimination", T("Discrimination", "歧視")], ["other", T("Something else", "其他")]] : [["misleading", T("Misleading information", "資訊誤導")], ["abusive", T("Abusive behaviour", "不當行為")], ["payment_or_documents", T("A request for payment or documents", "要求付款或文件")], ["discrimination", T("Discrimination", "歧視")], ["other", T("Something else", "其他")]];
  return `<div class="stack"><h1>${T("Report", "檢舉")}: ${h(target || "")}</h1><p class="muted">${T("An administrator reviews every report. The person reported is never told who reported them.", "管理員會審查每一件檢舉。被檢舉者不會知道是誰檢舉。")}</p>
    <div class="card soft stack"><div><label class="lab" for="f-reason">${T("Reason", "原因")}</label><select class="field" id="f-reason" data-f="reason">${reasons.map(([k, l]) => `<option value="${k}" ${val("reason") === k ? "selected" : ""}>${l}</option>`).join("")}</select></div><div><label class="lab" for="f-details">${T("Details (optional)", "詳細說明（選填）")}</label><textarea class="field" id="f-details" data-f="details" maxlength="500">${h(val("details"))}</textarea></div><div class="row"><button class="btn btn-primary" data-act="reportSubmit">${T("Send report", "送出檢舉")}</button><button class="btn" data-act="back">${T("Cancel", "取消")}</button></div></div></div>`;
};

V.admin = () => {
  const m = me();
  if (!m || m.type !== "admin") return `<div class="card">${T("The admin desk is for administrators only.", "管理員後台僅限管理員使用。")}</div>`;
  const pending = st.orders.filter((o) => o.status === "pending");
  const reviews = st.payReview.filter((r) => !r.done);
  const reports = st.reports.filter((r) => r.status === "open");
  const sus = Object.keys(st.suspended).filter((k) => st.suspended[k]);
  const who = (id) => { const p = Object.values(st.people).find((x) => x.id === id); return p ? `${p.name} (${p.type})` : id; };
  const paidOrders = st.orders.filter((o) => o.status === "paid").slice(-10).reverse();
  const refundedOf = (o) => (o.refunds || []).reduce((a, r) => a + r.amt, 0);
  const mLabel = (m) => (m.kind === "family" ? "Family membership" : (schoolById(m.schoolId) || { name: "Campus" }).name);
  const mState = (m) => (m.endedEarly ? "ended early" : m.end > TODAY ? "running" : "ran its full term");
  const METHOD = { ecpay_backoffice: "ECPay back office", bank_transfer: "Bank transfer", other: "Something else" };
  const refundForm = (o, left, endable) => `<div class="card soft stack" id="refund-form"><h3>Refund or end membership</h3>
    ${endable.length ? `<fieldset class="stack" style="border:0;padding:0;margin:0"><legend class="lab">End membership now</legend>${endable.map((m) => `<label class="ack"><input type="checkbox" id="f-rf-end-${m.id}" data-f="rf-end-${m.id}" ${st.form["rf-end-" + m.id] ? "checked" : ""}><span><b>${h(mLabel(m))}</b> <span class="small muted">${m.start} to ${m.end}</span></span></label>`).join("")}<p class="hint">The member loses access the moment you press the button. Nothing else on the account is touched.</p></fieldset>` : `<p class="small muted">No membership on this order is still running, so there is nothing to end.</p>`}
    <div class="row"><div><label class="lab small" for="f-rf-amt">Refund (NT$)</label><input class="field" style="max-width:160px" id="f-rf-amt" data-f="rf-amt" inputmode="numeric" value="${h(val("rf-amt", "0"))}" ${left === 0 ? "disabled" : ""}></div>
    <div><label class="lab small" for="f-rf-method">Sent back by</label><select class="field" id="f-rf-method" data-f="rf-method" ${left === 0 ? "disabled" : ""}>${Object.entries(METHOD).map(([k, l]) => `<option value="${k}" ${val("rf-method", "ecpay_backoffice") === k ? "selected" : ""}>${l}</option>`).join("")}</select></div></div>
    <p class="hint">${left > 0 ? `Up to ${nt(left)} can still be refunded on this order. Leave 0 to end a membership without refunding.` : "The whole amount has already been refunded."} This site does not send money: send it first in the ECPay merchant back office (or by bank transfer), then record it here.</p>
    <div><label class="lab" for="f-rf-reason">Reason (kept in the record)</label><input class="field" id="f-rf-reason" data-f="rf-reason" maxlength="300" value="${h(val("rf-reason"))}"></div>
    <label class="ack"><input type="checkbox" id="f-rf-ok" data-f="rf-ok" ${st.form["rf-ok"] ? "checked" : ""}><span>I understand this takes effect straight away and cannot be undone from here. Any money has already been sent back, or none is being returned.</span></label>
    <div class="row"><button class="btn btn-primary" data-act="adminRefund" data-v="${o.id}">Record it</button><button class="btn" data-act="closeRefund">Cancel</button></div></div>`;
  const paidCard = (o) => {
    const ms = st.memberships.filter((m) => m.orderId === o.id); const left = o.amount - refundedOf(o); const endable = ms.filter((m) => !m.endedEarly && m.end > TODAY);
    return `<div class="card flat stack" data-testid="paid-order"><div class="row"><b class="num" style="font-size:20px">${o.ref}</b><b>${nt(o.amount)}</b><span class="badge ${o.method === "ecpay" ? "" : "apricot"}">${o.method === "ecpay" ? "Online (ECPay)" : "Bank transfer"}</span><span class="small muted">${o.type === "family" ? "Family" : "School, " + o.campusIds.length + " campus(es)"} · ${h(who(o.by))}</span></div>
      <ul class="small" style="margin:0 0 0 18px">${ms.map((m) => `<li><b>${h(mLabel(m))}</b> · ${m.start} to ${m.end} · ${mState(m)}${m.endedEarly ? ` (would have run to ${m.endedEarly.was}) · ${h(m.endedEarly.reason)}` : ""}</li>`).join("")}</ul>
      ${(o.refunds || []).length ? `<ul class="small" style="margin:0 0 0 18px">${o.refunds.map((r) => `<li>${nt(r.amt)} refunded · sent ${r.on} by ${METHOD[r.method] || "another way"} · ${h(r.reason)}</li>`).join("")}</ul>` : `<p class="small muted">No refunds so far.</p>`}
      <p class="small muted">Paid ${nt(o.amount)}, refunded ${nt(refundedOf(o))}, ${nt(left)} left to refund.</p>
      ${st.form.openRefund === o.id ? refundForm(o, left, endable) : (left > 0 || endable.length) ? `<div><button class="btn" data-act="openRefund" data-v="${o.id}">Refund or end membership</button></div>` : ""}</div>`;
  };
  return `<div class="stack"><div><h1>Admin desk</h1><p class="muted">Confirm bank transfers, review reports, and refund or end a membership. Online (ECPay) payments confirm themselves. Memberships start the moment a payment is confirmed.</p></div>
    ${st.form.adminMsg ? `<div class="notice ${st.form.adminOk ? "ok" : "bad"}" role="status">${h(st.form.adminMsg)}</div>` : ""}
    ${reviews.length ? `<section class="stack"><h2>Online payments to check (${reviews.length})</h2><p class="muted">ECPay told us something the site would not decide by itself (a different amount, a second payment, or a payment for a cancelled order). Check it in the ECPay merchant dashboard, then mark it checked.</p>${reviews.map((r) => `<div class="card flat"><p class="small muted">Order ${h(r.ref)}</p><p>${h(r.note)}</p><button class="btn" data-act="markChecked" data-v="${r.id}">Mark as checked</button></div>`).join("")}</section>` : ""}
    <section class="stack"><h2>Waiting for payment (${pending.length})</h2>${pending.length ? pending.map((o) => `<div class="card flat stack"><div class="row"><b class="num" style="font-size:20px">${o.ref}</b><b>${nt(o.amount)}</b><span class="badge ${o.method === "ecpay" ? "" : "apricot"}">${o.method === "ecpay" ? "Online (ECPay)" : "Bank transfer"}</span><span class="small muted">${o.type === "family" ? "Family" : "School, " + o.campusIds.length + " campus(es)"} · ${h(who(o.by))}</span></div>
      ${o.method === "ecpay" ? `<p class="small muted">Waiting for the buyer to pay on ECPay. It confirms itself when ECPay tells us the money arrived. Only confirm by hand if you have checked the ECPay dashboard and the notice never reached us.</p>` : ""}
      <div class="row"><div><label class="lab small" for="f-amt-${o.id}">Amount received (NT$)</label><input class="field" style="max-width:180px" id="f-amt-${o.id}" data-f="amt-${o.id}" inputmode="numeric" value="${h(val("amt-" + o.id, String(o.amount)))}"></div><button class="btn btn-primary" data-act="adminConfirm" data-v="${o.id}">Confirm payment</button></div></div>`).join("") : `<div class="card flat">Nothing is waiting.</div>`}</section>
    <section class="stack" id="recently-paid"><h2>Recently paid (${paidOrders.length})</h2><p class="muted">Open a paid order to refund it or end a membership early. The real site never sends money itself: you send it back first in ECPay's back office (or by bank transfer), then record it here.</p>
      ${st.form.refundMsg ? `<div class="notice ${st.form.refundOk ? "ok" : "bad"}" role="status">${h(st.form.refundMsg)}</div>` : ""}
      ${paidOrders.length ? paidOrders.map((o) => paidCard(o)).join("") : `<div class="card flat">No paid orders yet. Pay one as a family or school first (switch role at the top).</div>`}</section>
    <section class="stack"><h2>Reports to review (${reports.length})</h2>${reports.length ? reports.map((r) => { const nm = r.type === "educator" ? ((EDU.find((e) => e.id === r.targetId) || (st.myProfile ? { name: st.myProfile.name } : {})).name) : (st.jobs.find((j) => j.id === r.targetId) || {}).title; return `<div class="card flat stack"><p class="small muted">${r.type} · reason: <b>${h(r.reason)}</b></p><p class="bold">${h(nm)}</p>${r.details ? `<p>${h(r.details)}</p>` : ""}<p class="small muted">Reported by ${h(r.by)}. The reported person is never told who.</p><div class="row"><button class="btn btn-primary" data-act="suspend" data-v="${r.id}">${r.type === "educator" ? "Hide the profile (suspend)" : "Remove the job post"}</button><button class="btn" data-act="dismiss" data-v="${r.id}">Dismiss</button></div></div>`; }).join("") : `<div class="card flat">No reports waiting.</div>`}</section>
    ${sus.length ? `<section class="stack"><h2>Suspended right now</h2>${sus.map((id) => `<div class="card flat row" style="justify-content:space-between"><span><b>${h((EDU.find((e) => e.id === id) || { name: id }).name)}</b> <span class="small muted">educator profile</span></span><button class="btn" data-act="reinstate" data-v="${id}">Reinstate</button></div>`).join("")}</section>` : ""}
    <section class="stack"><h2>Memberships (${st.memberships.length})</h2>${st.memberships.length ? `<div class="scroll-x"><table class="tbl"><thead><tr><th>Holder</th><th>Kind</th><th>Starts</th><th>Ends</th></tr></thead><tbody>${st.memberships.map((x) => `<tr><td>${h(who(x.holder))}</td><td>${x.schoolId ? h(schoolById(x.schoolId).name) : "Family"}</td><td>${x.start}</td><td>${x.end}${x.endedEarly ? " (ended early)" : ""}</td></tr>`).join("")}</tbody></table></div>` : `<div class="card flat">None yet.</div>`}</section></div>`;
};
