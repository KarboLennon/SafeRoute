import { DangerLevel } from '../types';

// Metadata tiap level bahaya: label, warna marker/heatmap, bobot heatmap.
export const DANGER_LEVELS: Record<
  DangerLevel,
  { label: string; color: string; weight: number }
> = {
  1: { label: 'Mencurigakan', color: '#FBBF24', weight: 0.2 },
  2: { label: 'Pencurian ringan', color: '#FB923C', weight: 0.4 },
  3: { label: 'Begal kendaraan', color: '#F97316', weight: 0.6 },
  4: { label: 'Begal + kekerasan', color: '#EF4444', weight: 0.8 },
  5: { label: 'Fatal', color: '#B91C1C', weight: 1.0 },
};

// Region awal peta: koridor Unpam (Pamulang) -> Tangerang Kota.
export const INITIAL_REGION = {
  latitude: -6.28,
  longitude: 106.69,
  latitudeDelta: 0.22,
  longitudeDelta: 0.22,
};

// Ambang pemantauan perjalanan.
export const HEARTBEAT_INTERVAL_MS = 30_000; // kirim posisi tiap 30 dtk
export const SILENCE_TIMEOUT_MS = 90_000; // senyap > 90 dtk = anomali
export const SOS_COUNTDOWN_S = 30; // user punya 30 dtk klik "Saya Aman"
export const LOW_BATTERY_THRESHOLD = 0.15; // di bawah ini = warning pra-jalan
