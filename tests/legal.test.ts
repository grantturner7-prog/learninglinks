import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LAWYER_PLACEHOLDER_SOURCE, LEGAL_DOCS, LEGAL_DRAFT_DATE, LEGAL_DRAFT_VERSION } from "@/components/legal/constants";
import { plainText, resolveLegalDoc, stripTags, tokenize, type LegalDocMessages, type NoticeText, type ResolvedLegalDoc, type WaiverMessages } from "@/components/legal/doc";
import { WAIVER_OPTIONAL_ITEMS, WAIVER_REQUIRED_ITEMS } from "@/lib/consent/waiver-items";

const LOCALES = ["en-TW", "zh-TW"] as const;
type Locale = (typeof LOCALES)[number];
const DOCS = ["terms", "privacy", "waiver"] as const;

const read = (loc: string, ns: string) => JSON.parse(readFileSync(join(process.cwd(), "messages", loc, `${ns}.json`), "utf-8")) as Record<string, unknown>;

interface LegalFile {
  draft: string;
  terms: string;
  privacy: string;
  waiver: string;
  ui: Record<string, string>;
  docs: Record<(typeof DOCS)[number], LegalDocMessages>;
}
const legal = (loc: Locale) => read(loc, "legal") as unknown as LegalFile;
const notice = (loc: Locale) => read(loc, "notice") as unknown as NoticeText;
const waiver = (loc: Locale) => (read(loc, "educator") as unknown as { waiver: WaiverMessages }).waiver;

const resolved = (loc: Locale, doc: (typeof DOCS)[number]): ResolvedLegalDoc =>
  resolveLegalDoc(doc, legal(loc).docs[doc], { notice: notice(loc), waiver: doc === "waiver" ? waiver(loc) : undefined });

/** Every string of the stored (unresolved) document, so we test the copy as written. */
const rawText = (loc: Locale, doc: (typeof DOCS)[number]): string[] => {
  const d = legal(loc).docs[doc];
  return [d.intro, ...d.sections.flatMap((s) => [s.title, ...s.paragraphs, ...(s.bullets ?? [])])];
};

const OPEN = { "en-TW": "[For lawyer:", "zh-TW": "[請律師確認：" } as const;
const placeholderRe = () => new RegExp(LAWYER_PLACEHOLDER_SOURCE, "g");
const placeholders = (loc: Locale, doc: (typeof DOCS)[number]) => rawText(loc, doc).flatMap((t) => t.match(placeholderRe()) ?? []);

describe("legal documents: structure", () => {
  for (const doc of DOCS) {
    it(`${doc}: same section ids, order and sizes in English and Traditional Chinese`, () => {
      const en = legal("en-TW").docs[doc].sections;
      const zh = legal("zh-TW").docs[doc].sections;
      expect(zh.map((s) => s.id)).toEqual(en.map((s) => s.id));
      expect(en.length).toBeGreaterThanOrEqual(10);
      for (let i = 0; i < en.length; i++) {
        expect(zh[i]!.paragraphs.length, `paragraphs of ${doc}/${en[i]!.id}`).toBe(en[i]!.paragraphs.length);
        expect((zh[i]!.bullets ?? []).length, `bullets of ${doc}/${en[i]!.id}`).toBe((en[i]!.bullets ?? []).length);
      }
    });

    for (const loc of LOCALES) {
      it(`${doc} (${loc}): ids are unique anchors and the first section explains the notice and the last is the contact block`, () => {
        const ids = legal(loc).docs[doc].sections.map((s) => s.id);
        expect(new Set(ids).size).toBe(ids.length);
        for (const id of ids) expect(id).toMatch(/^[a-z][a-z0-9-]*$/);
        expect(ids[0]).toBe("notice");
        expect(ids.at(-1)).toBe("contact");
      });

      it(`${doc} (${loc}): no section, paragraph or bullet is empty`, () => {
        const d = legal(loc).docs[doc];
        expect(d.intro.trim().length).toBeGreaterThan(40);
        for (const s of d.sections) {
          expect(s.title.trim().length, `${s.id} title`).toBeGreaterThan(0);
          expect(s.paragraphs.length + (s.bullets?.length ?? 0), `${s.id} has content`).toBeGreaterThan(0);
          for (const t of [...s.paragraphs, ...(s.bullets ?? [])]) expect(t.trim().length, `${s.id} text`).toBeGreaterThan(3);
        }
        // The same holds for what the page actually shows after the waiver embeds are added.
        for (const s of resolved(loc, doc).sections) expect(s.paragraphs.length + (s.bullets?.length ?? 0)).toBeGreaterThan(0);
      });
    }
  }

  it("document titles and page labels exist in both languages", () => {
    for (const loc of LOCALES) {
      const f = legal(loc);
      for (const k of ["draft", "terms", "privacy", "waiver"] as const) expect(f[k].trim()).not.toBe("");
      for (const k of ["version", "lastUpdated", "contents", "legend", "contactEmail", "contactPending", "backToTop"]) expect(f.ui[k]?.trim(), `ui.${k}`).toBeTruthy();
      expect(f.ui.version).toContain("{n}");
    }
  });

  it("the page covers exactly the three documents, and the draft date and version are set", () => {
    expect(Object.values(LEGAL_DOCS).sort()).toEqual([...DOCS].sort());
    expect(LEGAL_DRAFT_DATE).toBe("2026-11-18");
    expect(LEGAL_DRAFT_VERSION).toBe(1);
  });
});

describe("legal documents: the compliance notice", () => {
  for (const loc of LOCALES) {
    for (const doc of DOCS) {
      it(`${doc} (${loc}) shows the canonical notice from notice.json, word for word`, () => {
        const n = notice(loc);
        const r = resolved(loc, doc);
        expect(r.notice.lead).toBe(n.lead);
        expect(r.notice.full).toBe(n.full);
        const all = plainText(r).join("\n");
        expect(all).toContain(n.lead);
        expect(all).toContain(n.full);
      });
    }
    it(`the tutoring work-permit line is added to the Terms and the waiver (${loc})`, () => {
      const n = notice(loc);
      expect(plainText(resolved(loc, "terms"))).toContain(n.tutoringWork);
      expect(plainText(resolved(loc, "waiver"))).toContain(n.tutoringWork);
    });
  }

  it("the notice explanation in each document keeps the three promises in plain words", () => {
    const en = (doc: (typeof DOCS)[number]) => legal("en-TW").docs[doc].sections[0]!;
    const zh = (doc: (typeof DOCS)[number]) => legal("zh-TW").docs[doc].sections[0]!;
    for (const doc of DOCS) {
      const e = [...en(doc).paragraphs, ...(en(doc).bullets ?? [])].join(" ");
      const z = [...zh(doc).paragraphs, ...(zh(doc).bullets ?? [])].join(" ");
      expect(e).toMatch(/background check/i);
      expect(z).toContain("背景調查");
      expect(e).toMatch(/\blaws\b/i);
      expect(z).toContain("法令");
    }
  });
});

describe("legal documents: lawyer placeholders", () => {
  for (const doc of DOCS) {
    it(`${doc}: has placeholders, the same number in both languages, and every one is closed`, () => {
      const en = placeholders("en-TW", doc);
      const zh = placeholders("zh-TW", doc);
      expect(en.length).toBeGreaterThanOrEqual(5);
      expect(zh.length).toBe(en.length);
      for (const loc of LOCALES) {
        const opened = rawText(loc, doc).reduce((n, t) => n + t.split(OPEN[loc]).length - 1, 0);
        expect(opened, `unclosed or malformed placeholder in ${doc} (${loc})`).toBe(placeholders(loc, doc).length);
        // Long enough to say what the lawyer must decide (Chinese is denser than English).
        for (const p of placeholders(loc, doc)) expect(p.length, p).toBeGreaterThan(OPEN[loc].length + (loc === "en-TW" ? 12 : 6));
      }
    });

    it(`${doc}: every placeholder is found by the page's tokenizer, so it is highlighted`, () => {
      for (const loc of LOCALES) {
        const seen = rawText(loc, doc).flatMap((t) => tokenize(t).filter((k) => k.type === "lawyer"));
        expect(seen.length).toBe(placeholders(loc, doc).length);
      }
    });
  }

  it("the open decisions the owner has not made are marked, not silently decided", () => {
    const terms = placeholders("en-TW", "terms").join("\n");
    for (const topic of [/refund/i, /governing law/i, /liability/i, /統一編號/, /employment-service/i, /minimum age/i, /uniform invoice/i, /licence wording/i, /appeal/i]) {
      expect(terms).toMatch(topic);
    }
    const privacy = placeholders("en-TW", "privacy").join("\n");
    for (const topic of [/統一編號/, /tax and accounting/i, /hosting/i, /email provider/i, /outside Taiwan/i, /resolved reports/i, /retention periods/i, /rights request/i]) {
      expect(privacy).toMatch(topic);
    }
    const termsZh = placeholders("zh-TW", "terms").join("\n");
    for (const topic of [/退款/, /準據法/, /責任/, /統一編號/, /統一發票/]) expect(termsZh).toMatch(topic);
    const privacyZh = placeholders("zh-TW", "privacy").join("\n");
    for (const topic of [/統一編號/, /稅務與會計/, /主機/, /台灣以外/, /已處理的檢舉/]) expect(privacyZh).toMatch(topic);
  });
});

describe("legal documents: the facts the product guarantees", () => {
  const terms = (loc: Locale) => rawText(loc, "terms").join("\n");

  it("Terms state both prices, VAT, the 12-month term, no auto-renewal, no discount and no proration", () => {
    for (const loc of LOCALES) {
      expect(terms(loc)).toContain("NT$10,000");
      expect(terms(loc)).toContain("NT$2,000");
    }
    const en = terms("en-TW");
    expect(en).toMatch(/auto-renew/i);
    expect(en).toMatch(/VAT/);
    expect(en).toMatch(/12 months/);
    expect(en).toMatch(/no discount for extra campuses/i);
    expect(en).toMatch(/no proration/i);
    expect(en).toMatch(/bank transfer/i);
    expect(en).toMatch(/administrator[^.]*confirm/i);
    expect(en).toMatch(/credit-card payment will be added later/i);
    const zh = terms("zh-TW");
    expect(zh).toContain("自動續約");
    expect(zh).toContain("營業稅");
    expect(zh).toContain("12 個月");
    expect(zh).toContain("沒有折扣");
    expect(zh).toContain("不按比例計算");
    expect(zh).toContain("銀行轉帳");
    expect(zh).toContain("管理員");
    expect(zh).toContain("信用卡");
  });

  it("Terms never promise a refund or discount that the owner has not decided", () => {
    const en = terms("en-TW");
    expect(en).not.toMatch(/\brefund(?:ed|able)? (?:in full|within|if)\b/i);
    expect(en).toMatch(/makes no promise either way about refunds/i);
    // The only prices mentioned are the two confirmed ones.
    const amounts = new Set([...en.matchAll(/NT\$\s?[\d,]+/g)].map((m) => m[0]));
    expect([...amounts].sort()).toEqual(["NT$10,000", "NT$2,000", "NT$30,000"].sort());
  });

  it("Terms cover use of educator details, the daily limit, job posts, reports and prohibited content", () => {
    const en = terms("en-TW");
    for (const re of [/bulk/i, /resell/i, /marketing/i, /daily limit/i, /substitute or cover work/i, /ARC numbers/i, /discriminate/i, /payment, or ask them to send ID/i, /signed-in educators who have a profile/i, /report/i, /suspend/i, /appeal/i, /“as is”/i, /Safety guide/]) {
      expect(en).toMatch(re);
    }
    const zh = terms("zh-TW");
    for (const s of ["大量", "轉售", "行銷", "每日上限", "代課", "居留證", "歧視", "檢舉", "停權", "申訴", "安全指南"]) expect(zh).toContain(s);
  });

  it("Terms say that families and schools each see only their own side, and that nothing is public", () => {
    const en = terms("en-TW");
    expect(en).toMatch(/Nobody can see an educator's profile without a paid membership/);
    expect(en).toMatch(/Families see only educators who offer private tutoring/);
    expect(en).toMatch(/Schools see only educators who are open to full-time or part-time work/);
    expect(en).toMatch(/Schools never see educators who offer private tutoring only/);
    expect(en).toMatch(/district level only/);
    const zh = terms("zh-TW");
    expect(zh).toContain("沒有付費會員資格，任何人都看不到教師的檔案");
    expect(zh).toContain("只提供私人家教的教師，學校完全看不到");
  });

  it("Privacy names each item on the never-collect list, in both languages", () => {
    const en = rawText("en-TW", "privacy").join("\n");
    for (const re of [/ID card, passport or ARC/, /criminal records/i, /health data or financial data/i, /home addresses/i, /children's data/i, /self-declared/i]) expect(en).toMatch(re);
    const zh = rawText("zh-TW", "privacy").join("\n");
    for (const s of ["身分證、護照或居留證", "犯罪紀錄", "良民證", "健康資料或財務資料", "住家地址", "兒童資料", "自行聲明"]) expect(zh).toContain(s);
  });

  it("Privacy describes what is stored, who sees it, cookies, retention, rights and children", () => {
    const en = rawText("en-TW", "privacy").join("\n");
    for (const re of [/hashed|hash/i, /keyed hash of your IP address/i, /consent record/i, /audit log/i, /Reports/, /waitlist/i, /essential cookies/i, /no analytics or advertising trackers/i, /Personal Data Protection Act/, /correct or complete/i, /Children/, /nobody|never shown to the public/i, /one educator at a time/i, /family” without naming it|a family/i, /512 × 512/, /Better Auth/, /Resend/, /HTTPS/]) {
      expect(en).toMatch(re);
    }
    const zh = rawText("zh-TW", "privacy").join("\n");
    for (const s of ["雜湊值", "同意紀錄", "稽核紀錄", "候補名單", "必要的 cookie", "個人資料保護法", "更正", "兒童", "逐位教師", "512 × 512"]) expect(zh).toContain(s);
  });

  it("Privacy explains that deleting a profile keeps the consent record and deleting the account removes it", () => {
    const en = rawText("en-TW", "privacy").join("\n");
    expect(en).toMatch(/Delete your profile: this removes the profile, the contact details and the photo\. Your account stays, and we keep the consent record/);
    expect(en).toMatch(/Delete your account: this removes your account and everything linked to it/);
    const zh = rawText("zh-TW", "privacy").join("\n");
    expect(zh).toContain("您的帳號仍在，我們也會保留同意紀錄");
  });

  it("the documents never offer substitute work or live chat", () => {
    for (const doc of DOCS) {
      const en = rawText("en-TW", doc).join("\n");
      expect(en).not.toMatch(/\b(?:we|LearningLinks) (?:offer|arrange|provide) (?:substitute|cover)\b/i);
    }
    expect(terms("en-TW")).toMatch(/We do not offer substitute or cover work/);
    expect(terms("zh-TW")).toContain("我們不提供代課或臨時代班");
  });
});

describe("legal documents: the educator waiver quotes what the educator ticks", () => {
  for (const loc of LOCALES) {
    it(`(${loc}) shows the existing waiver wording and all six confirmations`, () => {
      const w = waiver(loc);
      const n = notice(loc);
      const r = resolved(loc, "waiver");
      const text = plainText(r);
      const joined = text.join("\n");
      expect(joined).toContain(w.lead);
      expect(joined).toContain(w.who.schoolsBody);
      expect(joined).toContain(w.who.familiesBody);
      expect(joined).toContain(w.who.between);
      expect(joined).toContain(w.side.controlBody);
      expect(joined).toContain(w.side.recordBody);
      for (const group of Object.values(w.cols)) for (const [k, v] of Object.entries(group)) if (/^i\d+$/.test(k)) expect(joined).toContain(v);

      const confirmations = r.sections.find((s) => s.id === "confirmations")!;
      expect(confirmations.bullets).toHaveLength(WAIVER_REQUIRED_ITEMS.length + WAIVER_OPTIONAL_ITEMS.length);
      const bullets = confirmations.bullets!.join("\n");
      for (const t of [w.confirm.termsPrivacy, w.confirm.publishToMembers, w.confirm.contactOnRequest, w.confirm.truthful, w.confirm.marketing]) expect(bullets).toContain(stripTags(t));
      expect(bullets).toContain(n.acknowledge);
      expect(confirmations.bullets!.filter((b) => b.startsWith(w.confirm.required))).toHaveLength(WAIVER_REQUIRED_ITEMS.length);
      expect(confirmations.bullets!.filter((b) => b.startsWith(w.confirm.optional))).toHaveLength(WAIVER_OPTIONAL_ITEMS.length);
      expect(bullets).not.toMatch(/<\/?[a-z]+>/i);
    });
  }
});

describe("legal documents: copy hygiene", () => {
  it("Chinese copy addresses the reader as 您 and never as 你", () => {
    for (const doc of DOCS) expect(rawText("zh-TW", doc).join("\n")).not.toContain("你");
  });

  it("only known internal pages are linked", () => {
    const allowed = new Set(["/legal/terms", "/legal/privacy", "/legal/educator-waiver", "/safety"]);
    for (const loc of LOCALES) {
      for (const doc of DOCS) {
        for (const t of rawText(loc, doc)) for (const tok of tokenize(t)) if (tok.type === "link") expect(allowed.has(tok.href), `${loc}/${doc}: ${tok.href}`).toBe(true);
      }
    }
  });

  it("does not use hard-coded colours or markup in the copy", () => {
    for (const loc of LOCALES) {
      for (const doc of DOCS) expect(rawText(loc, doc).join("\n")).not.toMatch(/<[a-z]+|#[0-9a-f]{6}|&[a-z]+;/i);
    }
  });
});

describe("tokenize (the only markup the legal copy uses)", () => {
  it("splits bold, internal links and lawyer placeholders, and leaves everything else as text", () => {
    const toks = tokenize("See the [Privacy policy](/legal/privacy). **Never** auto-renews. [For lawyer: confirm.] Done");
    expect(toks.map((t) => t.type)).toEqual(["text", "link", "text", "bold", "text", "lawyer", "text"]);
    expect(toks[1]).toEqual({ type: "link", text: "Privacy policy", href: "/legal/privacy" });
    expect(toks[5]).toEqual({ type: "lawyer", text: "[For lawyer: confirm.]" });
  });

  it("recognises the Chinese placeholder and ignores brackets that are not placeholders or links", () => {
    expect(tokenize("[請律師確認：準據法。]").map((t) => t.type)).toEqual(["lawyer"]);
    expect(tokenize("a [note] b").map((t) => t.type)).toEqual(["text"]);
    expect(tokenize("[x](https://evil.example)").map((t) => t.type)).toEqual(["text"]);
  });

  it("never turns markup characters into HTML: they stay plain text", () => {
    const toks = tokenize("<script>alert(1)</script> & <b>x</b>");
    expect(toks).toEqual([{ type: "text", text: "<script>alert(1)</script> & <b>x</b>" }]);
  });
});
