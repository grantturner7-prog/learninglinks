#!/usr/bin/env python3
"""Builds the Chinese review pack: a spreadsheet of every piece of site text with the English beside the Traditional
Chinese, for a native proofreader to mark up without touching code. Reads messages/en-TW and messages/zh-TW.
Usage: python3 docs/review/chinese-review-pack.py <out.xlsx>"""
import glob, json, os, re, sys
from datetime import date
from pathlib import Path
from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill, Border, Side
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.properties import PageSetupProperties

ROOT = Path(__file__).resolve().parents[2]
OUT = sys.argv[1] if len(sys.argv) > 1 else "LearningLinks-Chinese-review-pack.xlsx"

AREA = {
    "home": "Home page", "nav": "Top navigation", "auth": "Sign-up, sign-in, password reset, email verification",
    "journey": "Guided educator profile flow (Link asks one question at a time)", "educator": "Educator profile builder, settings, waiver tick boxes",
    "billing": "Family and school checkout, order page, online payment", "school": "School pages: find and claim a campus, jobs, bilingual tick box",
    "dashboard": "Dashboards for each kind of account", "directory": "Educator list and profile as paying members see it", "jobs": "Job posts page (signed-in educators)",
    "wall": "What visitors see where educators are members-only", "forFamilies": "Marketing page for families", "forSchools": "Marketing page for schools",
    "reveal": "Asking for an educator's contact details; who asked", "report": "Report buttons and forms", "safety": "Safety guide page", "map": "Map labels and legend",
    "account": "Account page (schools and families: delete account)", "common": "Shared labels and buttons", "footer": "Page footer",
    "taxonomy": "Lists: subjects, levels, school kinds, languages, countries", "notice": "The compliance notice shown on every page (fixed wording)",
    "legal": "Terms of use, Privacy policy, Educator waiver",
}
ORDER = ["home", "nav", "auth", "journey", "educator", "billing", "school", "dashboard", "directory", "jobs", "wall", "forFamilies", "forSchools", "reveal", "report", "safety", "map", "account", "common", "footer", "taxonomy", "notice"]

def flat(o, p=""):
    if isinstance(o, dict):
        for k, v in o.items(): yield from flat(v, f"{p}.{k}" if p else k)
    elif isinstance(o, list):
        for i, v in enumerate(o): yield from flat(v, f"{p}[{i}]")
    else: yield p, o

en, zh = {}, {}
for f in sorted(glob.glob(str(ROOT / "messages/en-TW/*.json"))):
    n = os.path.basename(f)[:-5]
    en[n] = dict(flat(json.load(open(f, encoding="utf8"))))
    zh[n] = dict(flat(json.load(open(f.replace("en-TW", "zh-TW"), encoding="utf8"))))
    assert set(en[n]) == set(zh[n]), f"{n}: keys differ"

def note_for(e):
    out = []
    if re.search(r"\{[^}]*\}", e): out.append("Keep the {…} parts exactly as they are (they are filled in by the site).")
    if "**" in e: out.append("Keep ** around the words that are bold.")
    if "[For lawyer:" in e: out.append("The [請律師確認：…] note is for the lawyer: do not change it, comment if unclear.")
    return " ".join(out)

HEAD = ["ID", "Where it appears", "English", "Current Traditional Chinese", "Your corrected Traditional Chinese (leave blank if it is fine)", "Status", "Comment", "Note"]
WIDTH = [30, 30, 58, 58, 58, 14, 40, 34]
thin = Side(style="thin", color="DDCCD0")
HFILL = PatternFill("solid", fgColor="2B1730"); EFILL = PatternFill("solid", fgColor="FFF3D6"); GFILL = PatternFill("solid", fgColor="F5F0FC")

def sheet(wb, title, rows):
    ws = wb.create_sheet(title)
    ws.append(HEAD)
    for c in ws[1]:
        c.font = Font(bold=True, color="FFFFFF"); c.fill = HFILL; c.alignment = Alignment(wrap_text=True, vertical="center")
    for r in rows: ws.append(r)
    for i, w in enumerate(WIDTH, 1): ws.column_dimensions[get_column_letter(i)].width = w
    for row in ws.iter_rows(min_row=2):
        for c in row:
            c.alignment = Alignment(wrap_text=True, vertical="top"); c.border = Border(bottom=thin)
        row[4].fill = EFILL; row[5].fill = EFILL; row[6].fill = EFILL
        row[2].font = Font(color="4A3550"); row[1].font = Font(color="6E5A73", size=9); row[0].font = Font(color="6E5A73", size=9)
    ws.page_setup.orientation = "landscape"; ws.page_setup.fitToWidth = 1; ws.page_setup.fitToHeight = 0
    ws.sheet_properties.pageSetUpPr = PageSetupProperties(fitToPage=True)
    ws.freeze_panes = "C2"; ws.auto_filter.ref = f"A1:{get_column_letter(len(HEAD))}{ws.max_row}"
    dv = DataValidation(type="list", formula1='"OK,Changed,Question,Fixed wording"', allow_blank=True)
    ws.add_data_validation(dv); dv.add(f"F2:F{ws.max_row}")
    return ws

wb = Workbook(); wb.remove(wb.active)

# --- read me
rm = wb.create_sheet("Read me")
lines = [
    ("LearningLinks: Traditional Chinese review pack", True),
    (f"Prepared {date.today().isoformat()}. {sum(len(v) for k, v in en.items() if k != 'legal'):,} pieces of site text and {len(en['legal']):,} pieces of legal text, English beside Traditional Chinese.", False),
    ("", False),
    ("What we need from you", True),
    ("Please read the Chinese the way a Taiwanese parent, teacher or school owner would. The site should sound friendly, plain and natural, in Traditional Chinese as used in Taiwan (臺灣用語), not translated word for word.", False),
    ("", False),
    ("How to mark it up", True),
    ("1. Work in the sheets called Site text and Legal text. Do not change the English or the first two columns.", False),
    ("2. If the current Chinese is fine, leave the yellow columns empty or set Status to OK.", False),
    ("3. If it needs changing, write the corrected Chinese in the column 'Your corrected Traditional Chinese' and set Status to Changed.", False),
    ("4. If the English itself is unclear, or you are not sure, set Status to Question and explain in Comment.", False),
    ("5. Keep anything inside { } exactly as it is, for example {n} or {name}. The site fills these in. Keep ** around words that are bold.", False),
    ("6. The sheet 'Glossary' lists key terms and which Chinese words are used now. Please say which choice you prefer and use it consistently.", False),
    ("", False),
    ("Special cases", True),
    ("Notice (fixed wording): the compliance notice appears on every page and is protected by tests. Please do not rewrite it. If you think it should change, use Comment and we will ask the lawyer.", False),
    ("Legal text: every text in square brackets that begins with 請律師確認 is a note for the lawyer. Do not change those. Please still check the surrounding Chinese for natural wording and for mistakes.", False),
    ("Names: LearningLinks, ECPay (綠界) and similar names stay as they are.", False),
    ("", False),
    ("Where to start", True),
    ("If time is short, review in this order: Home page, Sign-up and sign-in, Guided educator profile flow, Family and school checkout, School pages, Dashboards. The legal text comes last and the lawyer will also read it.", False),
    ("", False),
    ("When you are done", True),
    ("Save the file and send it back. Changes will be entered into the site and checked on screen.", False),
]
for t, b in lines:
    rm.append([t]); c = rm.cell(row=rm.max_row, column=1); c.alignment = Alignment(wrap_text=True, vertical="top"); c.font = Font(bold=b, size=14 if b and rm.max_row == 1 else 11)
rm.column_dimensions["A"].width = 120

# --- site text
rows = []
for n in ORDER + [k for k in en if k not in ORDER and k != "legal"]:
    if n not in en: continue
    for k in en[n]:
        e, z = en[n][k], zh[n][k]
        rows.append([f"{n} › {k}", AREA.get(n, n), e, z, None, "Fixed wording" if n == "notice" else None, None, note_for(e)])
site = sheet(wb, "Site text", rows)

# --- legal text (section and paragraph, same order as the pages)
lrows = []
L_en = json.load(open(ROOT / "messages/en-TW/legal.json", encoding="utf8")); L_zh = json.load(open(ROOT / "messages/zh-TW/legal.json", encoding="utf8"))
lrows.append(["legal › draft label", "Banner shown on the legal pages", L_en["draft"], L_zh["draft"], None, None, None, ""])
for k in L_en["ui"]:
    lrows.append([f"legal › {k}", "Labels on the legal pages", L_en["ui"][k], L_zh["ui"][k], None, None, None, note_for(L_en["ui"][k])])
for key, dk in (("terms", "terms"), ("privacy", "privacy"), ("waiver", "waiver")):
    ed, zd = L_en["docs"][dk], L_zh["docs"][dk]
    lrows.append([f"{key} › title", AREA["legal"], L_en[key], L_zh[key], None, None, None, ""])
    as_list = lambda v: [v] if isinstance(v, str) else list(v or [])
    for i, (a, b) in enumerate(zip(as_list(ed.get("intro")), as_list(zd.get("intro"))), 1):
        lrows.append([f"{key} › intro {i}", AREA["legal"], a, b, None, None, None, note_for(a)])
    for es, zs in zip(ed["sections"], zd["sections"]):
        assert es["id"] == zs["id"]
        lrows.append([f"{key} › {es['id']} › heading", f"{L_en[key]}", es["title"], zs["title"], None, None, None, ""])
        for j, (a, b) in enumerate(zip(es.get("paragraphs", []), zs.get("paragraphs", [])), 1):
            lrows.append([f"{key} › {es['id']} › paragraph {j}", f"{L_en[key]}: {es['title']}", a, b, None, None, None, note_for(a)])
        for j, (a, b) in enumerate(zip(es.get("bullets", []), zs.get("bullets", [])), 1):
            lrows.append([f"{key} › {es['id']} › bullet {j}", f"{L_en[key]}: {es['title']}", a, b, None, None, None, note_for(a)])
legal = sheet(wb, "Legal text", lrows)

# --- glossary: current usage and variants, counted over all Chinese text
alltext = "\n".join(str(v) for d in zh.values() for v in d.values())
GL = [
    ("educator", "教師", ["老師", "教育工作者", "教育者"]), ("school", "學校", ["校方"]), ("cram school (buxiban)", "補習班", ["安親班"]), ("campus", "校區", ["分校", "分部"]),
    ("family", "家庭", ["家長"]), ("parent", "家長", []), ("membership", "會員資格", ["會籍", "會員制"]), ("member", "會員", []), ("private tutoring", "私人家教", ["家教", "一對一"]),
    ("bilingual", "雙語", []), ("government school", "公立", []), ("private school", "私立", []), ("kindergarten", "幼兒園", ["幼稚園"]),
    ("Uniform Business Number", "統一編號", ["統編"]), ("invoice", "發票", []), ("background check", "背景調查", ["背景查核", "背景審查"]),
    ("connection website", "連結平台", ["媒合平台", "配對平台"]), ("agent (we are not one)", "仲介", ["經紀", "代理人"]), ("profile", "檔案", ["個人檔案", "資料頁"]), ("waiver / consent", "同意書", ["授權書"]),
    ("administrator", "管理員", ["管理者"]), ("report (a problem)", "檢舉", ["回報", "舉報"]), ("suspend", "停權", ["停用", "暫停"]),
    ("contact details", "聯絡方式", ["聯絡資料", "聯絡資訊"]), ("district", "行政區", ["區域"]), ("job post", "職缺", ["職位", "徵才"]),
    ("order", "訂單", []), ("refund", "退款", ["退費"]), ("work permit", "工作許可", ["工作證", "工作簽證"]), ("12 months", "12 個月", ["十二個月", "一年"]),
]
gl = wb.create_sheet("Glossary")
gl.append(["English term", "Chinese used most", "Times used", "Other wordings found (times)", "Your preferred wording", "Comment"])
for c in gl[1]: c.font = Font(bold=True, color="FFFFFF"); c.fill = HFILL; c.alignment = Alignment(wrap_text=True, vertical="center")
def count(w):
    """How often w is used on its own: not counting where it sits inside a longer glossary word (家教 inside 私人家教)."""
    n = alltext.count(w)
    for _, m, alts in GL:
        for longer in [m] + alts:
            if longer != w and w in longer: n -= alltext.count(longer)
    return n
for term, main, alts in GL:
    seen = ", ".join(f"{a} ({count(a)})" for a in alts if count(a) > 0)
    gl.append([term, main, count(main), seen or "none", None, None])
for i, w in enumerate([34, 20, 12, 40, 28, 40], 1): gl.column_dimensions[get_column_letter(i)].width = w
for row in gl.iter_rows(min_row=2):
    for c in row: c.alignment = Alignment(wrap_text=True, vertical="top"); c.border = Border(bottom=thin)
    row[4].fill = EFILL; row[5].fill = EFILL
gl.freeze_panes = "A2"
rm["A2"] = f"Prepared {date.today().isoformat()}. {site.max_row - 1:,} pieces of site text and {legal.max_row - 1:,} pieces of legal text, English beside Traditional Chinese."
wb.save(OUT)
print(f"{OUT}: Site text {site.max_row - 1} rows, Legal text {legal.max_row - 1} rows, Glossary {gl.max_row - 1} terms")
