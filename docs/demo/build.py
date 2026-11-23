#!/usr/bin/env python3
"""Builds the single-file clickable demo: docs/demo/LearningLinks-demo.html (open it by double-clicking).
Pulls the real notice wording, the Taiwan map shapes (every city and district: docs/demo/export-map.ts writes
taiwan-districts.json from the same source as the real site's map) and the font from this repository, so the demo
cannot drift from them.
Usage: python3 docs/demo/build.py [--fragment out.html]   (the fragment is the page body for the Artifact tool)"""
import base64, json, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = Path(__file__).resolve().parent / "src"
MAP_JSON = ROOT / "docs" / "demo" / "taiwan-districts.json"

MAPD = MAP_JSON.read_text(encoding="utf8")  # every city and district, from docs/demo/export-map.ts
NOTICE = {"en": json.loads((ROOT / "messages/en-TW/notice.json").read_text(encoding="utf8")), "zh": json.loads((ROOT / "messages/zh-TW/notice.json").read_text(encoding="utf8"))}
font = base64.b64encode((ROOT / "node_modules/@fontsource-variable/plus-jakarta-sans/files/plus-jakarta-sans-latin-wght-normal.woff2").read_bytes()).decode()
css = (SRC / "style.css").read_text(encoding="utf8")
js = "\n".join((SRC / f).read_text(encoding="utf8") for f in ["data.js", "core.js", "map.js", "views1.js", "views2.js", "app.js"])
REAL = (Path(__file__).resolve().parent / "schools-moe.json").read_text(encoding="utf8")
# A handful of real schools with their real, reviewed pictures (docs/demo/school-pictures.json; the pictures themselves
# are small WebP files in docs/demo/pictures/). Everything else on the demo's school map is pretend.
PICS_JSON = Path(__file__).resolve().parent / "school-pictures.json"
pics = json.loads(PICS_JSON.read_text(encoding="utf8")) if PICS_JSON.exists() else []
for pic in pics:
    pic["src"] = "data:image/webp;base64," + base64.b64encode((PICS_JSON.parent / "pictures" / pic.pop("file")).read_bytes()).decode()
head_js = f"const NOTICE = {json.dumps(NOTICE, ensure_ascii=False)};\nconst MAPD = {MAPD};\nconst REAL = {REAL};\nconst PICTURED = {json.dumps(pics, ensure_ascii=False)};\n"
fontface = f"@font-face {{ font-family: 'Plus Jakarta Sans'; font-style: normal; font-weight: 200 800; font-display: swap; src: url(data:font/woff2;base64,{font}) format('woff2'); }}\n"
TITLE = "LearningLinks Demo"
body = f'<div id="app"></div>\n<script>\n{head_js}{js}\n</script>'
style = f"<style>\n{fontface}{css}\n</style>"
full = f'<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>{TITLE}</title>\n{style}\n</head>\n<body>\n{body}\n</body>\n</html>\n'
out = Path(__file__).resolve().parent / "LearningLinks-demo.html"
out.write_text(full, encoding="utf8")
print(f"{out}  {len(full)/1024:.0f} KB")
if "--fragment" in sys.argv:
    p = Path(sys.argv[sys.argv.index("--fragment") + 1])
    frag = f'<title>{TITLE}</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n{style}\n{body}\n'
    p.write_text(frag, encoding="utf8")
    print(f"{p}  {len(frag)/1024:.0f} KB")
