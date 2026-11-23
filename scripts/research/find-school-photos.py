#!/usr/bin/env python3
"""
Research step for school pictures (run by hand, rarely): asks Wikidata which schools in Taiwan have a photo or a photo
folder on Wikimedia Commons, reads each photo's licence and author from Commons, and writes the candidates to a JSON
file. Nothing here touches our database. A person then looks at every candidate (no people in the picture, and it
really shows the school) before it goes into data/school-photos.json, which `npm run db:import-school-photos` loads.

    python3 scripts/research/find-school-photos.py out-dir

Only photos under a licence that allows reuse are kept: public domain, CC0, CC BY and CC BY-SA.
Needs network access to query.wikidata.org, commons.wikimedia.org and upload.wikimedia.org.
"""
import csv, hashlib, json, os, re, subprocess, sys, time, urllib.parse

UA = "school-photo-finder/1.0 (open-licence image lookup)"
ARGS = [a for a in sys.argv[1:] if not a.startswith("--")]
OUT = ARGS[0] if ARGS else "school-photo-research"
# --with-folders also looks inside the photo folders of schools that have no photo linked directly. It is one request
# per school and the library allows very few requests from an anonymous program, so it is slow (about 10 seconds each).
WITH_FOLDERS = "--with-folders" in sys.argv
# --no-download writes the candidate list for the copies that are already in out-dir/thumbs and fetches nothing more
# (the library allows an anonymous program roughly one picture a minute, so a full run takes hours: stop, look at what
# has arrived, and run again later).
NO_DOWNLOAD = "--no-download" in sys.argv
os.makedirs(os.path.join(OUT, "thumbs"), exist_ok=True)

KIND_WORDS = re.compile(r"school|universit|college|kindergarten|academy \(east|institute of technology|educational institution|conservatory|preschool|nursery", re.I)
NOT_KIND = re.compile(r"building|museum|former|district|library|hospital|press|station|team|club|alumni|journal|faculty|department|laboratory$|campus|dormitor|stadium|gymnasium|bus|association|union|election|constituency", re.I)
OK_LICENCE = re.compile(r"^(cc0|public domain|pd\b|cc[ -]by(-sa)?[ -]\d)", re.I)
PHOTO_EXT = re.compile(r"\.(jpe?g)$", re.I)
GOOD_NAME = re.compile(r"校門|正門|大門|校園|校舍|外觀|gate|campus|entrance|building|exterior|front", re.I)
BAD_NAME = re.compile(r"logo|emblem|badge|seal|校徽|校旗|flag|map|地圖|uniform|制服|校長|principal|portrait|學生|students|畢業|graduat|運動會|ceremony|典禮|合照|team|隊|比賽|concert|演出|plaque|certificate|證書|signature|icon", re.I)


def curl(url, params=None, out=None, timeout=170, accept=None):
    cmd = ["curl", "-s", "-L", "-m", str(timeout), "-A", UA, "-w", "\n%{http_code}"]
    if accept:
        cmd += ["-H", f"Accept: {accept}"]
    if params:
        cmd += ["-G", url]
        for k, v in params.items():
            cmd += ["--data-urlencode", f"{k}={v}"]
    else:
        cmd += [url]
    if out:
        cmd += ["-o", out]
        r = subprocess.run(cmd, capture_output=True, text=True)
        return r.stdout.strip().rsplit("\n", 1)[-1], None
    r = subprocess.run(cmd, capture_output=True)
    body, _, code = r.stdout.rpartition(b"\n")
    return code.decode(), body.decode("utf-8", "replace")


def sparql(query):
    for attempt in range(3):
        code, body = curl("https://query.wikidata.org/sparql", {"query": query}, accept="text/csv")
        if code == "200":
            return list(csv.DictReader(body.splitlines()))
        time.sleep(8 * (attempt + 1))
    raise SystemExit(f"Wikidata query failed ({code})")


def commons(params):
    # One request at a time. The library allows an anonymous program very few requests, and says how long to wait
    # (the Retry-After header) when it refuses one: wait exactly that, a little more, and try again, for up to an hour.
    hdr = os.path.join(OUT, "last-headers.txt")
    for attempt in range(120):
        cmd = ["curl", "-s", "-m", "60", "-A", UA, "-D", hdr, "-w", "\n%{http_code}", "-G", "https://commons.wikimedia.org/w/api.php"]
        for k, v in {"format": "json", "formatversion": "2", **params}.items():
            cmd += ["--data-urlencode", f"{k}={v}"]
        out = subprocess.run(cmd, capture_output=True).stdout
        body, _, code = out.rpartition(b"\n")
        if code == b"200" and b'"error"' not in body[:40]:
            return json.loads(body.decode("utf-8", "replace"))
        wait = 30
        try:
            for line in open(hdr, encoding="latin-1"):
                if line.lower().startswith("retry-after:"):
                    wait = int(line.split(":", 1)[1].strip())
        except (OSError, ValueError):
            pass
        time.sleep(min(120, wait) + 4)
    raise SystemExit("Commons kept refusing for an hour; run again later (finished steps are saved)")


def cached(name, make):
    """Each slow step is saved, so a run that is interrupted carries on where it stopped."""
    path = os.path.join(OUT, name)
    if os.path.exists(path):
        return json.load(open(path, encoding="utf-8"))
    value = make()
    json.dump(value, open(path, "w", encoding="utf-8"), ensure_ascii=False)
    return value


def strip_html(s):
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", s or "")).strip()


def main():
    # 1 and 2. Every school in Taiwan with a photo (P18) or a photo folder (P373).
    def find_schools():
        kinds = sparql('SELECT ?kind ?kindLabel (COUNT(?item) AS ?n) WHERE { ?item wdt:P17 wd:Q865 ; wdt:P31 ?kind . SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } GROUP BY ?kind ?kindLabel ORDER BY DESC(?n) LIMIT 3000')
        qids = [k["kind"].rsplit("/", 1)[1] for k in kinds if KIND_WORDS.search(k["kindLabel"]) and not NOT_KIND.search(k["kindLabel"])]
        found = {}
        for i in range(0, len(qids), 24):
            vals = " ".join("wd:" + q for q in qids[i:i + 24])
            rows = sparql(f'''SELECT ?item ?zh ?coord ?image ?cat WHERE {{ VALUES ?kind {{ {vals} }} ?item wdt:P31 ?kind ; wdt:P17 wd:Q865 .
              OPTIONAL {{ ?item wdt:P18 ?image }} OPTIONAL {{ ?item wdt:P373 ?cat }} OPTIONAL {{ ?item wdt:P625 ?coord }}
              OPTIONAL {{ ?item rdfs:label ?zh FILTER(LANG(?zh) = "zh-tw") }} FILTER(BOUND(?image) || BOUND(?cat)) }}''')
            for r in rows:
                sc = found.setdefault(r["item"], {"wikidata": r["item"].rsplit("/", 1)[1], "zh": "", "coord": "", "image": "", "cat": ""})
                for k in ("zh", "coord", "image", "cat"):
                    if r[k] and not sc[k]:
                        sc[k] = r[k]
            time.sleep(3)
        return found
    schools = cached("schools.json", find_schools)
    print(len(schools), "schools with a photo or a photo folder", flush=True)

    # 3. One file per school: the linked photo, or the best-named photo in its folder.
    folders_path = os.path.join(OUT, "folders.json")
    folders = json.load(open(folders_path, encoding="utf-8")) if os.path.exists(folders_path) else {}
    for n, s in enumerate(schools.values()):
        if s["image"]:
            s["file"] = "File:" + urllib.parse.unquote(s["image"].rsplit("/", 1)[1]).replace("_", " ")
            s["via"] = "photo"
            continue
        if s["cat"] not in folders and not WITH_FOLDERS:
            s["file"] = ""
            s["via"] = "folder"
            continue
        if s["cat"] not in folders:
            d = commons({"action": "query", "list": "categorymembers", "cmtitle": "Category:" + s["cat"], "cmtype": "file", "cmlimit": "60"})
            folders[s["cat"]] = [m["title"] for m in d.get("query", {}).get("categorymembers", [])]
            json.dump(folders, open(folders_path, "w", encoding="utf-8"), ensure_ascii=False)
            time.sleep(10)
            if len(folders) % 25 == 0:
                print("folders read:", len(folders), flush=True)
        files = [t for t in folders[s["cat"]] if PHOTO_EXT.search(t) and not BAD_NAME.search(t)]
        files.sort(key=lambda t: (0 if GOOD_NAME.search(t) else 1, t))
        s["file"] = files[0] if files else ""
        s["via"] = "folder"
    todo = [s for s in schools.values() if s["file"]]
    print(len(todo), "have a usable file name")

    # 4. Licence, author and an 800px copy of each.
    by_title = {}
    for s in todo:
        by_title.setdefault(s["file"], []).append(s)
    titles = list(by_title)
    meta_path = os.path.join(OUT, "meta.json")
    metas = json.load(open(meta_path, encoding="utf-8")) if os.path.exists(meta_path) else {}
    for i in range(0, len(titles), 40):
        chunk = "|".join(titles[i:i + 40])
        if chunk not in metas:
            metas[chunk] = commons({"action": "query", "titles": chunk, "prop": "imageinfo", "iiprop": "url|size|mime|extmetadata", "iiurlwidth": "960"})
            json.dump(metas, open(meta_path, "w", encoding="utf-8"), ensure_ascii=False)
            print("licence batches read:", len(metas), "of", (len(titles) + 39) // 40, flush=True)
            time.sleep(12)
        d = metas[chunk]
        norm = {n["to"]: n["from"] for n in d.get("query", {}).get("normalized", [])}
        for p in d.get("query", {}).get("pages", []):
            ii = (p.get("imageinfo") or [None])[0]
            if not ii:
                continue
            meta = ii.get("extmetadata", {})
            val = lambda k: strip_html(meta.get(k, {}).get("value", ""))
            for s in by_title.get(norm.get(p["title"], p["title"]), []) + (by_title.get(p["title"], []) if norm.get(p["title"]) else []):
                # The library hands out copies from thumb.wikimedia.org; the same file is at upload.wikimedia.org,
                # which is the one address our servers are allowed to reach. Drop the tracking query as well.
                thumb = re.sub(r"\?.*$", "", ii.get("thumburl", "")).replace("//thumb.wikimedia.org/", "//upload.wikimedia.org/")
                s.update({"thumbUrl": thumb, "pageUrl": ii.get("descriptionurl", ""), "mime": ii.get("mime", ""), "width": ii.get("thumbwidth"), "height": ii.get("thumbheight"),
                          "licence": val("LicenseShortName"), "licenceUrl": val("LicenseUrl"), "author": val("Artist")[:120], "credit": val("Credit")[:120], "taken": val("DateTimeOriginal")[:20]})
    kept = [s for s in todo if s.get("thumbUrl") and s.get("mime") == "image/jpeg" and OK_LICENCE.search(s.get("licence", ""))]
    print(len(kept), "are JPEG photos under a licence that allows reuse")
    print("left out for licence or type:", sorted({(s.get("licence") or "none") for s in todo if s not in kept})[:12])

    for n, s in enumerate(kept):
        path = os.path.join(OUT, "thumbs", s["wikidata"] + ".jpg")
        if (not os.path.exists(path) or os.path.getsize(path) < 2000) and not NO_DOWNLOAD:
            for attempt in range(30):
                code, _ = curl(s["thumbUrl"], out=path, timeout=60)
                if code == "200" and os.path.getsize(path) > 2000:
                    break
                if code == "404":
                    break
                time.sleep(40)
            time.sleep(2.5)
        if os.path.exists(path) and os.path.getsize(path) > 2000:
            s["sha256"] = hashlib.sha256(open(path, "rb").read()).hexdigest()
        if n % 25 == 0 and not NO_DOWNLOAD:
            print("downloaded", n, "of", len(kept), flush=True)
    kept = [s for s in kept if s.get("sha256")]
    json.dump(kept, open(os.path.join(OUT, "candidates.json"), "w"), ensure_ascii=False, indent=1)
    print(len(kept), "candidates written to", os.path.join(OUT, "candidates.json"))


if __name__ == "__main__":
    main()
