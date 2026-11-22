/* ---------- fixed facts of the product (from CLAUDE.md) ---------- */
const PRICE_FAMILY = 2000;
const PRICE_CAMPUS = 10000;
const REVEAL_CAP = 100;

/* ---------- places ---------- */
const CITY = {
  taipei: ["Taipei City", "臺北市"], "new-taipei": ["New Taipei City", "新北市"], taoyuan: ["Taoyuan City", "桃園市"], taichung: ["Taichung City", "臺中市"],
  tainan: ["Tainan City", "臺南市"], kaohsiung: ["Kaohsiung City", "高雄市"], keelung: ["Keelung City", "基隆市"], "hsinchu-city": ["Hsinchu City", "新竹市"],
  "chiayi-city": ["Chiayi City", "嘉義市"], "hsinchu-county": ["Hsinchu County", "新竹縣"], miaoli: ["Miaoli County", "苗栗縣"], changhua: ["Changhua County", "彰化縣"],
  nantou: ["Nantou County", "南投縣"], yunlin: ["Yunlin County", "雲林縣"], "chiayi-county": ["Chiayi County", "嘉義縣"], pingtung: ["Pingtung County", "屏東縣"],
  yilan: ["Yilan County", "宜蘭縣"], hualien: ["Hualien County", "花蓮縣"], taitung: ["Taitung County", "臺東縣"], penghu: ["Penghu County", "澎湖縣"],
};
const DIST = {
  "taichung:xitun": ["Xitun", "西屯區"], "taichung:nantun": ["Nantun", "南屯區"], "taichung:beitun": ["Beitun", "北屯區"], "taichung:daya": ["Daya", "大雅區"], "taichung:fengyuan": ["Fengyuan", "豐原區"],
  "taipei:daan": ["Da'an", "大安區"], "taipei:xinyi": ["Xinyi", "信義區"], "taipei:neihu": ["Neihu", "內湖區"], "taipei:shilin": ["Shilin", "士林區"],
  "new-taipei:banqiao": ["Banqiao", "板橋區"], "new-taipei:zhonghe": ["Zhonghe", "中和區"], "new-taipei:xindian": ["Xindian", "新店區"],
  "taoyuan:zhongli": ["Zhongli", "中壢區"], "taoyuan:taoyuan": ["Taoyuan", "桃園區"],
  "kaohsiung:zuoying": ["Zuoying", "左營區"], "kaohsiung:sanmin": ["Sanmin", "三民區"],
  "tainan:east": ["East", "東區"], "tainan:anping": ["Anping", "安平區"],
  "hsinchu-city:east": ["East", "東區"], "changhua:city": ["Changhua City", "彰化市"],
};
const DEMO_CITIES = ["taichung", "taipei", "new-taipei", "taoyuan", "kaohsiung", "tainan", "hsinchu-city", "changhua"];
const distsOf = (city) => Object.keys(DIST).filter((k) => k.startsWith(city + ":"));

/* ---------- taxonomy ---------- */
const SUBJECT = {
  "english-conversation": ["English conversation", "英語會話"], phonics: ["Phonics", "自然發音"], mathematics: ["Mathematics", "數學"], science: ["Science", "自然科學"],
  mandarin: ["Mandarin", "華語"], music: ["Music", "音樂"], art: ["Art", "美術"], "test-prep-english": ["English test prep", "英語檢定準備"],
};
const LEVEL = { kindergarten: ["Kindergarten", "幼兒園"], elementary: ["Elementary", "國小"], "junior-high": ["Junior high", "國中"], "senior-high": ["Senior high", "高中"], adult: ["Adults", "成人"] };
const OPEN = { full_time: ["Full-time work", "全職工作"], part_time: ["Part-time work", "兼職工作"], private_tutoring: ["Private tutoring", "私人家教"] };
const KIND = { kindergarten: ["Kindergarten", "幼兒園"], elementary: ["Elementary school", "國小"], junior_high: ["Junior high school", "國中"], senior_high: ["Senior high school", "高中職"], university: ["University or college", "大專校院"], cram_school: ["Cram school", "補習班"], language_school: ["Language school", "語言學校"], international_school: ["International school", "國際學校"], bilingual_school: ["Bilingual school", "雙語學校"], other: ["Other", "其他"] };
/** Ways to browse the school list (the same groups the real site uses). */
const GROUPS = { public: ["Government schools", "公立學校"], private: ["Private schools", "私立學校"], university: ["Universities and colleges", "大專校院"], international: ["International and bilingual", "國際與雙語學校"], kindergarten: ["Kindergartens", "幼兒園"], cram: ["Cram and language schools", "補習班與語言學校"] };
const inGroup = (s, g) => g === "international" ? s.kind === "international_school" || s.kind === "bilingual_school" || !!st.bil[s.id] : g === "public" ? s.ownership === "public" : g === "private" ? s.ownership === "private" : g === "university" ? s.kind === "university" : g === "international" ? s.kind === "international_school" || s.kind === "bilingual_school" : g === "kindergarten" ? s.kind === "kindergarten" : g === "cram" ? s.kind === "cram_school" || s.kind === "language_school" : true;

/* ---------- fictional educators (made up for this demo; nobody real) ---------- */
let _seed = 7;
const rnd = () => ((_seed = (_seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = (a) => a[Math.floor(rnd() * a.length)];
const some = (a, n) => [...a].sort(() => rnd() - 0.5).slice(0, n);
const NAMES = ["Alex T.", "Brenda L.", "Chris W.", "Dana K.", "Emil H.", "Fiona C.", "Grace Y.", "Henry P.", "Iris M.", "Jack S.", "Kelly N.", "Leo R.", "Mia B.", "Noah D.", "Olivia F.", "Peter G.", "Quinn A.", "Rosa V.", "Sam J.", "Tina Z.", "Uma Q.", "Victor O.", "Wendy E.", "Xavier I.", "Yuki U.", "Zane H.", "Amy C.", "Ben L.", "Cora M.", "Dylan P.", "Elena S.", "Finn K.", "Gina T.", "Hugo L."];
const HEAD_T = { "english-conversation": "English conversation at your kitchen table", phonics: "Phonics and reading for young learners", mathematics: "Patient maths tutor for exam years", science: "Science made hands-on", mandarin: "Mandarin for beginners and newcomers", music: "Piano and music theory, step by step", art: "Creative art lessons for curious kids", "test-prep-english": "English test prep that builds confidence" };
const BIO = [
  "I keep lessons practical and friendly. I plan each term around what the learner wants to be able to do, and I send a short note to parents after each session.",
  "I have taught in Taiwan for several years. I like small groups, lots of speaking, and clear goals that students can see themselves reaching.",
  "I work calmly with beginners and shy learners. Expect games, songs and plenty of encouragement.",
  "I prepare students for school tests and certificates with weekly practice and honest feedback.",
];
const EDU = Array.from({ length: 34 }, (_, i) => {
  const city = DEMO_CITIES[[0, 0, 1, 2, 3, 0, 4, 5, 6, 7, 1, 0, 2, 0, 3, 0][i % 16]];
  const ds = distsOf(city);
  const kind = i % 3; // 0 tutoring only, 1 school work only, 2 both
  const openTo = kind === 0 ? ["private_tutoring"] : kind === 1 ? (i % 2 ? ["full_time", "part_time"] : ["full_time"]) : ["part_time", "private_tutoring"];
  const tut = openTo.includes("private_tutoring");
  return {
    id: "e" + (i + 1), name: NAMES[i % NAMES.length], city, district: ds.length ? ds[i % ds.length] : null, openTo,
    subjects: some(Object.keys(SUBJECT), 1 + (i % 3)), levels: some(Object.keys(LEVEL), 1 + (i % 2)), langs: i % 5 === 0 ? ["en", "zh"] : ["en"],
    exp: ["0-1", "2-4", "5-9", "10+"][i % 4], rateMin: tut ? 500 + (i % 5) * 100 : null, rateMax: tut ? 900 + (i % 5) * 100 : null,
    head: null, bio: BIO[i % BIO.length],
    wish: ["Kindergarten or cram school, from next term", "Elementary, 3 to 4 afternoons a week", "Language school, evenings", "Open to relocating within Taichung and Changhua"][i % 4],
    email: "teacher" + (i + 1) + "@example.invalid", line: "teacher" + (i + 1) + "-line", mine: false,
  };
});

EDU.forEach((e) => { const s0 = e.subjects[0]; e.head = e.openTo.includes("private_tutoring") ? HEAD_T[s0] : SUBJECT[s0][0] + " teacher, " + e.exp.replace("-", " to ").replace("+", " or more") + " years in Taiwan"; });

/* ---------- fictional schools and a few job posts ---------- */
const SCHOOL_ROWS = [
  ["Sunshine English Cram School", "cram_school", "taichung", "taichung:xitun"], ["Rainbow Kindergarten", "kindergarten", "taichung", "taichung:nantun"],
  ["Maple Language Centre", "language_school", "taichung", "taichung:beitun"], ["Harbour International School", "international_school", "taichung", "taichung:daya"],
  ["Little Bridge Kindergarten", "kindergarten", "taipei", "taipei:daan"], ["Brightside Cram School", "cram_school", "taipei", "taipei:neihu"],
  ["Orchard Elementary (private)", "elementary", "new-taipei", "new-taipei:banqiao"], ["Lantern Language School", "language_school", "new-taipei", "new-taipei:zhonghe"],
  ["Bamboo Cram School", "cram_school", "taoyuan", "taoyuan:zhongli"], ["Seed & Sprout Kindergarten", "kindergarten", "taoyuan", "taoyuan:taoyuan"],
  ["Pearl Language Centre", "language_school", "kaohsiung", "kaohsiung:zuoying"], ["Tidewater Cram School", "cram_school", "kaohsiung", "kaohsiung:sanmin"],
  ["Anping Kids Academy", "kindergarten", "tainan", "tainan:anping"], ["Old Town Cram School", "cram_school", "tainan", "tainan:east"],
  ["Science Park Bilingual School", "international_school", "hsinchu-city", "hsinchu-city:east"], ["Riverside Kindergarten", "kindergarten", "changhua", "changhua:city"],
];
const SCHOOLS = SCHOOL_ROWS.map((r, i) => ({ id: "s" + (i + 1), name: r[0], kind: r[1], ownership: "private", city: r[2], district: r[3], owner: null, seed: i * 37 + 11 }));

/* ---------- the Ministry of Education's school lists (government and private schools, universities, schools for international residents) ---------- */
REAL.cities.forEach(([k, en, zh]) => { if (!CITY[k]) CITY[k] = [en, zh]; });
REAL.dists.forEach(([k, en, zh]) => { if (!DIST[k]) DIST[k] = [en, zh]; });
const REAL_SCHOOLS = REAL.rows.map((r, i) => ({ id: "r" + i, name: r[0], kind: REAL.types[r[1]], ownership: r[2] === 1 ? "public" : r[2] === 2 ? "private" : null, city: REAL.cities[r[3]][0], district: r[4] >= 0 ? REAL.dists[r[4]][0] : null, real: true }));
const REAL_BY_ID = new Map(REAL_SCHOOLS.map((s) => ({ s })).map(({ s }) => [s.id, s]));
const SEED_JOBS = [
  { id: "j1", schoolId: "s1", title: "English teacher, afternoons", type: "part_time", subject: "english-conversation", desc: "Teach small groups of elementary students, Monday to Thursday, 3 to 7 pm. Materials provided.", contact: "hr@sunshine.example.invalid", status: "open" },
  { id: "j2", schoolId: "s2", title: "Kindergarten homeroom teacher", type: "full_time", subject: "phonics", desc: "Lead a bilingual class of 18. Start next term. Training provided.", contact: "jobs@rainbow.example.invalid", status: "open" },
  { id: "j3", schoolId: "s5", title: "After-school helper", type: "part_time", subject: "art", desc: "Help with homework and art activities, Tuesday and Friday.", contact: "hello@littlebridge.example.invalid", status: "open" },
  { id: "j4", schoolId: "s7", title: "Science teacher, junior high", type: "full_time", subject: "science", desc: "Full timetable of science classes for grades 7 to 9.", contact: "staff@orchard.example.invalid", status: "open" },
  { id: "j5", schoolId: "s11", title: "Evening English teacher", type: "part_time", subject: "english-conversation", desc: "Adult and teen conversation classes on weekday evenings.", contact: "teach@pearl.example.invalid", status: "open" },
  { id: "j6", schoolId: "s15", title: "Maths teacher, bilingual programme", type: "full_time", subject: "mathematics", desc: "Teach maths in English to grades 4 to 6.", contact: "careers@sciencepark.example.invalid", status: "open" },
];
