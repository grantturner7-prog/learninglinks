const V = {};

/* ================= home ================= */
V.home = () => {
  const sample = EDU.find((e) => e.id === "e3");
  return `<section class="hero"><div>
    <div class="eyebrow">${T("Educators, schools and families in Taiwan", "連結臺灣的教師、學校與家庭")}</div>
    <h1 style="margin-top:10px">${T("Find the right educator. Or the right school.", "找到合適的教師，或合適的學校。")}</h1>
    <p class="lead">${T("A connection website. Educators are always free. Schools and families pay one flat membership and see the educators who match what they need, on a map.", "這是一個連結平台。教師永遠免費。學校與家庭只需支付一次固定會員費，就能在地圖上看到符合需求的教師。")}</p>
    <div class="row" style="margin-top:22px">
      <button class="btn btn-primary btn-lg" data-act="start" data-v="family">${T("Join as a family", "以家庭加入")}</button>
      <button class="btn btn-lg" data-act="start" data-v="school">${T("Join as a school", "以學校加入")}</button>
      <button class="btn btn-lg btn-ghost" data-act="start" data-v="educator">${T("I am an educator (free)", "我是教師（免費）")}</button>
    </div></div>
    <div class="card soft"><div class="row" style="justify-content:space-between"><span class="badge apricot">${T("Sample profile", "範例檔案")}</span><span class="tiny muted">${T("A made-up example", "虛構範例")}</span></div>
      <div class="edu" style="margin-top:12px"><div class="row"><div class="avatar" style="background:var(--lilac-100)">${h(sample.name[0])}</div><div><div class="nm">${h(sample.name)}</div><div class="where">${h(placeName(sample))}</div></div></div>
      <p>${h(sample.head)}</p><div class="tags">${sample.subjects.map((s) => `<span class="badge">${h(lab(SUBJECT[s]))}</span>`).join("")}</div>
      <p class="small muted">${T("Real profiles are only shown to paying members. Nobody sees an educator without a membership, and there are no public profile pages.", "真實檔案只會顯示給付費會員。沒有會員資格的人看不到任何教師，也沒有公開的個人頁面。")}</p></div></div></section>
  <section class="stack" style="margin-top:28px"><h2>${T("Who pays, and who does not", "誰付費，誰免費")}</h2>
    <div class="grid g3">
      <div class="card"><div class="eyebrow">${T("Educators", "教師")}</div><div class="price">${T("Free", "免費")}</div><p class="muted">${T("Create a profile, choose what you are open to, and decide who can see which side of it.", "建立檔案、選擇您開放的工作型態，並決定誰能看到哪一部分。")}</p></div>
      <div class="card"><div class="eyebrow">${T("Schools and centres", "學校與補習班")}</div><div class="price">${nt(PRICE_CAMPUS)}</div><p class="muted">${T("per campus, for 12 months. Three campuses cost NT$30,000: no discount, and each campus gets its own 12 months from the day it starts.", "每校區 12 個月。三個校區為 NT$30,000：沒有折扣，每個校區從開始日起各有完整 12 個月。")}</p></div>
      <div class="card"><div class="eyebrow">${T("Families", "家庭")}</div><div class="price">${nt(PRICE_FAMILY)}</div><p class="muted">${T("for 12 months. See educators who offer private tutoring, with their rates.", "12 個月。可查看提供私人家教的教師及其費用。")}</p></div>
    </div>
    <p class="muted">${T("VAT is included. One payment. A membership never renews by itself: we send a reminder before it ends.", "價格含稅。只需付款一次。會員資格不會自動續約，到期前我們會寄送提醒。")}</p></section>
  <section class="stack" style="margin-top:28px"><h2>${T("How it works", "運作方式")}</h2>
    <div class="grid g3"><div class="card flat"><h3>1. ${T("Educators create a profile", "教師建立檔案")}</h3><p class="muted">${T("One question at a time, with a live preview.", "一次一個問題，並即時預覽。")}</p></div>
    <div class="card flat"><h3>2. ${T("Members search on a map", "會員在地圖上搜尋")}</h3><p class="muted">${T("Educators appear by area, never by address.", "教師只顯示所在地區，不顯示地址。")}</p></div>
    <div class="card flat"><h3>3. ${T("You contact each other directly", "雙方直接聯絡")}</h3><p class="muted">${T("A member can ask to see an educator's contact details. We are not an employer or an agent.", "會員可以申請查看教師的聯絡方式。我們不是雇主，也不是仲介。")}</p></div></div></section>
  <section class="card" style="margin-top:28px;background:var(--lilac-50)"><div class="eyebrow">${T("Demo shortcuts", "示範捷徑")}</div><h3 style="margin:4px 0 10px">${T("Skip the sign-up and payment steps", "跳過註冊與付款步驟")}</h3>
    <div class="row"><button class="btn" data-act="preset" data-v="family_paid">${T("A family that has paid", "已付費的家庭")}</button><button class="btn" data-act="preset" data-v="school_paid">${T("A school with one campus paid", "已付一個校區的學校")}</button><button class="btn" data-act="preset" data-v="educator">${T("An educator with a published profile", "已發布檔案的教師")}</button><button class="btn" data-act="preset" data-v="admin">${T("The admin desk", "管理員後台")}</button></div></section>`;
};

/* ================= sign-up: one question at a time ================= */
V.signup = () => {
  const step = val("step", 1);
  const role = val("role", "");
  if (step === 1) return frame({ step, total: 3, say: T("Hi, I am Link. I will ask one thing at a time.", "嗨，我是 Link，我會一次問一個問題。"), q: T("Who are you?", "請問您是？"),
    body: `<div class="grid g3">${[["educator", T("An educator", "教師"), T("Free, always", "永遠免費")], ["school", T("A school or centre", "學校或補習班"), T("NT$10,000 per campus", "每校區 NT$10,000")], ["family", T("A family", "家庭"), T("NT$2,000 for 12 months", "12 個月 NT$2,000")]].map(([k, t, d]) => `<button class="tile" data-act="pick" data-k="role" data-v="${k}" ${sel("role", k)}><span class="t">${t}</span><span class="d">${d}</span></button>`).join("")}</div>`,
    next: "signup1", nextLabel: T("Continue", "繼續"), nextDisabled: !role });
  if (step === 2) return frame({ step, total: 3, say: T("Nice to meet you. A first name is plenty.", "很高興認識您，名字就夠了。"), q: T("What should we call you?", "我們該怎麼稱呼您？"),
    body: `<label class="lab" for="f-name">${T("Your name", "您的名字")}</label><input class="field" id="f-name" data-f="name" value="${h(val("name"))}" autocomplete="off" placeholder="${T("e.g. Mei", "例如：小美")}"><p class="hint" style="margin-top:8px">${T("In this demo nothing is sent anywhere. In the real site you also give an email and password, and verify your email.", "此示範不會傳送任何資料。真實網站還需要電子郵件與密碼，並驗證電子郵件。")}</p>`,
    back: "signupBack", next: "signup2", nextLabel: T("Continue", "繼續"), nextDisabled: val("name").trim().length < 1 });
  return frame({ step, total: 3, say: T("One important thing before we start. It takes ten seconds.", "開始前有一件重要的事，只需十秒。"), q: T("Please read this", "請先閱讀"),
    body: `${noticeBox()}<div style="margin-top:14px">${ackBox("ack")}</div>`, back: "signupBack", next: "signup3", nextLabel: T("Create my account", "建立我的帳號"), nextDisabled: !val("ack") });
};

/* ================= dashboards ================= */
V.dashboard = () => {
  const m = me();
  if (!m) return V.home();
  if (m.type === "family") {
    const mem = st.memberships.find((x) => x.holder === m.id && x.kind === "family");
    const pend = myOrders().find((o) => o.status === "pending");
    return `<div class="stack"><h1>${T("Hello", "您好")}, ${h(m.name)}</h1><p class="muted">${T("Family account", "家庭帳號")}</p>
      ${mem && mem.end > TODAY ? `<div class="card soft"><span class="badge">${T("Active", "有效")}</span><h2 style="margin-top:8px">${T("Your membership runs until", "您的會員資格有效至")} ${fmtDate(mem.end)}</h2><p class="muted" style="margin-top:6px">${T("It never renews by itself. We will remind you before it ends.", "不會自動續約，到期前會提醒您。")}</p><div class="row" style="margin-top:16px"><button class="btn btn-primary btn-lg" data-act="nav" data-v="educators">${T("Find educators", "尋找教師")}</button></div></div>`
      : pend ? `<div class="card soft"><span class="badge apricot">${T("Waiting for payment", "等待付款")}</span><h2 style="margin-top:8px">${T("Your order is ready", "您的訂單已建立")}: ${nt(pend.amount)}</h2><div class="row" style="margin-top:16px"><button class="btn btn-primary btn-lg" data-act="order" data-v="${pend.id}">${T("Open my order", "開啟我的訂單")}</button></div></div>`
      : `<div class="card soft"><h2>${T("Join for 12 months", "加入 12 個月")}</h2><div class="price" style="margin:6px 0">${nt(PRICE_FAMILY)} <span class="small muted">${T("VAT included", "含稅")}</span></div><p class="muted">${T("See educators who offer private tutoring, on a map and a list, and ask for their contact details.", "在地圖與清單上查看提供私人家教的教師，並申請查看他們的聯絡方式。")}</p><div class="row" style="margin-top:16px"><button class="btn btn-primary btn-lg" data-act="join" data-v="family">${T("Join as a family", "以家庭加入")}</button></div></div>`}
      ${myOrders().some((o) => o.status === "paid") ? `<div class="card flat"><h2>${T("Your orders", "您的訂單")}</h2><ul class="stack" style="list-style:none;padding:0;margin-top:10px">${myOrders().filter((o) => o.status === "paid").map((o) => `<li class="row"><span class="grow"><b class="num">${o.ref}</b> · ${nt(o.amount)}</span><span class="badge">${(o.refunds || []).reduce((a, r) => a + r.amt, 0) >= o.amount ? T("Refunded", "已退款") : T("Paid", "已付款")}</span><button class="btn" data-act="order" data-v="${o.id}">${T("View order", "查看訂單")}</button></li>`).join("")}</ul></div>` : ""}
      </div>`;
  }
  if (m.type === "school") {
    const mine = ownedCampuses(m.id);
    const unpaid = mine.filter((s) => !campusActive(m.id, s.id));
    return `<div class="stack"><h1>${T("Hello", "您好")}, ${h(m.name)}</h1><p class="muted">${T("School account", "學校帳號")}</p>
      ${mine.length === 0 ? `<div class="card soft"><h2>${T("Start by finding your school", "先找到您的學校")}</h2><p class="muted" style="margin-top:6px">${T("Claim each campus you want to pay for. In the real site an administrator checks every claim.", "認領您要付費的每個校區。在真實網站中，每個認領都會由管理員審核。")}</p><div class="row" style="margin-top:16px"><button class="btn btn-primary btn-lg" data-act="nav" data-v="campuses">${T("Find my school", "尋找我的學校")}</button></div></div>`
      : `<div class="card soft"><h2>${T("Your campuses", "您的校區")}</h2><ul class="stack" style="list-style:none;padding:0;margin-top:12px">${mine.map((s) => { const mem = st.memberships.find((x) => x.holder === m.id && x.schoolId === s.id && x.end > TODAY); return `<li class="row" style="justify-content:space-between;border-bottom:1.5px solid var(--line-2);padding-bottom:10px"><span><b>${h(s.name)}</b><br><span class="small muted">${h(lab(KIND[s.kind]))} · ${h(placeName(s))}</span></span>${mem ? `<span class="badge">${T("Active until", "有效至")} ${fmtDate(mem.end)}</span>` : `<span class="badge apricot">${T("Not paid yet", "尚未付款")}</span>`}</li>`; }).join("")}</ul>
        <p class="small muted" style="margin-top:10px">${nt(PRICE_CAMPUS)} ${T("per campus. Each campus has its own 12 months.", "每校區。每個校區各有 12 個月。")}</p>
        <div class="row" style="margin-top:14px">${unpaid.length ? `<button class="btn btn-primary btn-lg" data-act="join" data-v="school">${T("Pay for campuses", "支付校區費用")}</button>` : ""}<button class="btn" data-act="nav" data-v="campuses">${T("Add another campus", "新增校區")}</button>${paidCampusIds(m.id).length ? `<button class="btn" data-act="nav" data-v="educators">${T("Find educators", "尋找教師")}</button><button class="btn" data-act="nav" data-v="jobnew">${T("Post a job", "刊登職缺")}</button><button class="btn" data-act="nav" data-v="myjobs">${T("My job posts", "我的職缺")}</button>` : ""}</div></div>`}
      ${myOrders().filter((o) => o.status === "pending").map((o) => `<div class="card"><span class="badge apricot">${T("Waiting for payment", "等待付款")}</span> ${nt(o.amount)} <button class="link-btn" data-act="order" data-v="${o.id}">${T("Open my order", "開啟我的訂單")}</button></div>`).join("")}
      </div>`;
  }
  if (m.type === "educator") {
    const p = st.myProfile;
    const asks = st.reveals.filter((r) => r.eduId === "e-me");
    return `<div class="stack"><h1>${T("Hello", "您好")}, ${h(m.name)}</h1><p class="muted">${T("Educator account. Free, always.", "教師帳號。永遠免費。")}</p>
      <div class="card soft"><h2>${p && p.published ? T("Your profile is published", "您的檔案已發布") : p ? T("Your profile is a draft", "您的檔案是草稿") : T("Create your profile", "建立您的檔案")}</h2>
        <p class="muted" style="margin-top:6px">${p && p.published ? T("Paying members who match what you are open to can see it, by area only. You can hide it any time.", "符合您開放條件的付費會員可看到它，僅顯示地區。您隨時可以隱藏。") : T("It takes about two minutes, one question at a time, with a live preview.", "約需兩分鐘，一次一個問題，並即時預覽。")}</p>
        <div class="row" style="margin-top:16px"><button class="btn btn-primary btn-lg" data-act="nav" data-v="profile">${p ? T("Edit my profile", "編輯我的檔案") : T("Start", "開始")}</button>${p && p.published ? `<button class="btn" data-act="hideProfile">${T("Hide my profile", "隱藏我的檔案")}</button>` : ""}</div></div>
      <div class="card"><h3>${T("Job posts from schools", "學校的職缺")}</h3><p class="muted">${T("Full-time and part-time jobs, visible only to signed-in educators who have a profile.", "全職與兼職職缺，只有已登入且有檔案的教師看得到。")}</p><div class="row" style="margin-top:12px"><button class="btn" data-act="nav" data-v="jobs">${T("See the job map", "查看職缺地圖")}</button></div></div>
      <div class="card"><h3>${T("Who asked about you", "誰查看了您的聯絡方式")}</h3>${asks.length ? `<ul>${asks.map((r) => `<li>${r.byType === "school" ? `<b>${h(r.byName)}</b> ${T("(a school)", "（學校）")}` : T("A family (anonymous)", "一個家庭（匿名）")} · ${fmtDate(r.day)}</li>`).join("")}</ul>` : `<p class="muted">${T("Nobody yet. When a paying member opens your contact details you will see it here: schools by name, families anonymously.", "目前還沒有。當付費會員查看您的聯絡方式時會顯示在這裡：學校顯示名稱，家庭匿名。")}</p>`}</div>
      </div>`;
  }
  return `<div class="stack"><h1>${T("Admin desk", "管理員後台")}</h1><button class="btn btn-primary" data-act="nav" data-v="admin">${T("Open", "開啟")}</button></div>`;
};

/* ================= checkout (family and school share one flow) ================= */
V.join = () => {
  const type = st.args.type;
  const step = val("step", 1);
  const campuses = type === "school" ? ownedCampuses(pid()).filter((s) => !campusActive(pid(), s.id)) : [];
  if (type === "school" && st.form.picked === undefined) st.form.picked = campuses.map((s) => s.id);
  const picked = type === "school" ? st.form.picked.filter((id) => campuses.some((s) => s.id === id)) : [];
  const total = type === "family" ? PRICE_FAMILY : PRICE_CAMPUS * picked.length;
  const method = val("method", "ecpay");
  const receipt = type === "family"
    ? `<div class="eyebrow">${T("Your membership", "您的會員資格")}</div><ul class="ticks"><li>${nt(PRICE_FAMILY)} ${T("for 12 months, VAT included", "12 個月，含稅")}</li><li>${T("Your 12 months start when your payment is confirmed: straight away for an online payment, after an administrator checks a bank transfer.", "付款確認後 12 個月開始：線上付款立即生效，銀行轉帳則在管理員核對後生效。")}</li><li>${T("It never renews by itself. We send a reminder before it ends.", "不會自動續約，到期前會提醒您。")}</li></ul><div class="total"><span>${T("Total, VAT included", "合計（含稅）")}</span><b>${nt(PRICE_FAMILY)}</b></div>`
    : `<div class="eyebrow">${T("Your order", "您的訂單")}</div><ul class="ticks">${picked.map((id) => `<li>${h(schoolById(id).name)}: ${nt(PRICE_CAMPUS)}</li>`).join("") || `<li class="muted">${T("No campus chosen yet", "尚未選擇校區")}</li>`}<li>${T("No discount for extra campuses. Each campus gets its own 12 months from the day it starts.", "額外校區沒有折扣。每個校區從開始日起各有 12 個月。")}</li></ul><div class="total"><span>${T("Total, VAT included", "合計（含稅）")}</span><b>${nt(total)}</b></div>`;
  const exit = { act: "nav", v: "dashboard", label: "← " + T("Not now, back to my dashboard", "先不要，回到我的儀表板") };
  if (step === 1) {
    if (type === "family") return frame({ step, total: 3, aside: receipt, exit, say: T("Hi, I am Link. Here is exactly how this works, with no small print.", "嗨，我是 Link。以下是運作方式，沒有任何小字。"), q: T("Here is how it works", "運作方式如下"),
      body: `<ul class="ticks" style="font-size:17px"><li>${T("You pay once: NT$2,000 for 12 months, VAT included.", "一次付款：12 個月 NT$2,000，含稅。")}</li><li>${T("You see educators who offer private tutoring, with their rates, on a map and a list.", "您可以在地圖與清單上看到提供私人家教的教師與費用。")}</li><li>${T("You can ask to see an educator's contact details, up to 100 educators a day.", "您可以申請查看教師的聯絡方式，每天最多 100 位。")}</li><li>${T("It never renews by itself.", "不會自動續約。")}</li></ul>`, next: "joinNext", nextLabel: T("Continue", "繼續") });
    return frame({ step, total: 3, aside: receipt, exit, say: T("Every campus has its own 12 months, so you can add campuses whenever you like.", "每個校區各有 12 個月，您隨時可以新增校區。"), q: T("Which campuses are you paying for?", "您要為哪些校區付費？"),
      body: campuses.length ? `<div class="grid g2">${campuses.map((s) => `<button class="tile" data-act="togglePick" data-v="${s.id}" ${selm("picked", s.id)}><span class="t">${h(s.name)}</span><span class="d">${h(lab(KIND[s.kind]))} · ${h(placeName(s))} · ${nt(PRICE_CAMPUS)}</span></button>`).join("")}</div>` : `<div class="notice">${T("You have no campuses to pay for. Claim a campus first.", "您沒有需要付費的校區，請先認領校區。")} <button class="link-btn" data-act="nav" data-v="campuses">${T("Find my school", "尋找我的學校")}</button></div>`,
      next: "joinNext", nextLabel: T("Continue", "繼續"), nextDisabled: picked.length === 0 });
  }
  if (step === 2) {
    const inv = val("inv", "personal");
    return frame({ step, total: 3, aside: receipt, exit, say: T("Some people like an invoice with a company 統一編號. Totally optional.", "有些人需要附統一編號的發票，完全可選。"), q: T("Do you need an invoice?", "您需要發票嗎？"),
      body: `<div class="grid g2"><button class="tile" data-act="pick" data-k="inv" data-v="personal" ${sel("inv", "personal")}><span class="t">${T("A personal invoice is fine", "個人發票即可")}</span></button><button class="tile" data-act="pick" data-k="inv" data-v="company" ${sel("inv", "company")}><span class="t">${T("I need a company invoice", "我需要公司發票")}</span></button></div>${inv === "company" ? `<div class="grid g2" style="margin-top:14px"><div><label class="lab" for="f-tax">統一編號 (8 ${T("digits", "位數")})</label><input class="field" id="f-tax" data-f="tax" inputmode="numeric" maxlength="8" value="${h(val("tax"))}"></div><div><label class="lab" for="f-title">${T("Company name", "公司名稱")}</label><input class="field" id="f-title" data-f="title" value="${h(val("title"))}"></div></div>${val("tax") && !/^\d{8}$/.test(val("tax")) ? `<p class="err" style="margin-top:8px">${T("A 統一編號 has 8 digits.", "統一編號為 8 位數字。")}</p>` : ""}` : ""}<p class="hint" style="margin-top:12px">${T("We never ask for an ID number.", "我們不會要求您提供身分證字號。")}</p>`,
      back: "joinBack", next: "joinNext", nextLabel: T("Continue", "繼續"), nextDisabled: inv === "company" && !/^\d{8}$/.test(val("tax")) });
  }
  const summary = type === "family"
    ? (method === "ecpay" ? T("You are ordering one family membership for NT$2,000, VAT included. You will pay on ECPay's secure page and nothing is charged until you do.", "您正在訂購一份家庭會員，NT$2,000（含稅）。付款會在綠界的安全頁面進行，您付款前不會有任何扣款。") : T("You are ordering one family membership for NT$2,000, VAT included. You will get a reference code to put in your bank transfer.", "您正在訂購一份家庭會員，NT$2,000（含稅）。您會取得一組參考碼，請填寫在銀行轉帳備註。"))
    : (method === "ecpay" ? T(`You are ordering ${picked.length} campus(es) for ${nt(total)}, VAT included. You will pay on ECPay's secure page and nothing is charged until you do.`, `您正在訂購 ${picked.length} 間校區，合計 ${nt(total)}（含稅）。付款會在綠界的安全頁面進行，您付款前不會有任何扣款。`) : T(`You are ordering ${picked.length} campus(es) for ${nt(total)}, VAT included. You will get a reference code to put in your bank transfer.`, `您正在訂購 ${picked.length} 間校區，合計 ${nt(total)}（含稅）。您會取得一組參考碼，請填寫在銀行轉帳備註。`));
  return frame({ step, total: 3, aside: receipt, exit, say: method === "ecpay" ? T("Nearly done. I will make your order, then you choose card, ATM or store code and pay on ECPay's secure page.", "快完成了！我會先建立您的訂單，接著您選擇信用卡、ATM 或超商代碼，並在綠界的安全頁面付款。") : T("Nearly done. I will make your order and show you where to send the transfer.", "快完成了！我會建立您的訂單，並告訴您要轉帳到哪裡。"), q: T("Ready to place your order?", "準備好送出訂單了嗎？"),
    body: `<label class="lab">${T("How would you like to pay?", "要用哪種方式付款？")}</label><div class="grid g2"><button class="tile" data-act="pick" data-k="method" data-v="ecpay" ${sel("method", "ecpay")}><span class="t">${T("Online with ECPay", "線上付款（綠界 ECPay）")}</span><span class="d">${T("Card, ATM virtual account or convenience-store code. Your 12 months start as soon as the payment arrives.", "信用卡、ATM 虛擬帳號或超商代碼，款項到帳後會員資格立即開始。")}</span></button><button class="tile" data-act="pick" data-k="method" data-v="bank" ${sel("method", "bank")}><span class="t">${T("Bank transfer", "銀行轉帳")}</span><span class="d">${T("We show you the account and a reference code. We confirm the transfer by hand, which takes a few working days.", "我們會提供帳號與參考碼，並由人工確認轉帳，約需數個工作天。")}</span></button></div><p style="margin:16px 0">${summary}</p>${ackBox("ack")}<p class="hint" style="margin-top:10px">${T("We never ask for your ID number or your child's details.", "我們不會要求您提供身分證字號或孩子的資料。")}</p>`,
    back: "joinBack", next: "placeOrder", nextLabel: T("Place my order", "送出訂單"), nextDisabled: !val("ack") });
};

/* ================= order page ================= */
V.order = () => {
  const o = st.orders.find((x) => x.id === st.args.id);
  if (!o || o.by !== pid()) return `<div class="card">${T("Order not found.", "找不到訂單。")} <button class="link-btn" data-act="nav" data-v="dashboard">${T("Back", "返回")}</button></div>`;
  const label = o.type === "family" ? T("Family membership, 12 months", "家庭會員 12 個月") : T(`School membership, 12 months × ${o.campusIds.length} campus(es)`, `學校會員 12 個月 × ${o.campusIds.length} 間校區`);
  const head = `<div class="stack"><button class="link-btn" data-act="nav" data-v="dashboard">← ${T("Back to my dashboard", "回到我的儀表板")}</button><h1>${T("Your order", "您的訂單")}</h1>
    <div class="row"><span class="badge ${o.status === "paid" ? "" : "apricot"}">${o.status === "paid" ? ((o.refunds || []).reduce((a, r) => a + r.amt, 0) >= o.amount ? T("Refunded", "已退款") : T("Paid", "已付款")) : o.status === "cancelled" ? T("Cancelled", "已取消") : T("Waiting for your payment", "等待您付款")}</span><span class="muted">${label}</span></div>`;
  const tail = `<div class="card flat"><h3>${T("Invoice details", "發票資料")}</h3><p>${o.invoice && o.invoice.tax ? `${h(o.invoice.title || "")} · 統一編號 ${h(o.invoice.tax)}` : T("Personal invoice", "個人發票")}</p></div>${o.campusIds.length ? `<div class="card flat"><h3>${T("Campuses", "校區")}</h3><ul>${o.campusIds.map((id) => `<li>${h(schoolById(id).name)}</li>`).join("")}</ul></div>` : ""}`;
  if (o.status === "paid") {
    const ms = st.memberships.filter((m) => m.orderId === o.id);
    const refundedAmt = (o.refunds || []).reduce((a, r) => a + r.amt, 0); const endedEarly = ms.find((m) => m.endedEarly);
    if (refundedAmt > 0 || endedEarly) return `${head}<div class="card soft stack">${refundedAmt > 0 ? `<p>${T(`A refund of ${nt(refundedAmt)} has been recorded for this order. How long it takes to appear on your card or bank account depends on your card issuer or bank.`, `此訂單已記錄退款 ${nt(refundedAmt)}。款項多久會出現在您的信用卡或銀行帳戶，視發卡銀行或您的銀行而定。`)}</p>` : ""}${endedEarly ? `<p>${T(`Your membership for this order ended on ${fmtDate(endedEarly.endedEarly.on)}.`, `此訂單的會員資格已於 ${fmtDate(endedEarly.endedEarly.on)} 結束。`)}</p>` : `<p>${T("Thank you. Your membership continues.", "謝謝您，您的會員資格繼續有效。")}</p>`}</div>${tail}</div>`;
    return `${head}<div class="card soft"><h2>${T("Thank you. Your membership has started.", "謝謝您，您的會員資格已開始。")}</h2><p class="muted" style="margin-top:6px">${T("Paid", "付款日")} ${fmtDate(o.paidOn)} · ${nt(o.amount)} ${T("VAT included", "含稅")} · ${T("It never renews by itself.", "不會自動續約。")}</p><ul style="margin:10px 0 0">${ms.map((m) => `<li>${m.schoolId ? h(schoolById(m.schoolId).name) + ": " : ""}${fmtDate(m.start)} → ${fmtDate(m.end)}</li>`).join("")}</ul><div class="row" style="margin-top:16px"><button class="btn btn-primary btn-lg" data-act="nav" data-v="educators">${T("Find educators", "尋找教師")}</button></div></div>${tail}</div>`;
  }
  if (o.status === "cancelled") return `${head}<div class="card">${T("This order was cancelled.", "此訂單已取消。")}</div>${tail}</div>`;
  const cancel = `<div class="row"><p class="hint grow">${T("Changed your mind? Cancelling is free. Only cancel if you have not paid yet.", "改變主意了嗎？取消是免費的。若您尚未付款才能取消。")}</p><button class="btn" data-act="cancelOrder" data-v="${o.id}">${T("Cancel this order", "取消此訂單")}</button></div>`;
  if (o.method === "ecpay") {
    const m = (k, en, zh, hEn, hZh, i) => `<button class="${i === 0 ? "btn btn-primary" : "btn"} btn-lg" style="flex-direction:column;align-items:flex-start;border-radius:24px;text-align:left" data-act="toEcpay" data-v="${o.id}" data-m="${k}"><span>${T(en, zh)}</span><span class="small" style="font-weight:600;opacity:.8">${T(hEn, hZh)}</span></button>`;
    return `${head}<div class="card soft"><div class="eyebrow">${T("Pay online", "線上付款")}</div><div class="price">${nt(o.amount)} <span class="small muted">${T("VAT included", "含稅")}</span></div>
      <p style="margin-top:10px;max-width:640px">${T("You will go to ECPay's secure page and pay by card, ATM virtual account or at a convenience store. We never see or keep your card number.", "按下後會前往綠界 ECPay 的安全付款頁，可用信用卡、ATM 虛擬帳號或超商代碼付款。我們不會看到也不會保存您的卡號。")}</p>
      <p class="bold" style="margin:14px 0 8px">${T("Choose how to pay:", "請選擇付款方式：")}</p><div class="grid g3">${m("Credit", "Pay by card", "信用卡付款", "Visa, MasterCard or JCB", "Visa、MasterCard 或 JCB", 0)}${m("ATM", "ATM virtual account", "ATM 虛擬帳號", "Pay later by transfer or at an ATM", "取得帳號後，稍後轉帳或至 ATM 繳費", 1)}${m("CVS", "Convenience-store code", "超商代碼繳費", "Pay later at 7-ELEVEN, FamilyMart, Hi-Life or OK mart", "取得代碼後，稍後至超商繳費", 2)}</div>
      <p class="hint" style="margin-top:12px">${T("You can come back to this page and pay later. The order stays here until you pay or cancel it.", "您可以稍後回到這個頁面再付款。訂單會保留到您付款或取消為止。")} ${T("Your order reference (quote it if you write to us):", "您的訂單編號（來信時請提供）：")} <b class="num">${o.ref}</b></p></div>
      ${o.info ? `<div class="card flat"><h3>${o.info.kind === "ATM" ? T("Your ATM transfer details", "您的 ATM 轉帳資料") : T("Your convenience-store payment code", "您的超商繳費代碼")}</h3><p style="margin-top:6px">${o.info.kind === "ATM" ? T(`Bank code ${o.info.bank}, virtual account ${o.info.account}. Please pay before ${fmtDate(o.info.expire)}. Your membership starts once ECPay tells us the money arrived.`, `銀行代碼 ${o.info.bank}，虛擬帳號 ${o.info.account}，請於 ${fmtDate(o.info.expire)} 前完成繳費。綠界通知我們款項到帳後，會員資格即開始。`) : T(`Payment code ${o.info.code}. Please pay at the store before ${fmtDate(o.info.expire)}. Your membership starts once ECPay tells us the money arrived.`, `繳費代碼 ${o.info.code}，請於 ${fmtDate(o.info.expire)} 前至超商繳費。綠界通知我們款項到帳後，會員資格即開始。`)}</p>
        <div class="notice demo-only" style="margin-top:12px"><b>${T("Demo only:", "僅限示範：")}</b> ${T("pretend you have paid. In the real site ECPay sends our server a signed message when the money arrives, and nobody presses anything.", "假裝您已付款。在真實網站中，款項到帳時綠界會向我們的伺服器傳送簽章通知，無需任何人按鈕。")}<div style="margin-top:8px"><button class="btn" data-act="simulateNotice" data-v="${o.id}">${T("Pretend ECPay confirmed my payment", "假裝綠界已確認我的付款")}</button></div></div></div>` : ""}${tail}${cancel}</div>`;
  }
  return `${head}<div class="card soft"><div class="eyebrow">${T("Pay by bank transfer", "銀行轉帳付款")}</div><div class="price">${nt(o.amount)} <span class="small muted">${T("VAT included", "含稅")}</span></div>
    <p class="muted" style="margin-top:8px">${T("Send exactly this amount and write the reference code in the transfer note, so we can find your payment.", "請轉入正確金額，並將參考碼填寫在匯款備註，方便我們對帳。")}</p>
    <p class="num" style="font-size:clamp(30px,6vw,46px);font-weight:800;letter-spacing:.06em;margin:10px 0" data-ref>${o.ref}</p>
    <div class="notice">${T("The bank account details are not set yet. In the real site they appear here, from the server's private settings.", "尚未設定銀行帳號。在真實網站中，帳號會從伺服器的私人設定顯示在這裡。")}</div>
    <p class="small muted" style="margin-top:10px">${T("An administrator checks that the correct amount arrived and then confirms your order by hand, which starts your membership.", "管理員會核對款項金額無誤後，以人工確認您的訂單，會員資格才會開始。")}</p>
    <div class="notice demo-only" style="margin-top:12px"><b>${T("Demo only:", "僅限示範：")}</b> ${T("switch to the Admin role at the top to confirm this transfer.", "請從上方切換到管理員角色來確認此轉帳。")} <button class="link-btn" data-act="adminAsk" data-v="${o.id}">${T("Take me there", "帶我過去")}</button></div></div>${tail}${cancel}</div>`;
};

/* ================= the simulated ECPay page (the real one is ECPay's own, on ECPay's server) ================= */
V.ecpay = () => {
  const o = st.orders.find((x) => x.id === st.args.id);
  if (!o) return V.home();
  const m = st.args.m;
  const names = { Credit: T("Credit card", "信用卡"), ATM: T("ATM virtual account", "ATM 虛擬帳號"), CVS: T("Convenience-store code", "超商代碼") };
  return `<div class="stack"><div class="notice demo-only"><b>${T("Demo only.", "僅限示範。")}</b> ${T("This page imitates ECPay's payment page. In the real site your browser goes to ECPay's own secure page on ECPay's server. We never see card numbers, and no money moves here.", "此頁面模擬綠界的付款頁。在真實網站中，您的瀏覽器會前往綠界伺服器上的安全付款頁。我們不會看到卡號，這裡也不會有任何款項移動。")}</div>
  <div class="ecp"><div class="hd"><b>ECPay 綠界</b><span>${T("Secure payment (demo)", "安全付款（示範）")}</span></div><div class="bd">
    <dl><dt>${T("Order number", "訂單編號")}</dt><dd>${o.ref.replace(/-/g, "")}01</dd><dt>${T("Merchant", "特店名稱")}</dt><dd>LearningLinks</dd><dt>${T("Item", "商品")}</dt><dd>${o.type === "family" ? "LearningLinks family membership 12 months" : `LearningLinks school membership 12 months x ${o.campusIds.length} campus`}</dd><dt>${T("Amount", "應付金額")}</dt><dd class="amt">NT$${o.amount.toLocaleString("en-US")}</dd></dl>
    <div class="methods">${["Credit", "ATM", "CVS"].map((k) => `<span class="${k === m ? "on" : ""}">${names[k]}</span>`).join("")}</div>
    ${m === "Credit" ? `<div><label for="cc" style="font-size:14px;color:#555">${T("Card number (pretend: type anything)", "信用卡號（示範：任意輸入）")}</label><input id="cc" inputmode="numeric" placeholder="0000-0000-0000-0000"></div><button class="pay" data-act="ecpayPay" data-v="${o.id}">${T("Pay now", "立即付款")}</button>`
    : `<p style="font-size:14px;color:#555">${m === "ATM" ? T("ECPay will give you a virtual account number. Pay it later by transfer or at an ATM.", "綠界會提供一組虛擬帳號，您可稍後轉帳或至 ATM 繳費。") : T("ECPay will give you a payment code. Pay it later at a convenience store.", "綠界會提供一組繳費代碼，您可稍後至超商繳費。")}</p><button class="pay" data-act="ecpayNumber" data-v="${o.id}" data-m="${m}">${m === "ATM" ? T("Get my account number", "取得我的帳號") : T("Get my payment code", "取得我的繳費代碼")}</button>`}
    <button class="link-btn" style="color:#2a6fb0" data-act="order" data-v="${o.id}">${T("Back to the shop", "返回商店")}</button></div></div></div>`;
};
