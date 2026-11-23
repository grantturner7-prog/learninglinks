/**
 * Builds one PDF of the three legal drafts (Terms, Privacy policy, Educator waiver) in English and Traditional Chinese,
 * straight from the legal.json message files, for a lawyer to read and mark up. Every bracketed note for the lawyer is
 * highlighted and numbered; the numbers match the brief for counsel (notes 1 to 34).
 *   NODE_PATH=$(npm root -g) node docs/review/legal-drafts-pdf.cjs <out.pdf>
 */
const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");
const ROOT = path.resolve(__dirname, "../..");
const OUT = process.argv[2];
if (!OUT) { console.error("usage: node legal-drafts-pdf.cjs <out.pdf>"); process.exit(1); }
const load = (loc) => JSON.parse(fs.readFileSync(path.join(ROOT, `messages/${loc}/legal.json`), "utf8"));
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const DOCS = [["terms", "terms"], ["privacy", "privacy"], ["waiver", "waiver"]];
const NOTE = { "en-TW": /\[For lawyer: [\s\S]*?\]/g, "zh-TW": /\[請律師確認：[\s\S]*?\]/g };
let counter = {}; // per language: running note number across the three documents

function inline(text, loc) {
  let t = text.replace(/\[([^\]]+)\]\((\/[^)]+)\)/g, "$1"); // links: keep the words, drop the address
  const notes = [];
  t = t.replace(NOTE[loc], (m) => { notes.push(m); return `\u0001${notes.length - 1}\u0001`; });
  t = esc(t).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  return t.replace(/\u0001(\d+)\u0001/g, (_, i) => { counter[loc] = (counter[loc] || 0) + 1; return `<mark><b>[${loc === "en-TW" ? "Note" : "註"} ${counter[loc]}]</b> ${esc(notes[Number(i)].slice(1, -1))}</mark>`; });
}
function render(loc) {
  const d = load(loc);
  counter[loc] = 0;
  const en = loc === "en-TW";
  let html = `<section class="doc" lang="${en ? "en" : "zh-Hant-TW"}"><div class="langtag">${en ? "English text" : "繁體中文版本"}</div>`;
  for (const [key, docKey] of DOCS) {
    const doc = d.docs[docKey];
    html += `<article><h1>${esc(d[key])}</h1><p class="draft">${en ? "DRAFT for legal review" : "草稿，待律師審閱"}</p><p class="legend">${esc(d.ui.legend)}</p>`;
    for (const p of [].concat(doc.intro || [])) html += `<p>${inline(p, loc)}</p>`;
    doc.sections.forEach((s, i) => {
      html += `<h2>${i + 1}. ${esc(s.title)}</h2>`;
      for (const p of s.paragraphs || []) html += `<p>${inline(p, loc)}</p>`;
      if ((s.bullets || []).length) html += `<ul>${s.bullets.map((b) => `<li>${inline(b, loc)}</li>`).join("")}</ul>`;
    });
    html += `</article>`;
  }
  return html + `</section>`;
}
const css = `
@page { size: A4; margin: 22mm 18mm; }
body { font-family: "Noto Sans TC", "PingFang TC", "Microsoft JhengHei", "WenQuanYi Zen Hei", "WenQuanYi Zen Hei Mono", "DejaVu Sans", Arial, sans-serif; font-size: 10.5pt; line-height: 1.55; color: #1c1022; }
.cover { page-break-after: always; padding-top: 50mm; }
.cover h1 { font-size: 26pt; margin: 0 0 6mm; }
.cover p { max-width: 150mm; }
article { page-break-before: always; }
section.doc > article:first-of-type { page-break-before: auto; }
h1 { font-size: 20pt; margin: 0 0 3mm; }
h2 { font-size: 12.5pt; margin: 6mm 0 2mm; page-break-after: avoid; }
p { margin: 0 0 2.5mm; }
ul { margin: 0 0 3mm 5mm; padding-left: 4mm; }
li { margin-bottom: 1.5mm; }
mark { background: #fff0b3; padding: 0 1mm; border-radius: 1mm; }
.draft { display: inline-block; background: #2b1730; color: #fff; padding: 1mm 3mm; border-radius: 2mm; font-weight: 700; font-size: 9pt; }
.legend { color: #5b4560; font-size: 9.5pt; font-style: italic; }
.langtag { font-size: 9pt; letter-spacing: .08em; text-transform: uppercase; color: #6e5a73; margin-bottom: 4mm; }
section.doc + section.doc { page-break-before: always; }
`;
(async () => {
  const en = render("en-TW");
  const zh = render("zh-TW");
  const today = new Date().toISOString().slice(0, 10);
  const cover = `<div class="cover"><h1>LearningLinks: draft legal documents</h1><p>Terms of use, Privacy policy and Educator publication waiver, in English and in Traditional Chinese, as they stand on ${today}.</p><p>These are drafts. Every point that needs a decision or confirmation from you is highlighted and numbered <b>[Note 1]</b> to <b>[Note 34]</b>. The numbers match the brief for counsel, which lists each note with the question it belongs to and what the site does today.</p><p>The Chinese text has the same 34 notes in the same order (marked 註 1 to 註 34) and has not yet been read by a native speaker.</p></div>`;
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>${cover}${en}${zh}</body></html>`;
  fs.writeFileSync(OUT.replace(/\.pdf$/, ".html"), html);
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.setContent(html, { waitUntil: "load" });
  await p.pdf({ path: OUT, format: "A4", printBackground: true, displayHeaderFooter: true, headerTemplate: "<span></span>", footerTemplate: `<div style="font-size:8px;width:100%;text-align:center;color:#6e5a73;font-family:Arial">LearningLinks draft legal documents &middot; page <span class="pageNumber"></span> of <span class="totalPages"></span></div>`, margin: { top: "20mm", bottom: "20mm", left: "18mm", right: "18mm" } });
  await b.close();
  console.log(`notes: English ${counter["en-TW"]}, Chinese ${counter["zh-TW"]}`);
})();
