# Launch data: schools to show on the map

Educators are never imported: they create their own profile. What the site needs before launch is a list of **schools and cram schools**, so a school can find and claim its campus and educators can see where jobs are.

## What is already loaded

About 5,480 schools (kindergartens, elementary to senior high, universities, language and international schools) came from the old site's dataset, which was originally built from OpenStreetMap. They have exact coordinates and no contact details. `npm run db:import-schools` loads them.

Open licence point: OpenStreetMap data carries the ODbL licence. The school map already shows "School locations © OpenStreetMap contributors". Ask your lawyer to confirm the share-alike obligations before launch.

## Licensed cram schools (補習班)

Phase 1 needs the licensed cram schools too (about 17,700 in Taiwan). The Ministry of Education publishes the registered short-term tutoring schools as open data. Find the current table by searching for 補習班 on data.gov.tw or on the Ministry's cram-school information site, and download it as CSV or JSON.

**Not yet tried on the real file.** The importer was built and tested on a small made-up table with the column names these tables usually use (補習班名稱, 立案字號, 班別, 縣市, 地址). The government sites could not be reached from where it was built, so run a **dry run** first and read the summary before writing anything.

```bash
npm run db:import-cram -- --file cram-schools.csv --dry-run
```

It prints how many rows it read, which columns it recognised, how many it would import, why others were skipped (no name, no recognisable city and district, duplicate) and a few addresses it could not place. If the file is Big5 (common for older government files) add `--encoding big5`. If a column is not recognised, tell a developer the header name; adding it is a one-line change in `src/lib/import/cram.ts`. When the summary looks right, run it again without `--dry-run`.

### What is kept and what is thrown away

| Kept | Read to find the district, then thrown away |
|---|---|
| Name, kind (cram school or language school), city, district, registration number (as an id) | Street address, phone number, owner's name |

We never store a street address (project rule), so the table's addresses are used only to work out the district.

### Pins are approximate

These tables have no coordinates. Each school is placed **inside its district**, spread out so pins do not pile up, and always in the same spot for the same school. Educators see the school's name, kind and district, never a street address, so this matches what the site promises. The pin for a cram school is not its exact location.

### Re-running

Running the import again updates the same schools (matched by registration number) and adds new ones. A school that has already been **claimed stays claimed**: the import never touches claim, membership or contact details. To take everything from this source back out, ask a developer to delete the organizations whose source is `gov_open_data` and that are still unclaimed.

### Licence

Government open data in Taiwan is usually published under the Government Open Data License, which asks you to credit the source. Check the licence shown on the dataset you download, add the credit it asks for (for example next to the map attribution), and mention it to your lawyer.

## Demo data

For previews on a development machine only: `npm run db:seed-demo` adds 120 made-up educators and 60 job posts, and `npm run db:seed-demo -- --remove` takes them out again. **Never run the seed on the live site.**
