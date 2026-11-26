import { describe, expect, it } from "vitest";
import { cramKey, cramSourceId, mapHeaders, matchCity, planImport, reconcileExisting, rowsFromCsv, rowsFromObjects, staleListings, withCity, type ExistingCram } from "@/lib/import/cram";
import { CITY_SOURCES, DATASET_API, datasetDetailApi, fetchCityLists, fetchNational, isCityListSource, NATIONAL_DATASET_ID, portalCopies, type FetchFn } from "@/lib/import/cram-fetch";
import { kindFamily, levelOf, planDedupe, stemName, type DedupeRow } from "@/lib/import/dedupe";
import { cityOnly, ownershipFromName, planAfterSchool, planCommunityColleges, planMandarinCentres, planOpenUniversities, planSeminaries, planSpecialEducation, tableFromObjects, universityEnglishNames } from "@/lib/import/more";
import { cleanEnglishName, codeOfSourceId, parsePoint, planWikidata, type OrgForWikidata } from "@/lib/import/wikidata";

describe("cram schools from the cities' own lists", () => {
  it("recognises each city's column names", () => {
    expect(mapHeaders(["序號", "主管機關文件代碼", "補習班中文名稱", "補習班中文住址", "電話"])).toMatchObject({ name: 2, address: 3 });
    expect(mapHeaders(["c_schoolname", "district", "areacode", "address", "date"])).toMatchObject({ name: 0, district: 1, address: 3 });
    expect(mapHeaders(["補習班序號", "補習班班名", "補習班地址", "電話", "設立人"])).toMatchObject({ name: 1, address: 2 });
    // The authority's document code is still never taken for a registration number.
    expect(mapHeaders(["主管機關文件代碼"]).regNo).toBeUndefined();
  });

  it("places a row that does not name its city, once told which city the file is for", () => {
    const taipei = rowsFromCsv("補習班中文名稱,補習班中文住址,電話\n臺北市私立好學文理短期補習班,100中正區重慶南路1段43號5樓,(02)2365-0000\n").rows;
    // 中正區 exists in Taipei and in Keelung: without the city it cannot be placed.
    expect(planImport(taipei).records).toHaveLength(0);
    const plan = planImport(withCity(taipei, "taipei"));
    expect(plan.records).toHaveLength(1);
    expect(plan.records[0]).toMatchObject({ city: "taipei", district: "taipei:zhongzheng", type: "cram_school", source: "gov_open_data" });
    // Nothing but the name, kind, place and an id is kept: no address, no phone number.
    expect(Object.keys(plan.records[0]!).sort()).toEqual(["city", "countryCode", "district", "latitude", "longitude", "name", "source", "sourceId", "type"]);
    expect(JSON.stringify(plan.records[0])).not.toMatch(/重慶南路|2365/);
  });

  it("reads New Taipei, Tainan and Nantou rows", () => {
    const ntpc = withCity(rowsFromCsv("c_schoolname,district,areacode,address,date\n私立青子園文理技藝短期補習班,八里區,65000230,中山路2段283號,44413\n").rows, "new-taipei");
    expect(planImport(ntpc).records[0]).toMatchObject({ city: "new-taipei", district: "new-taipei:bali" });
    const tainan = withCity(rowsFromCsv("補習班中文名稱,補習班中文住址,電話\n臺南市私立艾卡美語短期補習班,730新營區中山路138之3號1樓,(06)6320000\n").rows, "tainan");
    expect(planImport(tainan).records[0]).toMatchObject({ city: "tainan", district: "tainan:xinying", type: "language_school" });
    const nantou = withCity(rowsFromObjects([{ 補習班班名: "私立孟坊美術短期補習班", 補習班地址: "540南投市三和一路64號", 設立人: "柯○嫻" }]).rows, "nantou");
    expect(planImport(nantou).records[0]).toMatchObject({ city: "nantou", district: "nantou:nantou" });
    expect(JSON.stringify(planImport(nantou).records)).not.toContain("柯");
  });

  it("gives a school the same id from a city list and from a national row, so it is never added twice", () => {
    const fromCity = planImport(withCity(rowsFromObjects([{ 補習班名稱: "臺中市私立白新文理短期補習班", 補習班地址: "臺中市中區綠川西街85號7樓之1" }]).rows, "taichung")).records[0]!;
    const fromNational = planImport(rowsFromObjects([{ 地區縣市: "臺中市", 短期補習班名稱: "臺中市私立白新文理短期補習班", 地址: "臺中市中區綠川西街85號" }]).rows).records[0]!;
    expect(fromCity.sourceId).toBe(fromNational.sourceId);
  });

  it("only follows links on the cities' own open-data sites", () => {
    expect(isCityListSource("https://data.taipei/api/dataset/x/resource/y/download")).toBe(true);
    expect(isCityListSource("http://data.taipei/x")).toBe(false);
    expect(isCityListSource("https://data.taipei.example.com/x")).toBe(false);
    expect(isCityListSource("https://evil.example/x")).toBe(false);
  });

  it("fetches each city's file from the link on data.gov.tw, falls back to the known address, and reports a failure", async () => {
    const [taipei, ntpc] = [CITY_SOURCES[0]!, CITY_SOURCES[1]!];
    const calls: string[] = [];
    const fetchFn: FetchFn = async (url) => {
      calls.push(url);
      const page = (u: string) => ({ ok: true, status: 200, text: async () => JSON.stringify({ result: { distribution: [{ resourceDownloadUrl: u, resourceFormat: "CSV" }] } }) });
      if (url.endsWith(`/dataset/${taipei.datasetId}`)) return page("https://data.taipei/new-address.csv");
      // New Taipei's page points somewhere that is not its own site: ignored, the known address is used.
      if (url.endsWith(`/dataset/${ntpc.datasetId}`)) return page("https://elsewhere.example/file.csv");
      if (url === "https://data.taipei/new-address.csv") return { ok: true, status: 200, text: async () => "﻿補習班中文名稱,補習班中文住址\n臺北市私立好學文理短期補習班,100中正區重慶南路1段43號\n" };
      return { ok: false, status: 503, text: async () => "" };
    };
    const res = await fetchCityLists({ fetchFn, sleep: async () => {}, attempts: 1 }, [taipei, ntpc]);
    expect(res.files.map((f) => f.source.city)).toEqual(["taipei"]);
    expect(res.files[0]!.text.startsWith("補習班中文名稱")).toBe(true);
    expect(res.failed).toHaveLength(1);
    expect(res.failed[0]!.url).toBe(ntpc.fallbackUrl);
    expect(calls).not.toContain("https://elsewhere.example/file.csv");
  });
});

describe("the national register, from anywhere", () => {
  const origin = (n: number) => `https://bsb.kh.edu.tw/afterschool/opendata/afterschool_json.jsp?city=${n}`;
  const copyUrl = (n: number) => `https://quality.data.gov.tw/dq_download_json.php?nid=16461&md5_url=${n}`;
  const listing = JSON.stringify({ result: { distribution: Array.from({ length: 12 }, (_, n) => ({ resourceDownloadUrl: origin(n), resourceFormat: "JSON", resourceAmount: 1, resourceDescription: `file ${n}` })) } });
  const detail = (hosts: (n: number) => string) => JSON.stringify({ payload: { resources: Array.from({ length: 12 }, (_, n) => ({ url: origin(n), quality_download: { json: hosts(n) }, quality_check_time: { date: n === 3 ? "2026-09-20 08:00:00.000000" : "2026-09-22 18:29:21.000000" } })) } });
  const rows = JSON.stringify([{ 地區縣市: "高雄市政府", 短期補習班名稱: "高雄市私立好學外語短期補習班", 地址: "三民區建興路357號1-2樓", 短期補習班類別: "外語類", 電子郵件: "someone@example.com" }]);
  const good = (text: string) => ({ ok: true, status: 200, text: async () => text });

  it("takes each file from data.gov.tw's own copy when the Ministry's server refuses, and says how old the copy is", async () => {
    const calls: string[] = [];
    const fetchFn: FetchFn = async (u) => {
      calls.push(u);
      if (u === DATASET_API) return good(listing);
      if (u === datasetDetailApi(NATIONAL_DATASET_ID)) return good(detail(copyUrl));
      if (u.startsWith("https://quality.data.gov.tw/")) return good(rows);
      throw Object.assign(new Error("fetch failed"), { cause: new Error("read ECONNRESET") });
    };
    const res = await fetchNational({ fetchFn, sleep: async () => {}, attempts: 1 });
    expect(res.files).toHaveLength(12);
    expect(res.failed).toHaveLength(0);
    expect(res.fromPortalCopy).toBe(12);
    expect(res.portalCopyDate).toBe("2026-09-20");
    // After two refusals in a row the Ministry's server is left alone.
    expect(calls.filter((c) => c.startsWith("https://bsb.kh.edu.tw/"))).toHaveLength(2);
  });

  it("does not follow a copy that is not on data.gov.tw's own server, and then reports the Ministry's refusal", async () => {
    const fetchFn: FetchFn = async (u) => {
      if (u === DATASET_API) return good(listing);
      if (u === datasetDetailApi(NATIONAL_DATASET_ID)) return good(detail((n) => `https://elsewhere.example/copy-${n}.json`));
      if (u.startsWith("https://elsewhere.example/")) return good(rows);
      throw Object.assign(new Error("fetch failed"), { cause: new Error("read ECONNRESET") });
    };
    const res = await fetchNational({ fetchFn, sleep: async () => {}, attempts: 1 });
    expect(res.files).toHaveLength(0);
    expect(res.failed).toHaveLength(12);
    expect(res.failed[0]!.error).toContain("ECONNRESET");
    expect((await portalCopies(NATIONAL_DATASET_ID, { fetchFn, sleep: async () => {}, attempts: 1, timeoutMs: 1000 })).size).toBe(0);
  });

  it("reads a national row: the city from the authority's name, the kind from the category, and no email", () => {
    const plan = planImport(rowsFromObjects(JSON.parse(rows) as Record<string, unknown>[]).rows);
    expect(plan.records[0]).toMatchObject({ city: "kaohsiung", district: "kaohsiung:sanmin", type: "language_school" });
    expect(JSON.stringify(plan.records)).not.toMatch(/example\.com|建興路/);
  });

  it("keeps a school whose address names the city but no district, at city level", () => {
    const plan = planImport(rowsFromObjects([{ 地區縣市: "新竹市政府", 短期補習班名稱: "新竹市私立山葉鴻韻音樂短期補習班", 地址: "新竹市復興路16-5號2-4樓" }]).rows);
    expect(plan.skipped.no_area).toBe(0);
    expect(plan.records[0]).toMatchObject({ city: "hsinchu-city", district: null });
    expect(plan.records[0]!.latitude).toBeGreaterThan(24.6);
    expect(matchCity({ address: "somewhere" })).toBeNull();
  });

  it("knows one school under the county's spelling and the register's spelling", () => {
    expect(cramKey("南投縣私立弘勵文理短期補習班")).toBe(cramKey("私立弘勵文理短期補習班"));
    expect(cramKey("智碩資優文教事業有限公司附設臺中市私立智碩語文短期補習班")).toBe(cramKey("智碩資優文教事業有限公司附設私立智碩語文短期補習班"));
    expect(cramSourceId("南投縣私立弘勵文理短期補習班", "nantou:nantou")).toBe(cramSourceId("私立弘勵文理短期補習班", "nantou:nantou"));
    expect(cramSourceId("私立弘勵文理短期補習班", "nantou:nantou")).not.toBe(cramSourceId("私立弘勵文理短期補習班", "nantou:caotun"));
  });

  it("brings earlier imports up to date instead of adding a school twice", () => {
    const now = cramSourceId("私立弘勵文理短期補習班", "nantou:nantou");
    const row = (o: Partial<ExistingCram> & { id: string }): ExistingCram => ({ name: "私立弘勵文理短期補習班", district: "nantou:nantou", sourceId: "gov-cram:0123456789abcdef", locked: false, ...o });
    // One listing with an old id: it takes today's id.
    expect(reconcileExisting([row({ id: "a" })])).toEqual({ reId: [{ id: "a", sourceId: now }], remove: [] });
    // Two spellings of one school: one is kept, the other removed.
    const two = reconcileExisting([row({ id: "a" }), row({ id: "b", name: "南投縣私立弘勵文理短期補習班", sourceId: now })]);
    expect(two).toEqual({ reId: [], remove: ["a"] });
    // A claimed listing is never removed, and it is the one that is kept.
    const claimed = reconcileExisting([row({ id: "a", locked: true }), row({ id: "b", sourceId: "gov-cram:fedcba9876543210" })]);
    expect(claimed.remove).toEqual(["b"]);
    expect(claimed.reId).toEqual([{ id: "a", sourceId: now }]);
    // A listing identified by a registration number is left alone.
    expect(reconcileExisting([row({ id: "a", sourceId: "gov-cram:府教社字第123號" })])).toEqual({ reId: [], remove: [] });
  });

  it("finds schools that left the register, never a claimed one", () => {
    const rowsNow: ExistingCram[] = [
      { id: "a", name: "仍在", district: "taipei:daan", sourceId: "gov-cram:aaaaaaaaaaaaaaaa", locked: false },
      { id: "b", name: "已停辦", district: "taipei:daan", sourceId: "gov-cram:bbbbbbbbbbbbbbbb", locked: false },
      { id: "c", name: "已停辦但已認領", district: "taipei:daan", sourceId: "gov-cram:cccccccccccccccc", locked: true },
    ];
    expect(staleListings(rowsNow, new Set(["gov-cram:aaaaaaaaaaaaaaaa"])).map((r) => r.id)).toEqual(["b"]);
  });
});

describe("the smaller official lists", () => {
  it("special-education schools keep the published address and website, never the phone or fax", () => {
    const plan = planSpecialEducation("縣市,學校,地址,電話,網址,傳真\n基隆市,國立基隆特殊教育學校,基隆市七堵區堵南街20號,(02)24526332,www.klses.kl.edu.tw/home,(02)24526341\n桃園市,桃園市立桃園特殊教育學校,桃園縣桃園市德壽街10號,(03)3647099,,\n");
    expect(plan.records).toHaveLength(2);
    expect(plan.records[0]).toMatchObject({ type: "special_education", ownership: "public", city: "keelung", district: "keelung:qidu", address: "基隆市七堵區堵南街20號", website: "http://www.klses.kl.edu.tw/home", source: "moe_open_data" });
    // An old-style address with no district we know: the school still appears, at city level.
    expect(plan.records[1]).toMatchObject({ city: "taoyuan", district: null });
    expect(JSON.stringify(plan.records)).not.toMatch(/2452|3647/);
  });

  it("community colleges: one per college, from the newest year, at its main site", () => {
    const csv = [
      "年度,期別,縣市別代碼,縣市別,社區大學名稱,據點名稱,據點地址",
      "108,春季班,63000,臺北市,臺北市松山社區大學,臺北市中崙高級中學,臺北市松山區八德路4段101號",
      "115,春季班,63000,臺北市,臺北市松山社區大學,西松國小,臺北市松山區三民路5號",
      "115,春季班,63000,臺北市,臺北市松山社區大學,校本部,臺北市松山區八德路4段101號",
      "115,秋季班,63000,臺北市,臺北市松山社區大學,校本部,臺北市松山區八德路4段101號",
      "115,春季班,66000,臺中市,臺中市山線社區大學,東勢高工,臺中市東勢區東關路6段1328號",
      "107,春季班,66000,臺中市,已停辦社區大學,某國小,臺中市東區某路1號",
    ].join("\n");
    const plan = planCommunityColleges(csv);
    expect(plan.records.map((r) => r.name).sort()).toEqual(["臺中市山線社區大學", "臺北市松山社區大學"]);
    expect(plan.records.find((r) => r.name === "臺北市松山社區大學")).toMatchObject({ type: "community_college", district: "taipei:songshan", address: "臺北市松山區八德路4段101號" });
  });

  it("Mandarin centres: the two-line name is joined and the contact details are dropped", () => {
    const csv = '單位名稱,網址,通訊地址,聯絡資料,縣市別代碼\n"國立中央大學\r\n語言中心",http://www.lc.ncu.edu.tw/main/clp/,桃園市中壢區中大路300號,"電話：+886-3-422-7151\r\nE-Mail：someone@ncu.edu.tw",68000\n';
    const plan = planMandarinCentres(csv);
    expect(plan.records[0]).toMatchObject({ name: "國立中央大學語言中心", type: "language_school", ownership: "public", city: "taoyuan", district: "taoyuan:zhongli", website: "http://www.lc.ncu.edu.tw/main/clp/" });
    expect(JSON.stringify(plan.records)).not.toMatch(/422-7151|someone@/);
  });

  it("seminaries and open universities come from the newest year; attached evening schools are left out", () => {
    const head = "學年度,代碼,學校名稱,公/私立,縣市名稱,地址,電話,網址\n";
    const sem = planSeminaries(head + "104,1R02,基督教台灣浸會神學院,私立,[32]臺北市,[110]臺北市信義區吳興街394巷1號,(02)27239500,http://www.tbts.edu.tw/\n115,1R02,基督教台灣浸會神學院,私立,[32]臺北市,[110]臺北市信義區吳興街394巷1號,(02)27239500,http://www.tbts.edu.tw/\n");
    expect(sem.records).toHaveLength(1);
    expect(sem.records[0]).toMatchObject({ type: "university", ownership: "private", district: "taipei:xinyi", address: "臺北市信義區吳興街394巷1號" });
    const open = planOpenUniversities(head + "115,0A01,國立空中大學,公立,[01]新北市,[247]新北市蘆洲區中正路172號,(02)22829355,http://www.nou.edu.tw\n115,0A08,虎尾科技大學附進修專校,公立,[09]雲林縣,[632]雲林縣虎尾鎮文化路64號,(05)6329643,\n");
    expect(open.records.map((r) => r.name)).toEqual(["國立空中大學"]);
  });

  it("after-school care centres are kept at district level, like cram schools, and an ended licence is left out", () => {
    const table = tableFromObjects([
      { 編號: "1", 行政區: "東區", 課照中心名稱: "臺中市私立育英兒童課後照顧服務中心", 地址: "臺中市東區東英二街20號", 電話: "04-22130453", 負責人: "郭○○", 立案狀態: "立案" },
      { 編號: "2", 行政區: "北區", 課照中心名稱: "臺中市私立已停辦兒童課後照顧服務中心", 地址: "臺中市北區育德路180號", 電話: "04-22033935", 負責人: "傅○○", 立案狀態: "停辦" },
    ]);
    const plan = planAfterSchool(table, "taichung");
    expect(plan.records).toHaveLength(1);
    expect(plan.records[0]).toMatchObject({ type: "after_school", city: "taichung", district: "taichung:east", address: null, website: null, source: "gov_open_data" });
    expect(JSON.stringify(plan.records)).not.toMatch(/東英二街|2213|郭/);
    // The national table names the city on each row.
    expect(planAfterSchool([["縣市", "名稱", "電話", "地址"], ["高雄市", "高雄市私立小樹兒童課後照顧服務中心", "07-0000000", "高雄市三民區民族一路1號"]]).records[0]).toMatchObject({ city: "kaohsiung", district: "kaohsiung:sanmin", address: null });
  });

  it("reads who runs a school from its name, and a city from any text", () => {
    expect(ownershipFromName("國立基隆特殊教育學校")).toBe("public");
    expect(ownershipFromName("臺北市立啟明學校")).toBe("public");
    expect(ownershipFromName("私立惠明盲校")).toBe("private");
    expect(ownershipFromName("逢甲大學華語文教學中心")).toBeNull();
    expect(cityOnly("台北市內湖路一段520號")).toBe("taipei");
    expect(cityOnly("somewhere else")).toBeNull();
  });

  it("takes the Ministry's English names for universities and puts right its misspelling of University", () => {
    const names = universityEnglishNames('序號,"學校\n代碼",公私立,體制,學校名稱,學校英文名稱,職稱,姓名\n1,1,公立,一般大學,國立政治大學,National Chengchi Universerity,校長,某某某\n2,2,公立,一般大學,國立清華大學,National Tsing Hua University,校長,某某某\n3,3,私立,一般大學,沒有英文名大學,,校長,某某某\n');
    expect(names.get("國立政治大學")).toBe("National Chengchi University");
    expect(names.get("國立清華大學")).toBe("National Tsing Hua University");
    expect(names.has("沒有英文名大學")).toBe(false);
    expect([...names.values()].join(" ")).not.toContain("某");
  });
});

describe("schools listed twice", () => {
  const row = (o: Partial<DedupeRow> & { id: string; name: string }): DedupeRow => ({ nameEn: null, website: null, type: "elementary", city: "taichung", latitude: 24.156, longitude: 120.691, source: "osm_import", ownership: null, locked: false, ...o });

  it("reduces the name on the gate and the official name to the same school name", () => {
    expect(stemName("天主教育仁小學")).toBe("育仁");
    expect(stemName("私立育仁國小")).toBe("育仁");
    expect(stemName("高雄市天主教道明高級中學")).toBe(stemName("天主教道明中學"));
    expect(levelOf("衛道中學")).toBe("M");
    expect(levelOf("私立衛道高中")).toBe("S");
    expect(kindFamily("junior_high")).toBe(kindFamily("senior_high"));
  });

  it("joins Yu-Jen: the official listing is kept and moved to the exact spot", () => {
    const official = row({ id: "moe", name: "私立育仁國小", source: "moe_open_data", ownership: "private", latitude: 24.1561, longitude: 120.6881 });
    const gate = row({ id: "osm", name: "天主教育仁小學", nameEn: "Yu Jen Catholic Elementary School" });
    const merges = planDedupe([official, gate]);
    expect(merges).toHaveLength(1);
    expect(merges[0]).toMatchObject({ keep: { id: "moe" }, remove: { id: "osm" }, moveTo: { latitude: 24.156, longitude: 120.691 } });
  });

  it("does not join a private and a government school that share a name", () => {
    const merges = planDedupe([
      row({ id: "a", name: "臺北市立文山幼兒園", type: "kindergarten", city: "taipei", source: "moe_open_data", ownership: "public" }),
      row({ id: "b", name: "私立文山幼兒園", type: "kindergarten", city: "taipei" }),
    ]);
    expect(merges).toHaveLength(0);
  });

  it("does not join different levels, bare brand names, or a name several schools answer to", () => {
    expect(planDedupe([row({ id: "a", name: "縣立自強高工", type: "senior_high", source: "moe_open_data", ownership: "public" }), row({ id: "b", name: "自強國中", type: "junior_high" })])).toHaveLength(0);
    expect(planDedupe([row({ id: "a", name: "新北市私立何嘉仁幼兒園", type: "kindergarten", source: "moe_open_data", ownership: "private" }), row({ id: "b", name: "何嘉仁", type: "kindergarten" })])).toHaveLength(0);
    expect(planDedupe([
      row({ id: "a", name: "市立中山國小", source: "moe_open_data", ownership: "public" }),
      row({ id: "c", name: "市立北區中山國小", source: "moe_open_data", ownership: "public" }),
      row({ id: "b", name: "中山小學" }),
    ])).toHaveLength(0);
  });

  it("accepts a plain …中學 for a junior or a senior high, and never removes a claimed listing", () => {
    const official = row({ id: "a", name: "私立衛道高中", type: "senior_high", source: "moe_open_data", ownership: "private" });
    expect(planDedupe([official, row({ id: "b", name: "衛道中學", type: "senior_high" })])).toHaveLength(1);
    expect(planDedupe([official, row({ id: "b", name: "衛道中學", type: "senior_high", locked: true })])).toHaveLength(0);
    // The same school in another city is somebody else.
    expect(planDedupe([official, row({ id: "b", name: "衛道中學", type: "senior_high", city: "tainan" })])).toHaveLength(0);
  });
});

describe("English names and positions from Wikidata", () => {
  const org = (o: Partial<OrgForWikidata> & { id: string }): OrgForWikidata => ({ name: "私立育仁國小", nameEn: null, city: "taichung", latitude: 24.1561, longitude: 120.6881, source: "moe_open_data", sourceId: "moe:elementary:191602", claimed: false, ...o });

  it("reads a position (longitude first) and refuses one outside Taiwan", () => {
    expect(parsePoint("Point(120.678104 24.135326)")).toEqual({ lng: 120.6781, lat: 24.13533 });
    expect(parsePoint("Point(2.35 48.85)")).toBeNull();
    expect(parsePoint("nonsense")).toBeNull();
  });

  it("accepts a real English name only", () => {
    expect(cleanEnglishName("Taipei Municipal Xisong Elementary School")).toBe("Taipei Municipal Xisong Elementary School");
    expect(cleanEnglishName("臺北市西松國小")).toBeNull();
    expect(cleanEnglishName("Xisong")).toBeNull();
    expect(cleanEnglishName("")).toBeNull();
  });

  it("finds the Ministry's code in our own id", () => {
    expect(codeOfSourceId("moe:elementary:191602")).toBe("191602");
    expect(codeOfSourceId("moe:kindergarten:191X77")).toBe("191X77");
    expect(codeOfSourceId("gov-cram:abc")).toBeNull();
    expect(codeOfSourceId(null)).toBeNull();
  });

  it("matches by code: names a school that has no English name and moves an approximate pin", () => {
    const wd = [{ code: "191602", zh: "臺中市私立育仁國民小學", en: "Yu Jen Catholic Elementary School", coord: "Point(120.69118 24.15661)" }];
    const plan = planWikidata([org({ id: "a" })], wd);
    expect(plan).toMatchObject({ named: 1, moved: 1 });
    expect(plan.updates[0]).toEqual({ id: "a", nameEn: "Yu Jen Catholic Elementary School", latitude: 24.15661, longitude: 120.69118 });
  });

  it("keeps an English name a school already has, never touches a claimed listing, and ignores a far-away position", () => {
    const wd = [{ code: "191602", zh: "臺中市私立育仁國民小學", en: "Another Name School", coord: "Point(121.60 25.05)" }];
    expect(planWikidata([org({ id: "a", nameEn: "Yu Jen School" })], wd).updates).toHaveLength(0);
    expect(planWikidata([org({ id: "a", claimed: true })], wd).updates).toHaveLength(0);
    // A listing from the map data is already exact: it may gain a name, never a new position.
    const fromMap = planWikidata([org({ id: "a", source: "osm_import", sourceId: "osm:1", name: "臺中市私立育仁國民小學" })], [{ ...wd[0]!, coord: "Point(120.69118 24.15661)" }]);
    expect(fromMap.updates).toEqual([{ id: "a", nameEn: "Another Name School" }]);
  });
});
