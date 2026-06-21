import { Report } from '../types';

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface RouteStep {
  instruction: string;
  distanceM: number;
  location: LatLng;
}

export interface RouteResult {
  coordinates: LatLng[];
  distanceKm: number;
  durationMin: number;
  safetyScore: number;
  steps: RouteStep[];
}

const ORS_KEY = process.env.EXPO_PUBLIC_ORS_API_KEY ?? '';
const ORS_URL = 'https://api.openrouteservice.org/v2/directions/driving-car/geojson';
const GOOGLE_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY ?? '';

const GEOCODE_FOCUS: LatLng = { latitude: -6.343, longitude: 106.737 };

export interface Place extends LatLng {
  label: string;
  // Google Autocomplete hits punya placeId tapi koordinat 0; harus resolvePlace dulu.
  placeId?: string;
}

export async function searchPlaces(query: string): Promise<Place[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  if (GOOGLE_KEY) {
    const g = await googleAutocomplete(q);
    if (g.length) return g;
  }
  return orsAutocomplete(q);
}

async function googleAutocomplete(q: string): Promise<Place[]> {
  try {
    const res = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_KEY,
      },
      body: JSON.stringify({
        input: q,
        locationBias: {
          circle: {
            center: { latitude: GEOCODE_FOCUS.latitude, longitude: GEOCODE_FOCUS.longitude },
            radius: 50000,
          },
        },
        includedRegionCodes: ['id'],
        languageCode: 'id',
      }),
    });
    if (!res.ok) {
      console.warn('[routing] google autocomplete', res.status, await res.text());
      return [];
    }
    const json = await res.json();
    type Sugg = {
      placePrediction?: {
        placeId: string;
        text?: { text: string };
        structuredFormat?: { mainText?: { text: string }; secondaryText?: { text: string } };
      };
    };
    return ((json.suggestions ?? []) as Sugg[])
      .filter((s): s is { placePrediction: NonNullable<Sugg['placePrediction']> } => !!s.placePrediction)
      .slice(0, 8)
      .map((s) => {
        const pp = s.placePrediction;
        const main = pp.structuredFormat?.mainText?.text;
        const sec = pp.structuredFormat?.secondaryText?.text;
        const label = main && sec ? `${main}, ${sec}` : main ?? pp.text?.text ?? 'Tanpa nama';
        return { label, placeId: pp.placeId, latitude: 0, longitude: 0 };
      });
  } catch (e) {
    console.warn('[routing] google autocomplete gagal', e);
    return [];
  }
}

async function orsAutocomplete(q: string): Promise<Place[]> {
  if (!ORS_KEY) return [];
  try {
    const url =
      'https://api.openrouteservice.org/geocode/autocomplete' +
      `?api_key=${encodeURIComponent(ORS_KEY)}` +
      `&text=${encodeURIComponent(q)}` +
      '&boundary.country=ID' +
      `&focus.point.lon=${GEOCODE_FOCUS.longitude}&focus.point.lat=${GEOCODE_FOCUS.latitude}` +
      '&size=8';
    const res = await fetch(url);
    if (!res.ok) return [];
    const json = await res.json();
    return (json.features ?? []).map((f: { properties: { label: string }; geometry: { coordinates: number[] } }) => ({
      label: f.properties.label,
      longitude: f.geometry.coordinates[0],
      latitude: f.geometry.coordinates[1],
    }));
  } catch (e) {
    console.warn('[routing] ORS geocode gagal', e);
    return [];
  }
}

export async function resolvePlace(p: Place): Promise<Place | null> {
  if (!p.placeId) return p;
  if (!GOOGLE_KEY) return null;
  try {
    const res = await fetch(
      `https://places.googleapis.com/v1/places/${encodeURIComponent(p.placeId)}?languageCode=id`,
      {
        headers: {
          'X-Goog-Api-Key': GOOGLE_KEY,
          'X-Goog-FieldMask': 'location,formattedAddress,displayName',
        },
      }
    );
    if (!res.ok) {
      console.warn('[routing] google place details', res.status, await res.text());
      return null;
    }
    const json = await res.json();
    const loc = json.location;
    if (!loc) return null;
    return {
      label: json.formattedAddress ?? json.displayName?.text ?? p.label,
      latitude: loc.latitude,
      longitude: loc.longitude,
    };
  } catch (e) {
    console.warn('[routing] google place details gagal', e);
    return null;
  }
}

export async function reverseGeocode(point: LatLng): Promise<string> {
  if (GOOGLE_KEY) {
    try {
      const url =
        'https://maps.googleapis.com/maps/api/geocode/json' +
        `?latlng=${point.latitude},${point.longitude}` +
        '&language=id' +
        `&key=${encodeURIComponent(GOOGLE_KEY)}`;
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        const addr = json.results?.[0]?.formatted_address;
        if (addr) return addr;
      }
    } catch {
      // fall through
    }
  }
  if (ORS_KEY) {
    try {
      const url =
        'https://api.openrouteservice.org/geocode/reverse' +
        `?api_key=${encodeURIComponent(ORS_KEY)}` +
        `&point.lon=${point.longitude}&point.lat=${point.latitude}` +
        '&boundary.country=ID' +
        '&size=1';
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        const label = json.features?.[0]?.properties?.label;
        if (label) return label;
      }
    } catch {
      // fall through
    }
  }
  return 'Lokasi Saya';
}

// Skala level: 3 = begal kendaraan, 4 = + kekerasan, 5 = fatal.
export const AVOID_MIN_LEVEL_SAFEST = 3;
export const AVOID_MIN_LEVEL_CAUTION = 4;

// Radius zona-hindari (meter) menurut level. L3=240, L4=290, L5=340 —
// kira-kira ukuran satu blok jalan kota.
export function dangerRadiusM(level: number): number {
  return 90 + level * 50;
}

export function avoidableReports(reports: Report[], minLevel: number): Report[] {
  return reports.filter((r) => r.trusted && r.level >= minLevel);
}

const DEG_LAT_M = 111_320;
const DAY_MS = 86_400_000;
const POLY_SIDES = 12;
const toRad = (d: number) => (d * Math.PI) / 180;

function haversine(a: LatLng, b: LatLng): number {
  const R = 6_371_000;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Kejadian ≤14 hari = bobot penuh, >180 hari = 0.35 (tetap dihitung).
function recencyWeight(occurredAt?: string): number {
  if (!occurredAt) return 0.6;
  const age = (Date.now() - new Date(occurredAt).getTime()) / DAY_MS;
  if (!Number.isFinite(age) || age < 0) return 1;
  if (age <= 14) return 1;
  if (age >= 180) return 0.35;
  return 1 - (0.65 * (age - 14)) / (180 - 14);
}

// Vertex di-skala 1/cos(π/n) supaya poligon circumscribed (melingkupi penuh
// radius), bukan inscribed — kalau inscribed area terlindunginya lebih kecil.
function circlePolygon(lat: number, lng: number, radiusM: number): number[][] {
  const r = radiusM / Math.cos(Math.PI / POLY_SIDES);
  const dLat = r / DEG_LAT_M;
  const dLng = r / (DEG_LAT_M * Math.cos(toRad(lat)));
  const ring: number[][] = [];
  for (let i = 0; i <= POLY_SIDES; i++) {
    const a = (i / POLY_SIDES) * 2 * Math.PI;
    ring.push([lng + dLng * Math.cos(a), lat + dLat * Math.sin(a)]);
  }
  return ring;
}

export function buildDangerPolygons(
  reports: Report[],
  near?: { origin: LatLng; dest: LatLng },
  minLevel = AVOID_MIN_LEVEL_SAFEST
): number[][][][] {
  return avoidableReports(reports, minLevel)
    // Skip zona yang menutup origin/dest, rute jadi mustahil di-resolve.
    .filter(
      (r) =>
        !near ||
        (haversine(r, near.origin) > 500 && haversine(r, near.dest) > 500)
    )
    .map((r) => [circlePolygon(r.latitude, r.longitude, dangerRadiusM(r.level))]);
}

function routeSafetyScore(coords: LatLng[], reports: Report[]): number {
  let penalty = 0;
  for (const r of reports) {
    if (!r.trusted) continue;
    let min = Infinity;
    for (const c of coords) {
      const d = haversine(r, c);
      if (d < min) min = d;
    }
    const radius = dangerRadiusM(r.level);
    const w = r.level * recencyWeight(r.occurredAt);
    if (min <= radius) penalty += 2.0 * w;
    else if (min <= radius + 250) penalty += 0.8 * w;
    else if (min <= radius + 600) penalty += 0.3 * w;
  }
  return Math.max(0, Math.min(100, Math.round(100 - penalty)));
}

type RoutePreference = 'recommended' | 'shortest';

async function orsRoute(
  origin: LatLng,
  dest: LatLng,
  avoid?: number[][][][],
  preference: RoutePreference = 'recommended'
): Promise<Omit<RouteResult, 'safetyScore'> | null> {
  if (!ORS_KEY) return null;
  try {
    // ORS tidak punya profil motor; driving-car + skip tol/ferry mendekati
    // jaringan jalan motor matic di Indonesia.
    const options: Record<string, unknown> = { avoid_features: ['tollways', 'ferries'] };
    if (avoid && avoid.length) {
      options.avoid_polygons = { type: 'MultiPolygon', coordinates: avoid };
    }
    const body: Record<string, unknown> = {
      coordinates: [
        [origin.longitude, origin.latitude],
        [dest.longitude, dest.latitude],
      ],
      preference,
      options,
      instructions: true,
      language: 'id',
    };
    const res = await fetch(ORS_URL, {
      method: 'POST',
      headers: { Authorization: ORS_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.warn('[routing] ORS error', res.status, await res.text());
      return null;
    }
    const json = await res.json();
    const feat = json.features?.[0];
    if (!feat) return null;
    const coordinates: LatLng[] = feat.geometry.coordinates.map(
      ([lng, lat]: number[]) => ({ latitude: lat, longitude: lng })
    );
    const steps: RouteStep[] = [];
    for (const seg of feat.properties.segments ?? []) {
      for (const st of seg.steps ?? []) {
        const idx = st.way_points?.[0] ?? 0;
        const pt = coordinates[idx] ?? coordinates[0];
        steps.push({ instruction: st.instruction, distanceM: st.distance, location: pt });
      }
    }
    const s = feat.properties.summary;
    return { coordinates, distanceKm: s.distance / 1000, durationMin: s.duration / 60, steps };
  } catch (e) {
    console.warn('[routing] ORS fetch gagal', e);
    return null;
  }
}

export interface ThreeRoutes {
  teraman: RouteResult; // hindari semua begal/tawuran (≥3)
  waspada: RouteResult; // hindari yang disertai kekerasan/fatal (≥4)
  risiko: RouteResult; // tercepat, menembus zona
}

function withScore(raw: Omit<RouteResult, 'safetyScore'>, reports: Report[]): RouteResult {
  return { ...raw, safetyScore: routeSafetyScore(raw.coordinates, reports) };
}

// Batas atas seberapa jauh hasil avoid boleh dibanding rute shortest tanpa
// avoid. Lewat batas → fall back ke level penghindaran di bawahnya supaya
// rute tetap realistis untuk dipakai.
const DETOUR_BUDGET_TERAMAN = 1.4;
const DETOUR_BUDGET_WASPADA = 1.3;

export async function getThreeRoutes(
  origin: LatLng,
  dest: LatLng,
  reports: Report[]
): Promise<ThreeRoutes | null> {
  // ORS reject request > 6000 km — skip langsung biar gak nge-spam error 400.
  if (haversine(origin, dest) > 5_000_000) return null;
  const safest = buildDangerPolygons(reports, { origin, dest }, AVOID_MIN_LEVEL_SAFEST);
  const caution = buildDangerPolygons(reports, { origin, dest }, AVOID_MIN_LEVEL_CAUTION);
  const [teramanRaw, waspadaRaw, risikoRaw] = await Promise.all([
    orsRoute(origin, dest, safest.length ? safest : undefined, 'recommended'),
    orsRoute(origin, dest, caution.length ? caution : undefined, 'shortest'),
    orsRoute(origin, dest, undefined, 'shortest'),
  ]);

  if (!risikoRaw) return null;

  const baseKm = risikoRaw.distanceKm;

  const waspadaPick =
    waspadaRaw && waspadaRaw.distanceKm <= baseKm * DETOUR_BUDGET_WASPADA
      ? waspadaRaw
      : risikoRaw;
  const teramanPick =
    teramanRaw && teramanRaw.distanceKm <= baseKm * DETOUR_BUDGET_TERAMAN
      ? teramanRaw
      : waspadaPick;

  const teraman = withScore(teramanPick, reports);
  const waspada = withScore(waspadaPick, reports);
  const risiko = withScore(risikoRaw, reports);

  // Paksa Teraman ≥ Waspada ≥ Risiko supaya badge skor selaras dengan label.
  waspada.safetyScore = Math.min(waspada.safetyScore, teraman.safetyScore);
  risiko.safetyScore = Math.min(risiko.safetyScore, waspada.safetyScore);

  return { teraman, waspada, risiko };
}
