# Launch data: schools to show on the map

Educators are never imported: they create their own profile. What the site needs before launch is a list of **schools and cram schools**, so a school can find and claim its campus and educators can see where jobs are.

## What is already loaded

About 5,480 schools (kindergartens, elementary to senior high, universities, language and international schools) came from the old site's dataset, which was originally built from OpenStreetMap. They have exact coordinates and no contact details. `npm run db:import-schools` loads them.

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
