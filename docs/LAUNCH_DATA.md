# Launch data: schools to show on the map

Educators are never imported: they create their own profile. What the site needs before launch is a list of **schools and cram schools**, so a school can find and claim its campus and educators can see where jobs are.

## Government and private schools, universities, international schools (Ministry of Education)

The Ministry of Education publishes its school directories as open data (data.gov.tw datasets 6087, 6088, 6089, 6090, 24393, 6091, 28589 and 32958; Government Open Data License v1). One command fetches and loads them:

```bash
npm run db:import-moe -- --dry-run     # fetch and report, write nothing
npm run db:import-moe -- --prune       # fetch and load, and tidy the map data (see below)
```

What it loads (school year 115 / 2026):

| Kind | Schools | Government / private |
|---|---|---|
| Elementary schools | 2,607 | 2,575 / 32 |
| Junior high schools | 739 | 725 / 14 |
| Senior high and vocational schools (including evening schools) | 496 | 308 / 188 |
| Universities, colleges, technical colleges, military and police academies | 148 | 56 / 92 |
| Schools for international residents (American, Japanese, European, Korean and others) | 22 | private |
| Bilingual and international schools recognised by name (雙語, 國際) | 7 | |

Every school says whether it is **government (公立) or private (私立)**, as the Ministry lists it. The site keeps only the name, kind, government/private, city, district and the school's public website. Street addresses and phone numbers are read to find the district and thrown away, and pins sit inside the district, never at an address.

Schools already loaded from the map data (OpenStreetMap) are **recognised by name and city and updated** (they keep their exact position and any claim), so nobody appears twice. `--prune` also removes map-data entries that are not schools at all (a department such as "土木工程學系", a branch campus, a building). Re-running is safe.

Limits, honestly:

- **Kindergartens:** the Ministry has no national kindergarten list on open data (only some cities publish their own). Kindergartens come from the map data (about 1,100, far fewer than exist). A kindergarten that is not listed adds itself (below).
- **Private bilingual schools:** Taiwan publishes no national list of them. They are recognised only when the name says so (雙語, 國際) or when they are on the Ministry's list of schools for international residents. Others add themselves, or can be tagged later.
- **Cram schools** (about 17,800) are a separate file: see the next section.
- A few map-data entries whose names differ a lot from the Ministry's can still appear twice.

**A school that is not on any list** can always be added: on "Find your school" there is a "Cannot find it? Add your campus" link (always visible, and again when a search finds nothing). The school gives its kind (kindergarten, elementary, junior high, senior high, university, cram school, language school, international school, bilingual school or other), its name and its area. We never ask for a street address. An administrator checks every new school before it appears to anyone.

Browsing: "Find your school" can list every government school, private school, university, international or bilingual school, kindergarten or cram school, filtered by city, without typing a name.

## What is already loaded

About 5,480 schools (kindergartens, elementary to senior high, universities, language and international schools) came from the old site's dataset (run this first, then the Ministry import above), which was originally built from OpenStreetMap. They have exact coordinates and no contact details. `npm run db:import-schools` loads them.

Open licence point: OpenStreetMap data carries the ODbL licence. The school map already shows "School locations © OpenStreetMap contributors". Ask your lawyer to confirm the share-alike obligations before launch.

## Licensed cram schools (補習班)

Phase 1 needs the licensed cram schools too (about 17,800 in Taiwan). The Ministry of Education publishes them as open data: **全國立案短期補習班基本資料**, data.gov.tw dataset 16461 (https://data.gov.tw/dataset/16461), updated daily, 22 JSON files (one per city or county), licence **Government Open Data License v1**.

**You do not download or paste anything.** The importer fetches the files itself:

```bash
npm run db:import-cram -- --national --dry-run     # fetch and report, write nothing
npm run db:import-cram -- --national               # fetch and load
```

**Run it from a network in Taiwan** (your own computer on home or office internet, or the live server once it is in Taiwan or Japan). The Ministry's server (`bsb.kh.edu.tw`) refuses connections from the cloud environment this code was written in, so it could not be tried on the real files there. That is a limit of that environment, not of your data.

What it does:

1. Reads the list of files and their published row counts from data.gov.tw (and falls back to the known list of 22 files if that page cannot be reached). It only follows `https://` addresses on government (`.gov.tw` / `.edu.tw`) hosts.
2. Fetches each file politely (one at a time, retries with a pause). If **any** file fails it imports **nothing** and says which; run it again, or add `--allow-partial` to load what arrived.
3. Compares each file's row count with the published count and shows any that are far apart.
4. Prints how many it would import, why others were skipped (no name, no recognisable city and district, duplicate) and a few addresses it could not place. Read this before the real run.

Other ways in, if the Ministry's server is unreachable from where you are:

```bash
npm run db:import-cram -- --national --save-dir ./cram-raw --dry-run   # also keeps the raw files
npm run db:import-cram -- --dir ./cram-raw --dry-run                   # load from a folder of .json / .csv files
npm run db:import-cram -- --file cram-schools.csv [--encoding big5]    # a single file
```

**Not yet tried on the real files.** The column names used (地區縣市, 短期補習班名稱, 短期補習班類別, 地址) come from the dataset's published field list on data.gov.tw. If the real files use different key names, the importer stops and prints the column names it found; adding a name is a one-line change in `src/lib/import/cram.ts`. The published field list has no column that is clearly a registration number (the "主管機關文件單位代碼" column is not described, so it is deliberately **not** used as an id), so each school is identified by its name and district.

### What is kept and what is thrown away

| Kept | Read to find the district, then thrown away |
|---|---|
| Name, kind (cram school or language school), city, district | Street address, email address, phone number, owner's name, registration date |

We never store a street address (project rule), so the table's addresses are used only to work out the district.

### Pins are approximate

These tables have no coordinates. Each school is placed **inside its district**, spread out so pins do not pile up, and always in the same spot for the same school. Educators see the school's name, kind and district, never a street address, so this matches what the site promises. The pin for a cram school is not its exact location.

### Re-running

Running the import again updates the same schools (matched by name and district) and adds new ones. A school that has already been **claimed stays claimed**: the import never touches claim, membership or contact details. To take everything from this source back out, ask a developer to delete the organizations whose source is `gov_open_data` and that are still unclaimed.

### Licence

The dataset is published under the Government Open Data License v1 (http://data.gov.tw/license), which asks you to credit the source. Add a credit such as "Short-term tutoring school data: Ministry of Education open data (data.gov.tw)" next to the map attribution, and mention it to your lawyer.

## Demo data

For previews on a development machine only: `npm run db:seed-demo` adds 120 made-up educators and 60 job posts, and `npm run db:seed-demo -- --remove` takes them out again. **Never run the seed on the live site.**
