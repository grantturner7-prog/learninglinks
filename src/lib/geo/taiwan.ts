/** Taiwan geography. Stable keys are stored in the database; labels are shown in the UI. */

export interface GeoName {
  zh: string;
  en: string;
}
export interface City extends GeoName {
  key: string;
  /** Names an old-site / OSM dataset might use for this city, lowercase, for importing. */
  aliases: readonly string[];
}
export interface District extends GeoName {
  key: string;
  city: string;
}

export const CITIES: readonly City[] = [
  { key: "taipei", zh: "臺北市", en: "Taipei City", aliases: ["taipei", "taipei city", "臺北市", "台北市"] },
  { key: "new-taipei", zh: "新北市", en: "New Taipei City", aliases: ["new taipei", "new taipei city", "新北市"] },
  { key: "taoyuan", zh: "桃園市", en: "Taoyuan City", aliases: ["taoyuan", "taoyuan city", "桃園市"] },
  { key: "taichung", zh: "臺中市", en: "Taichung City", aliases: ["taichung", "taichung city", "臺中市", "台中市"] },
  { key: "tainan", zh: "臺南市", en: "Tainan City", aliases: ["tainan", "tainan city", "臺南市", "台南市"] },
  { key: "kaohsiung", zh: "高雄市", en: "Kaohsiung City", aliases: ["kaohsiung", "kaohsiung city", "高雄市"] },
  { key: "keelung", zh: "基隆市", en: "Keelung City", aliases: ["keelung", "keelung city", "基隆市"] },
  { key: "hsinchu-city", zh: "新竹市", en: "Hsinchu City", aliases: ["hsinchu", "hsinchu city", "新竹市"] },
  { key: "chiayi-city", zh: "嘉義市", en: "Chiayi City", aliases: ["chiayi", "chiayi city", "嘉義市"] },
  { key: "hsinchu-county", zh: "新竹縣", en: "Hsinchu County", aliases: ["hsinchu county", "新竹縣"] },
  { key: "miaoli", zh: "苗栗縣", en: "Miaoli County", aliases: ["miaoli", "miaoli county", "苗栗縣"] },
  { key: "changhua", zh: "彰化縣", en: "Changhua County", aliases: ["changhua", "changhua county", "彰化縣"] },
  { key: "nantou", zh: "南投縣", en: "Nantou County", aliases: ["nantou", "nantou county", "=nantou", "南投縣"] },
  { key: "yunlin", zh: "雲林縣", en: "Yunlin County", aliases: ["yunlin", "yunlin county", "雲林縣"] },
  { key: "chiayi-county", zh: "嘉義縣", en: "Chiayi County", aliases: ["chiayi county", "嘉義縣"] },
  { key: "pingtung", zh: "屏東縣", en: "Pingtung County", aliases: ["pingtung", "pingtung county", "屏東縣"] },
  { key: "yilan", zh: "宜蘭縣", en: "Yilan County", aliases: ["yilan", "yilan county", "宜蘭縣"] },
  { key: "hualien", zh: "花蓮縣", en: "Hualien County", aliases: ["hualien", "hualien county", "花蓮縣"] },
  { key: "taitung", zh: "臺東縣", en: "Taitung County", aliases: ["taitung", "taitung county", "臺東縣", "台東縣"] },
  { key: "penghu", zh: "澎湖縣", en: "Penghu County", aliases: ["penghu", "penghu county", "澎湖縣"] },
  { key: "kinmen", zh: "金門縣", en: "Kinmen County", aliases: ["kinmen", "kinmen county", "金門縣"] },
  { key: "lienchiang", zh: "連江縣", en: "Lienchiang County", aliases: ["lienchiang", "lienchiang county", "連江縣"] },
];

const d = (city: string, rows: ReadonlyArray<readonly [string, string, string]>): District[] =>
  rows.map(([slug, zh, en]) => ({ key: `${city}:${slug}`, city, zh, en }));

/**
 * Districts are listed for the four metros we launch in first (Taichung is the company's home).
 * Other cities are searchable at city level until their districts are added.
 */
export const DISTRICTS: readonly District[] = [
  ...d("taipei", [
    ["zhongzheng", "中正區", "Zhongzheng"], ["datong", "大同區", "Datong"], ["zhongshan", "中山區", "Zhongshan"],
    ["songshan", "松山區", "Songshan"], ["daan", "大安區", "Da'an"], ["wanhua", "萬華區", "Wanhua"],
    ["xinyi", "信義區", "Xinyi"], ["shilin", "士林區", "Shilin"], ["beitou", "北投區", "Beitou"],
    ["neihu", "內湖區", "Neihu"], ["nangang", "南港區", "Nangang"], ["wenshan", "文山區", "Wenshan"],
  ]),
  ...d("new-taipei", [
    ["banqiao", "板橋區", "Banqiao"], ["sanchong", "三重區", "Sanchong"], ["zhonghe", "中和區", "Zhonghe"],
    ["yonghe", "永和區", "Yonghe"], ["xinzhuang", "新莊區", "Xinzhuang"], ["xindian", "新店區", "Xindian"],
    ["shulin", "樹林區", "Shulin"], ["yingge", "鶯歌區", "Yingge"], ["sanxia", "三峽區", "Sanxia"],
    ["tamsui", "淡水區", "Tamsui"], ["xizhi", "汐止區", "Xizhi"], ["tucheng", "土城區", "Tucheng"],
    ["luzhou", "蘆洲區", "Luzhou"], ["wugu", "五股區", "Wugu"], ["taishan", "泰山區", "Taishan"],
    ["linkou", "林口區", "Linkou"], ["shenkeng", "深坑區", "Shenkeng"], ["shiding", "石碇區", "Shiding"],
    ["pinglin", "坪林區", "Pinglin"], ["sanzhi", "三芝區", "Sanzhi"], ["shimen", "石門區", "Shimen"],
    ["bali", "八里區", "Bali"], ["pingxi", "平溪區", "Pingxi"], ["shuangxi", "雙溪區", "Shuangxi"],
    ["gongliao", "貢寮區", "Gongliao"], ["jinshan", "金山區", "Jinshan"], ["wanli", "萬里區", "Wanli"],
    ["ruifang", "瑞芳區", "Ruifang"], ["wulai", "烏來區", "Wulai"],
  ]),
  ...d("taoyuan", [
    ["taoyuan", "桃園區", "Taoyuan"], ["zhongli", "中壢區", "Zhongli"], ["pingzhen", "平鎮區", "Pingzhen"],
    ["bade", "八德區", "Bade"], ["yangmei", "楊梅區", "Yangmei"], ["luzhu", "蘆竹區", "Luzhu"],
    ["dayuan", "大園區", "Dayuan"], ["guishan", "龜山區", "Guishan"], ["longtan", "龍潭區", "Longtan"],
    ["daxi", "大溪區", "Daxi"], ["guanyin", "觀音區", "Guanyin"], ["xinwu", "新屋區", "Xinwu"],
    ["fuxing", "復興區", "Fuxing"],
  ]),
  ...d("taichung", [
    ["central", "中區", "Central"], ["east", "東區", "East"], ["south", "南區", "South"],
    ["west", "西區", "West"], ["north", "北區", "North"], ["beitun", "北屯區", "Beitun"],
    ["xitun", "西屯區", "Xitun"], ["nantun", "南屯區", "Nantun"], ["taiping", "太平區", "Taiping"],
    ["dali", "大里區", "Dali"], ["wufeng", "霧峰區", "Wufeng"], ["wuri", "烏日區", "Wuri"],
    ["fengyuan", "豐原區", "Fengyuan"], ["houli", "后里區", "Houli"], ["shigang", "石岡區", "Shigang"],
    ["dongshi", "東勢區", "Dongshi"], ["heping", "和平區", "Heping"], ["xinshe", "新社區", "Xinshe"],
    ["tanzi", "潭子區", "Tanzi"], ["daya", "大雅區", "Daya"], ["shengang", "神岡區", "Shengang"],
    ["dadu", "大肚區", "Dadu"], ["shalu", "沙鹿區", "Shalu"], ["longjing", "龍井區", "Longjing"],
    ["wuqi", "梧棲區", "Wuqi"], ["qingshui", "清水區", "Qingshui"], ["dajia", "大甲區", "Dajia"],
    ["waipu", "外埔區", "Waipu"], ["daan", "大安區", "Da'an"],
  ]),
];

export const CITY_KEYS = CITIES.map((c) => c.key);
export const DISTRICT_KEYS = DISTRICTS.map((x) => x.key);
const cityByKey = new Map(CITIES.map((c) => [c.key, c]));
const districtByKey = new Map(DISTRICTS.map((x) => [x.key, x]));

export const isCityKey = (k: string): boolean => cityByKey.has(k);
export const isDistrictKey = (k: string): boolean => districtByKey.has(k);

/** Localised label for a city or district key. `locale` is any "xx-TW" locale. */
export function geoLabel(key: string, locale: string): string {
  const item = cityByKey.get(key) ?? districtByKey.get(key);
  if (!item) return key;
  return locale.startsWith("zh") ? item.zh : item.en;
}

export function districtsOfCity(cityKey: string): readonly District[] {
  return DISTRICTS.filter((x) => x.city === cityKey);
}

/** Map a free-text city name from an imported dataset to a city key. */
export function cityKeyFromName(name: string | null | undefined): string | null {
  if (!name) return null;
  const n = name.trim().toLowerCase();
  const hit = CITIES.find((c) => c.aliases.includes(n) || c.zh === name.trim());
  return hit?.key ?? null;
}
