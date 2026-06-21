// Pipeline scraping berita kejahatan → koordinat → laporan di peta.
//
// Mode output:
//   node scripts/news-pipeline.mjs              → tulis ke src/data/newsReports.json
//   node scripts/news-pipeline.mjs --supabase   → UPSERT ke tabel public.reports (source='news')
//
// Alur: Google News RSS → klasifikasi (jenis+level) → ekstrak lokasi
//       (Groq Llama 3.3 bila GROQ_API_KEY ada, kalau tidak heuristik) → geocode (ORS)
//       → dedup + filter wilayah → output sesuai mode.
//
// Mode supabase butuh: EXPO_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
// Service-role key bypass RLS — wajib server-side only, JANGAN PERNAH di bundle app.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// --- konfigurasi ---
// Cakupan: seluruh Jabodetabek (Jakarta, Bogor, Depok, Tangerang, Bekasi).
const QUERIES = [
  // Jakarta (5 kota)
  'begal Jakarta',
  'jambret Jakarta',
  'curanmor Jakarta',
  'tawuran Jakarta',
  // Bogor (kota + kabupaten)
  'begal Bogor',
  'jambret Bogor',
  'tawuran Bogor',
  // Depok
  'begal Depok',
  'jambret Depok',
  'tawuran Depok',
  // Tangerang (kota + Tangsel + kabupaten)
  'begal Tangerang',
  'jambret Tangerang Selatan',
  'begal Pamulang',
  'tawuran Tangerang',
  'curanmor Tangerang',
  // Bekasi (kota + kabupaten)
  'begal Bekasi',
  'jambret Bekasi',
  'tawuran Bekasi',
  'curanmor Bekasi',
];
const FOCUS = { lat: -6.25, lon: 106.85 }; // pusat geografis Jabodetabek (Jakarta tengah)
// Bounding box Jabodetabek — selatan Bogor → utara Jakarta, barat Tangerang → timur Cikarang/Bekasi.
const BOUNDS = { minLat: -6.75, maxLat: -5.95, minLon: 106.45, maxLon: 107.20 };
const MAX_PER_QUERY = 6; // dikurangi sedikit karena query ber-19 (kuota Groq RPM)
const ADD_MAX_DAYS = 7; // hanya tandai berita ≤ 7 hari (biar fresh, tidak nyepam)
const KEEP_MAX_DAYS = 14; // berita ≥ 14 hari auto-hapus dari peta
const DAY_MS = 86_400_000;

// Kecamatan/area dikenal → kota induk. Dipakai heuristik fallback saat Groq gagal.
// Daftar prioritas (urutan match dari atas), sub-kota dulu sebelum kota umum.
const AREAS = [
  // Tangerang Selatan
  { name: 'Pamulang', city: 'Tangerang Selatan' },
  { name: 'Ciputat', city: 'Tangerang Selatan' },
  { name: 'Serpong', city: 'Tangerang Selatan' },
  { name: 'Pondok Aren', city: 'Tangerang Selatan' },
  { name: 'Setu', city: 'Tangerang Selatan' },
  { name: 'BSD', city: 'Tangerang Selatan' },
  { name: 'Bintaro', city: 'Tangerang Selatan' },
  { name: 'Pondok Cabe', city: 'Tangerang Selatan' },
  // Kota Tangerang + kabupaten
  { name: 'Cisauk', city: 'Tangerang' },
  { name: 'Pagedangan', city: 'Tangerang' },
  { name: 'Kelapa Dua', city: 'Tangerang' },
  { name: 'Curug', city: 'Tangerang' },
  { name: 'Cikupa', city: 'Tangerang' },
  { name: 'Cibodas', city: 'Tangerang' },
  { name: 'Karawaci', city: 'Tangerang' },
  { name: 'Cipondoh', city: 'Tangerang' },
  { name: 'Ciledug', city: 'Tangerang' },
  { name: 'Larangan', city: 'Tangerang' },
  { name: 'Neglasari', city: 'Tangerang' },
  { name: 'Batuceper', city: 'Tangerang' },
  { name: 'Benda', city: 'Tangerang' },
  { name: 'Periuk', city: 'Tangerang' },
  { name: 'Jatiuwung', city: 'Tangerang' },
  // Jakarta (5 kotamadya — match sub-area dulu, baru kota induk)
  { name: 'Menteng', city: 'Jakarta Pusat' },
  { name: 'Tanah Abang', city: 'Jakarta Pusat' },
  { name: 'Senen', city: 'Jakarta Pusat' },
  { name: 'Gambir', city: 'Jakarta Pusat' },
  { name: 'Kemayoran', city: 'Jakarta Pusat' },
  { name: 'Sawah Besar', city: 'Jakarta Pusat' },
  { name: 'Cempaka Putih', city: 'Jakarta Pusat' },
  { name: 'Johar Baru', city: 'Jakarta Pusat' },
  { name: 'Kebayoran Baru', city: 'Jakarta Selatan' },
  { name: 'Kebayoran Lama', city: 'Jakarta Selatan' },
  { name: 'Kemang', city: 'Jakarta Selatan' },
  { name: 'Tebet', city: 'Jakarta Selatan' },
  { name: 'Pasar Minggu', city: 'Jakarta Selatan' },
  { name: 'Pancoran', city: 'Jakarta Selatan' },
  { name: 'Cilandak', city: 'Jakarta Selatan' },
  { name: 'Jagakarsa', city: 'Jakarta Selatan' },
  { name: 'Mampang Prapatan', city: 'Jakarta Selatan' },
  { name: 'Pesanggrahan', city: 'Jakarta Selatan' },
  { name: 'Setiabudi', city: 'Jakarta Selatan' },
  { name: 'Pasar Rebo', city: 'Jakarta Timur' },
  { name: 'Cakung', city: 'Jakarta Timur' },
  { name: 'Cipayung', city: 'Jakarta Timur' },
  { name: 'Ciracas', city: 'Jakarta Timur' },
  { name: 'Duren Sawit', city: 'Jakarta Timur' },
  { name: 'Jatinegara', city: 'Jakarta Timur' },
  { name: 'Kramat Jati', city: 'Jakarta Timur' },
  { name: 'Makasar', city: 'Jakarta Timur' },
  { name: 'Matraman', city: 'Jakarta Timur' },
  { name: 'Pulo Gadung', city: 'Jakarta Timur' },
  { name: 'Tanjung Priok', city: 'Jakarta Utara' },
  { name: 'Kelapa Gading', city: 'Jakarta Utara' },
  { name: 'Penjaringan', city: 'Jakarta Utara' },
  { name: 'Cilincing', city: 'Jakarta Utara' },
  { name: 'Koja', city: 'Jakarta Utara' },
  { name: 'Pademangan', city: 'Jakarta Utara' },
  { name: 'Sunter', city: 'Jakarta Utara' },
  { name: 'Cengkareng', city: 'Jakarta Barat' },
  { name: 'Grogol Petamburan', city: 'Jakarta Barat' },
  { name: 'Grogol', city: 'Jakarta Barat' },
  { name: 'Kalideres', city: 'Jakarta Barat' },
  { name: 'Kebon Jeruk', city: 'Jakarta Barat' },
  { name: 'Kembangan', city: 'Jakarta Barat' },
  { name: 'Palmerah', city: 'Jakarta Barat' },
  { name: 'Taman Sari', city: 'Jakarta Barat' },
  { name: 'Tambora', city: 'Jakarta Barat' },
  // Bogor (kota + kabupaten)
  { name: 'Cibinong', city: 'Bogor' },
  { name: 'Cileungsi', city: 'Bogor' },
  { name: 'Cariu', city: 'Bogor' },
  { name: 'Parung', city: 'Bogor' },
  { name: 'Gunung Putri', city: 'Bogor' },
  { name: 'Ciawi', city: 'Bogor' },
  { name: 'Cisarua', city: 'Bogor' },
  { name: 'Sentul', city: 'Bogor' },
  { name: 'Bogor Tengah', city: 'Bogor' },
  { name: 'Bogor Selatan', city: 'Bogor' },
  { name: 'Bogor Utara', city: 'Bogor' },
  { name: 'Bogor Barat', city: 'Bogor' },
  { name: 'Bogor Timur', city: 'Bogor' },
  { name: 'Tanah Sareal', city: 'Bogor' },
  // Depok
  { name: 'Beji', city: 'Depok' },
  { name: 'Sukmajaya', city: 'Depok' },
  { name: 'Cimanggis', city: 'Depok' },
  { name: 'Tapos', city: 'Depok' },
  { name: 'Cinere', city: 'Depok' },
  { name: 'Limo', city: 'Depok' },
  { name: 'Sawangan', city: 'Depok' },
  { name: 'Bojongsari', city: 'Depok' },
  { name: 'Cilodong', city: 'Depok' },
  { name: 'Cipayung Depok', city: 'Depok' },
  { name: 'Margonda', city: 'Depok' },
  // Bekasi (kota + kabupaten)
  { name: 'Cikarang', city: 'Bekasi' },
  { name: 'Cibitung', city: 'Bekasi' },
  { name: 'Tambun', city: 'Bekasi' },
  { name: 'Pondok Gede', city: 'Bekasi' },
  { name: 'Jatiasih', city: 'Bekasi' },
  { name: 'Bekasi Barat', city: 'Bekasi' },
  { name: 'Bekasi Timur', city: 'Bekasi' },
  { name: 'Bekasi Utara', city: 'Bekasi' },
  { name: 'Bekasi Selatan', city: 'Bekasi' },
  { name: 'Medan Satria', city: 'Bekasi' },
  { name: 'Bantargebang', city: 'Bekasi' },
  { name: 'Rawalumbu', city: 'Bekasi' },
  { name: 'Mustika Jaya', city: 'Bekasi' },
  { name: 'Pondok Melati', city: 'Bekasi' },
  { name: 'Jatisampurna', city: 'Bekasi' },
  // Fallback umum (urutan terakhir — kalau spesifik area ga ke-match)
  { name: 'Tangerang Selatan', city: 'Tangerang Selatan' },
  { name: 'Tangsel', city: 'Tangerang Selatan' },
  { name: 'Kota Tangerang', city: 'Tangerang' },
  { name: 'Tangerang', city: 'Tangerang' },
  { name: 'Jakarta Pusat', city: 'Jakarta Pusat' },
  { name: 'Jakarta Selatan', city: 'Jakarta Selatan' },
  { name: 'Jakarta Timur', city: 'Jakarta Timur' },
  { name: 'Jakarta Utara', city: 'Jakarta Utara' },
  { name: 'Jakarta Barat', city: 'Jakarta Barat' },
  { name: 'Jakarta', city: 'Jakarta' },
  { name: 'Bogor', city: 'Bogor' },
  { name: 'Depok', city: 'Depok' },
  { name: 'Bekasi', city: 'Bekasi' },
];

const ORS_KEY = readEnv('EXPO_PUBLIC_ORS_API_KEY');
const GROQ_KEY = process.env.GROQ_API_KEY || readEnv('GROQ_API_KEY');
const SUPABASE_URL = readEnv('EXPO_PUBLIC_SUPABASE_URL');
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || readEnv('SUPABASE_SERVICE_ROLE_KEY');
const OUTPUT_MODE = process.argv.includes('--supabase') ? 'supabase' : 'json';

// --- util ---
function readEnv(key) {
  if (process.env[key]) return process.env[key];
  try {
    const env = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
    const m = env.match(new RegExp(`^${key}=(.*)$`, 'm'));
    return m ? m[1].trim().replace(/^['"]|['"]$/g, '') : '';
  } catch {
    return '';
  }
}
const pick = (block, tag) => (block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`)) || [, ''])[1];
const decode = (s) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/<[^>]+>/g, '').trim();
const round = (n, d = 3) => Math.round(n * 10 ** d) / 10 ** d;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const hasCrimeKeyword = (t) =>
  /begal|jambret|rampok|curanmor|curas|copet|tawuran|demo|unjuk rasa|pencurian|perampasan|kejahatan jalanan/i.test(t);

// Jarak haversine (meter) buat dedup proximity.
function haversineM(a, b) {
  const R = 6_371_000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Anggap event yang sama bila: kategori sama, lokasi < 1km, waktu < 48 jam.
// Cocok buat ngehandle "1 begal di-cover Kompas + Detik + IDN" dimana tiap source
// kasih wording lokasi beda (street vs kelurahan) → koordinat geser ratusan meter.
const DEDUP_RADIUS_M = 1000;
const DEDUP_WINDOW_MS = 48 * 60 * 60 * 1000;
function isSameEvent(a, b) {
  if (a.category !== b.category) return false;
  const dt = Math.abs(new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime());
  if (dt > DEDUP_WINDOW_MS) return false;
  return haversineM(a, b) < DEDUP_RADIUS_M;
}

const GROQ_MODEL = 'llama-3.3-70b-versatile'; // OP + free tier longgar
const GROQ_DELAY_MS = 2200; // jeda antar-call (Groq free ~30 RPM = 1 per 2s, beri margin)

// --- 1. fetch RSS ---
async function fetchRSS(query) {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=id&gl=ID&ceid=ID:id`;
  const res = await fetch(url);
  const xml = await res.text();
  const items = [];
  const re = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = re.exec(xml))) {
    const b = m[1];
    items.push({
      title: decode(pick(b, 'title')),
      link: decode(pick(b, 'link')),
      pubDate: pick(b, 'pubDate'),
      source: decode(pick(b, 'source')),
    });
  }
  return items;
}

// --- 1b. resolve Google News URL → URL artikel asli, lalu ambil isi body ---
async function resolveArticleUrl(googleUrl) {
  try {
    const id = googleUrl.match(/articles\/([^?]+)/)?.[1];
    if (!id) return null;
    const res = await fetch(googleUrl, { headers: { 'user-agent': 'Mozilla/5.0' } });
    const html = await res.text();
    const sg = html.match(/data-n-a-sg="([^"]+)"/)?.[1];
    const ts = html.match(/data-n-a-ts="([^"]+)"/)?.[1];
    if (!sg || !ts) return null;
    const payload = [
      [['Fbv4je', JSON.stringify(['garturlreq', [['X', 'X', ['X', 'X'], null, null, 1, 1, 'US:en', null, 1, null, null, null, null, null, 0, 1], 'X', 'X', 1, [1, 1, 1], 1, 1, null, 0, 0, null, 0], id, Number(ts), sg])]],
    ];
    const res2 = await fetch('https://news.google.com/_/DotsSplashUi/data/batchexecute', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: 'f.req=' + encodeURIComponent(JSON.stringify(payload)),
    });
    const text = await res2.text();
    return text.match(/https?:\/\/(?!news\.google)[^\\"]+/)?.[0] ?? null;
  } catch {
    return null;
  }
}

async function fetchArticleText(url) {
  try {
    const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' } });
    if (!res.ok) return '';
    const html = await res.text();
    const paras = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)].map((m) => m[1]);
    const text = decode(paras.join(' ') || html).replace(/\s+/g, ' ').trim();
    return text.slice(0, 2500);
  } catch {
    return '';
  }
}

// --- 2. klasifikasi (jenis + level) ---
function classify(title) {
  const t = title.toLowerCase();
  let category = null;
  let level = 0;
  if (/tawuran/.test(t)) (category = 'tawuran'), (level = 4);
  else if (/begal|rampok|curanmor|curas|perampasan/.test(t)) (category = 'pencurian'), (level = 4);
  else if (/jambret|copet|pencurian/.test(t)) (category = 'pencurian'), (level = 3);
  else if (/demo|unjuk rasa|demonstrasi/.test(t)) (category = 'demonstrasi'), (level = 2);
  if (!category) return null;
  if (/tewas|meninggal|tewaskan|fatal|sadis|bunuh|sajam|senjata/.test(t)) level = 5;
  return { category, level };
}

// --- 3. analisis (klasifikasi + lokasi) ---
// Pakai Groq (Llama 3.3 70B, gratis) bila ada key; kalau tidak, heuristik keyword + area.
async function analyze(title, body) {
  if (GROQ_KEY) {
    const a = await analyzeWithGroq(title, body);
    await sleep(GROQ_DELAY_MS); // jaga rate limit
    if (a && a.category && a.location) return a;
  }
  const cls = classify(title);
  if (!cls) return null;
  const location = extractHeuristic(`${title} ${body || ''}`);
  if (!location) return null;
  return { category: cls.category, level: cls.level, location };
}

async function analyzeWithGroq(title, body, attempt = 0) {
  const prompt =
    'Analisis berita Indonesia berikut. Jika ini insiden keamanan jalanan ' +
    '(begal, jambret, rampok, curanmor, tawuran, demonstrasi/unjuk rasa), ekstrak datanya. ' +
    'Jika BUKAN insiden dengan lokasi jelas, set category ke null.\n' +
    'Balas HANYA JSON dengan field: category, level, location.\n' +
    '- category: "pencurian" (begal/jambret/rampok/curanmor), "tawuran", "demonstrasi", "bahaya_jalan", atau null\n' +
    '- level: integer 1 (ringan) sampai 5 (fatal: ada korban jiwa / senjata tajam)\n' +
    '- location: lokasi PALING SPESIFIK TEMPAT KEJADIAN (TKP) yang bisa di-geocode. ' +
    'Utamakan jalan/kelurahan/kecamatan dari ISI berita, bukan cuma nama kota. ' +
    'ABAIKAN lokasi yang bukan TKP (asal pelaku, tempat barang dijual, kantor polisi). ' +
    'Format: "Kecamatan/Jalan, Kota, Indonesia". null bila benar-benar tidak jelas.\n\n' +
    `Judul: ${title}\n\nIsi: ${body ? body.slice(0, 1800) : '(tidak ada)'}`;
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { authorization: `Bearer ${GROQ_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: GROQ_MODEL,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (res.status === 429 && attempt < 3) {
      console.warn(`  ⏳ Groq rate limit, tunggu 15s lalu retry (${attempt + 1}/3)...`);
      await sleep(15000);
      return analyzeWithGroq(title, body, attempt + 1);
    }
    if (!res.ok) {
      console.warn('  ⚠️ Groq', res.status, (await res.text()).slice(0, 100), '— fallback heuristik');
      return null;
    }
    const json = await res.json();
    const text = json.choices?.[0]?.message?.content ?? '';
    const p = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? '{}');
    if (!p.category || p.category === 'null') return null;
    return { category: p.category, level: Math.min(5, Math.max(1, p.level || 3)), location: p.location };
  } catch (e) {
    console.warn('  ⚠️ Groq error', e.message);
    return null;
  }
}

function extractHeuristic(text) {
  // Cari area yang ke-match dulu — kota induknya buat anchor jalan & fallback.
  let matched = null;
  for (const a of AREAS) {
    if (new RegExp(`\\b${a.name}\\b`, 'i').test(text)) {
      matched = a;
      break;
    }
  }
  // Nama jalan — anchor ke kota yg ke-match (default Jakarta kalau ga ada).
  const jl = text.match(/\b(?:Jl\.?|Jalan)\s+([A-Z][\wÀ-ÿ.'-]+(?:\s+[A-Z][\wÀ-ÿ.'-]+){0,3})/);
  if (jl) {
    const city = matched?.city ?? 'Jakarta';
    return `Jl. ${jl[1].replace(/[.,;].*$/, '').trim()}, ${city}, Indonesia`;
  }
  if (matched) return `${matched.name}, ${matched.city}, Indonesia`;
  return null;
}

// --- 4. geocode (ORS) ---
async function geocode(text) {
  if (!ORS_KEY) return null;
  const url =
    'https://api.openrouteservice.org/geocode/search' +
    `?api_key=${encodeURIComponent(ORS_KEY)}&text=${encodeURIComponent(text)}` +
    `&boundary.country=ID&focus.point.lon=${FOCUS.lon}&focus.point.lat=${FOCUS.lat}&size=1`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const json = await res.json();
  const f = json.features?.[0];
  if (!f) return null;
  const [lon, lat] = f.geometry.coordinates;
  return { lat, lon, label: f.properties.label, layer: f.properties.layer };
}

// --- main ---
const TITLE = {
  pencurian: 'Begal / Pencurian',
  tawuran: 'Tawuran',
  demonstrasi: 'Demonstrasi',
  bahaya_jalan: 'Bahaya Jalan',
};

async function run() {
  if (!ORS_KEY) {
    console.error('❌ EXPO_PUBLIC_ORS_API_KEY tidak ditemukan (.env). Geocode butuh ini.');
    process.exit(1);
  }
  console.log(
    `🔑 ORS: ada · Groq: ${GROQ_KEY ? `ada (${GROQ_MODEL})` : 'tidak ada (pakai heuristik)'} · Output: ${OUTPUT_MODE}`
  );
  if (OUTPUT_MODE === 'supabase' && (!SUPABASE_URL || !SUPABASE_SERVICE_KEY)) {
    console.error('❌ Mode --supabase butuh EXPO_PUBLIC_SUPABASE_URL & SUPABASE_SERVICE_ROLE_KEY di .env');
    process.exit(1);
  }

  const seenTitles = new Set();
  const reports = [];
  let scanned = 0;
  let dupeSkipped = 0;

  // Tarik berita yg sudah ada di DB (≤48 jam terakhir) supaya dedup cross-run:
  // kalo kemarin sudah masuk dari Kompas, hari ini Detik nulis ulang, jangan masuk lagi.
  const existing = await fetchRecentExisting();
  if (existing.length) console.log(`📚 ${existing.length} berita lama (≤48j) buat anti-duplikat.`);

  for (const q of QUERIES) {
    let items = [];
    try {
      items = await fetchRSS(q);
    } catch (e) {
      console.warn(`  ⚠️ gagal fetch "${q}":`, e.message);
      continue;
    }
    for (const it of items.slice(0, MAX_PER_QUERY)) {
      const tkey = it.title.slice(0, 50).toLowerCase();
      if (seenTitles.has(tkey)) continue; // judul duplikat antar-query
      seenTitles.add(tkey);
      // Hanya berita ≤ ADD_MAX_DAYS (fresh, anti-spam).
      const pubMs = it.pubDate ? new Date(it.pubDate).getTime() : Date.now();
      if (Date.now() - pubMs > ADD_MAX_DAYS * DAY_MS) continue;
      // Pre-filter relevan sebelum resolve/fetch (mahal).
      if (!hasCrimeKeyword(it.title)) continue;
      scanned++;
      // Resolve URL asli + baca isi artikel → lokasi presisi.
      const articleUrl = (await resolveArticleUrl(it.link)) || it.link;
      const bodyText = articleUrl !== it.link ? await fetchArticleText(articleUrl) : '';
      const a = await analyze(it.title, bodyText);
      if (!a || !TITLE[a.category]) continue; // kategori harus valid
      const cls = { category: a.category, level: a.level };
      const geo = await geocode(a.location);
      if (!geo) continue;
      if (geo.lat < BOUNDS.minLat || geo.lat > BOUNDS.maxLat || geo.lon < BOUNDS.minLon || geo.lon > BOUNDS.maxLon)
        continue;

      const candidate = {
        category: cls.category,
        latitude: geo.lat,
        longitude: geo.lon,
        occurredAt: new Date(it.pubDate || Date.now()).toISOString(),
      };
      // Dedup proximity: 1 event = 1 marker, biar 3 outlet beritain hal sama
      // ga numpuk jadi 3 pin di lokasi yg sama.
      const dupeOf =
        reports.find((r) => isSameEvent(candidate, r)) ||
        existing.find((r) => isSameEvent(candidate, r));
      if (dupeOf) {
        dupeSkipped++;
        console.log(`  ⏭  dupe ${cls.category} @ ${geo.label} (sama event @ ${dupeOf.locationName || 'DB'})`);
        continue;
      }

      const precise = geo.layer === 'street' || geo.layer === 'address' || geo.layer === 'venue';
      reports.push({
        id: `news-${reports.length + 1}`,
        title: TITLE[cls.category],
        category: cls.category,
        level: cls.level,
        latitude: round(geo.lat, 5),
        longitude: round(geo.lon, 5),
        locationName: geo.label,
        description: it.title,
        occurredAt: new Date(it.pubDate || Date.now()).toISOString(),
        reporterName: it.source || 'Berita',
        evidence: [{ id: `nev-${reports.length + 1}`, type: 'link', url: articleUrl }],
        confirmations: 5,
        comments: 0,
        likes: 0,
        trusted: true, // sumber berita kredibel → auto-trusted
        source: 'news',
        sourceUrl: articleUrl, // URL artikel asli (Kompas/IDN/dll, bukan redirect Google)
        locationConfidence: precise ? 'tinggi' : 'sedang',
      });
      console.log(`  ✓ ${cls.category} L${cls.level} @ ${geo.label} (${geo.layer})`);
    }
  }

  if (OUTPUT_MODE === 'supabase') {
    await writeToSupabase(reports, scanned, dupeSkipped);
  } else {
    await writeToJson(reports, scanned, dupeSkipped);
  }
}

async function writeToJson(reports, scanned, dupeSkipped = 0) {
  const out = path.join(ROOT, 'src/data/newsReports.json');
  // Gabung dengan berita lama yang masih < KEEP_MAX_DAYS; yang ≥ 14 hari auto-hapus.
  let existing = [];
  try {
    existing = JSON.parse(fs.readFileSync(out, 'utf8'));
  } catch {
    existing = [];
  }
  const now = Date.now();
  const newKeys = new Set(reports.map((r) => `${round(r.latitude)},${round(r.longitude)}`));
  const expired = existing.filter((r) => now - new Date(r.occurredAt).getTime() >= KEEP_MAX_DAYS * DAY_MS);
  const kept = existing.filter(
    (r) =>
      now - new Date(r.occurredAt).getTime() < KEEP_MAX_DAYS * DAY_MS &&
      !newKeys.has(`${round(r.latitude)},${round(r.longitude)}`)
  );

  const merged = [...reports, ...kept];
  merged.forEach((r, i) => (r.id = `news-${i + 1}`)); // id unik & stabil
  fs.writeFileSync(out, JSON.stringify(merged, null, 2) + '\n');

  console.log(
    `\n📰 [JSON] ${reports.length} baru (dari ${scanned} artikel ≤${ADD_MAX_DAYS}h, ${dupeSkipped} dupe di-skip) + ` +
      `${kept.length} lama dipertahankan, ${expired.length} kedaluwarsa dihapus → total ${merged.length} → ${path.relative(ROOT, out)}`
  );
}

async function writeToSupabase(reports, scanned, dupeSkipped = 0) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ Mode --supabase butuh EXPO_PUBLIC_SUPABASE_URL & SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }
  if (!reports.length) {
    console.log('\n📰 [Supabase] Tidak ada berita baru ditemukan.');
    await pruneExpiredOnSupabase();
    return;
  }

  // Mapping camelCase (pipeline) → snake_case (kolom DB).
  const rows = reports.map((r) => ({
    title: r.title,
    category: r.category,
    level: r.level,
    latitude: r.latitude,
    longitude: r.longitude,
    location_name: r.locationName ?? '',
    description: r.description ?? '',
    occurred_at: r.occurredAt,
    reporter_id: null, // berita → bukan user
    reporter_name: r.reporterName ?? 'Berita',
    confirmations: r.confirmations ?? 5,
    trusted: true,
    source: 'news',
    source_url: r.sourceUrl,
    location_confidence: r.locationConfidence ?? 'sedang',
  }));

  // UPSERT pakai unique index partial pada (source_url) where source='news'.
  // Header Prefer:resolution=merge-duplicates → kalau source_url tabrakan, update kolom yg dikirim.
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/reports?on_conflict=source_url`,
    {
      method: 'POST',
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=representation',
      },
      body: JSON.stringify(rows),
    }
  );
  if (!res.ok) {
    console.error('❌ Supabase UPSERT gagal:', res.status, await res.text());
    process.exit(1);
  }
  const inserted = await res.json();
  console.log(
    `\n📰 [Supabase] ${inserted.length} baris di-UPSERT dari ${scanned} artikel ≤${ADD_MAX_DAYS}h (${dupeSkipped} dupe di-skip).`
  );

  await pruneExpiredOnSupabase();
}

// Ambil berita dari sumber output saat ini (Supabase atau JSON) dalam window
// dedup → dipakai buat cek "udah pernah masuk belum" lintas run.
async function fetchRecentExisting() {
  const cutoffMs = Date.now() - DEDUP_WINDOW_MS;
  if (OUTPUT_MODE === 'supabase') {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return [];
    try {
      const cutoffIso = new Date(cutoffMs).toISOString();
      const url =
        `${SUPABASE_URL}/rest/v1/reports` +
        `?source=eq.news&occurred_at=gte.${encodeURIComponent(cutoffIso)}` +
        `&select=category,latitude,longitude,occurred_at,location_name`;
      const res = await fetch(url, {
        headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
      });
      if (!res.ok) return [];
      const rows = await res.json();
      return rows.map((r) => ({
        category: r.category,
        latitude: r.latitude,
        longitude: r.longitude,
        occurredAt: r.occurred_at,
        locationName: r.location_name,
      }));
    } catch {
      return [];
    }
  }
  // Mode JSON: baca file existing
  try {
    const file = path.join(ROOT, 'src/data/newsReports.json');
    const arr = JSON.parse(fs.readFileSync(file, 'utf8'));
    return arr
      .filter((r) => new Date(r.occurredAt).getTime() >= cutoffMs)
      .map((r) => ({
        category: r.category,
        latitude: r.latitude,
        longitude: r.longitude,
        occurredAt: r.occurredAt,
        locationName: r.locationName,
      }));
  } catch {
    return [];
  }
}

async function pruneExpiredOnSupabase() {
  const cutoff = new Date(Date.now() - KEEP_MAX_DAYS * DAY_MS).toISOString();
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/reports?source=eq.news&occurred_at=lt.${encodeURIComponent(cutoff)}`,
    {
      method: 'DELETE',
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        Prefer: 'return=representation',
      },
    }
  );
  if (!res.ok) {
    console.warn('⚠️ Prune kedaluwarsa gagal:', res.status, await res.text());
    return;
  }
  const deleted = await res.json();
  if (deleted.length) {
    console.log(`🧹 ${deleted.length} berita ≥${KEEP_MAX_DAYS}h kedaluwarsa dihapus.`);
  }
}

run();
