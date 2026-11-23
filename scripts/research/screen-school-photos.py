#!/usr/bin/env python3
"""
Second research step for school pictures: help a person check every candidate picture.

    python3 scripts/research/screen-school-photos.py out-dir

Reads out-dir/candidates.json and out-dir/thumbs/ (made by find-school-photos.py) and writes:
  out-dir/flags.json     what an automatic detector thinks it saw (possible people or faces) in each picture
  out-dir/sheets/*.jpg   contact sheets, twelve numbered pictures each, for a person to look through
  out-dir/sheets/index.json   which picture each number is

The detector is only a safety net: it misses small or turned-away people and it mistakes pillars and trees for
people. The decision is made by a person looking at every picture. The rule is the owner's: a picture of the
establishment only, with no people in it. Anything doubtful is left out.

Needs: pip install "opencv-python-headless<5" pillow
"""
import json, os, sys

import cv2
from PIL import Image, ImageDraw, ImageFont

OUT = sys.argv[1] if len(sys.argv) > 1 else "school-photo-research"
TILE_W, TILE_H, COLS, ROWS = 480, 320, 4, 3


def detect(path):
    img = cv2.imread(path)
    if img is None:
        return {"error": "unreadable"}
    h, w = img.shape[:2]
    scale = 960 / max(w, h)
    if scale < 1:
        img = cv2.resize(img, (int(w * scale), int(h * scale)))
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    hog = cv2.HOGDescriptor()
    hog.setSVMDetector(cv2.HOGDescriptor_getDefaultPeopleDetector())
    rects, weights = hog.detectMultiScale(gray, winStride=(8, 8), padding=(8, 8), scale=1.05)
    strong = [float(x) for x in (weights.flatten() if len(weights) else []) if x > 0.6]
    faces = 0
    for name, neigh in (("haarcascade_frontalface_alt2.xml", 6), ("haarcascade_profileface.xml", 8)):
        c = cv2.CascadeClassifier(os.path.join(cv2.data.haarcascades, name))
        faces += len(c.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=neigh, minSize=(24, 24)))
    return {"people": len(strong), "best": round(max(strong), 2) if strong else 0, "faces": faces}


def main():
    cands = json.load(open(os.path.join(OUT, "candidates.json"), encoding="utf-8"))
    flags = {}
    for n, c in enumerate(cands):
        flags[c["wikidata"]] = detect(os.path.join(OUT, "thumbs", c["wikidata"] + ".jpg"))
        if n % 100 == 0:
            print("checked", n, "of", len(cands), flush=True)
    json.dump(flags, open(os.path.join(OUT, "flags.json"), "w"), indent=0)
    flagged = [k for k, v in flags.items() if v.get("people", 0) or v.get("faces", 0)]
    print(len(flagged), "of", len(cands), "flagged by the detector as possibly showing people")

    os.makedirs(os.path.join(OUT, "sheets"), exist_ok=True)
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 30)
    except OSError:
        font = ImageFont.load_default()
    index = {}
    per = COLS * ROWS
    for s in range(0, len(cands), per):
        sheet = Image.new("RGB", (COLS * TILE_W, ROWS * TILE_H), (40, 30, 45))
        draw = ImageDraw.Draw(sheet)
        for i, c in enumerate(cands[s:s + per]):
            num = s + i + 1
            index[str(num)] = c["wikidata"]
            try:
                im = Image.open(os.path.join(OUT, "thumbs", c["wikidata"] + ".jpg")).convert("RGB")
            except OSError:
                continue
            im.thumbnail((TILE_W - 8, TILE_H - 8))
            x = (i % COLS) * TILE_W + (TILE_W - im.width) // 2
            y = (i // COLS) * TILE_H + (TILE_H - im.height) // 2
            sheet.paste(im, (x, y))
            bx, by = (i % COLS) * TILE_W + 6, (i // COLS) * TILE_H + 6
            label = str(num)
            tw = draw.textlength(label, font=font)
            draw.rectangle([bx, by, bx + tw + 16, by + 40], fill=(255, 255, 255))
            draw.text((bx + 8, by + 3), label, fill=(0, 0, 0), font=font)
        sheet.save(os.path.join(OUT, "sheets", f"sheet-{s // per + 1:03d}.jpg"), quality=88)
    json.dump(index, open(os.path.join(OUT, "sheets", "index.json"), "w"))
    print((len(cands) + per - 1) // per, "contact sheets written to", os.path.join(OUT, "sheets"))


if __name__ == "__main__":
    main()
