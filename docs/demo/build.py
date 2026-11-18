#!/usr/bin/env python3
"""Builds the single-file clickable demo: docs/demo/LearningLinks-demo.html (open it by double-clicking).
Pulls the real notice wording, Taiwan map shapes and font from this repository so the demo cannot drift from them.
Usage: python3 docs/demo/build.py [--fragment out.html]   (the fragment is the page body for the Artifact tool)"""
import base64, json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = Path(__file__).resolve().parent / "src"
MAP_JSON = ROOT / "docs" / "demo" / "taiwan-map.json"

def centroid(d):
    best = None
    for sub in d.split("M")[1:]:
        pts = [(float(a), float(b)) for a, b in re.findall(r"(-?\d+(?:\.\d+)?)[ ,](-?\d+(?:\.\d+)?)", sub)]
        if len(pts) < 3: continue
        a = cx = cy = 0.0
        for (x0, y0), (x1, y1) in zip(pts, pts[1:] + pts[:1]):
            cr = x0 * y1 - x1 * y0
            a += cr; cx += (x0 + x1) * cr; cy += (y0 + y1) * cr
        if abs(a) < 1e-9: continue
        a /= 2
        c = (cx / (6 * a), cy / (6 * a))
        if best is None or abs(a) > best[0]: best = (abs(a), c)
    return best[1]

m = json.loads(MAP_JSON.read_text(encoding="utf8"))
MAP = {"W": m["W"], "H": m["H"], "c": {k: {"d": v["d"], "x": round(centroid(v["d"])[0], 1), "y": round(centroid(v["d"])[1], 1)} for k, v in m["c"].items()}}
NOTICE = {"en": json.loads((ROOT / "messages/en-TW/notice.json").read_text(encoding="utf8")), "zh": json.loads((ROOT / "messages/zh-TW/notice.json").read_text(encoding="utf8"))}
font = base64.b64encode((ROOT / "node_modules/@fontsource-variable/plus-jakarta-sans/files/plus-jakarta-sans-latin-wght-normal.woff2").read_bytes()).decode()
css = (SRC / "style.css").read_text(encoding="utf8")
js = "\n".join((SRC / f).read_text(encoding="utf8") for f in ["data.js", "core.js", "views1.js", "views2.js", "app.js"])
head_js = f"const NOTICE = {json.dumps(NOTICE, ensure_ascii=False)};\nconst MAP = {json.dumps(MAP, separators=(',', ':'))};\n"
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
