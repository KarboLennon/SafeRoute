// Tingkat bahaya kejadian, 1 (rendah) — 5 (fatal).
export type DangerLevel = 1 | 2 | 3 | 4 | 5;

export interface Coordinate {
  latitude: number;
  longitude: number;
}

export interface Evidence {
  id: string;
  type: 'photo' | 'link';
  url: string;
}

// Kategori insiden — fokus ancaman yang membuat sebuah AREA berbahaya dilewati
// (mempengaruhi rute navigasi), bukan kejadian personal.
export type IncidentCategory = 'pencurian' | 'tawuran' | 'demonstrasi' | 'bahaya_jalan';

// Asal laporan: saat ini hanya hasil scraping berita. `community` disisakan di
// skema buat backward-compat record lama di DB; fitur lapor warga sudah dihapus.
export type ReportSource = 'community' | 'news';

export interface Report {
  id: string;
  title: string;
  category: IncidentCategory;
  level: DangerLevel;
  latitude: number;
  longitude: number;
  locationName: string;
  description: string;
  occurredAt: string; // ISO date
  reporterName: string;
  evidence: Evidence[];
  confirmations: number; // sisa dari skema lama, tidak ditampilkan
  comments: number;
  likes: number;
  trusted: boolean; // berita selalu trusted
  source?: ReportSource; // sekarang efektif 'news'
  sourceUrl?: string; // link artikel berita
  locationConfidence?: 'tinggi' | 'sedang' | 'rendah';
}

// Profil pengguna (ditampilkan di tab Profil).
export interface UserProfile {
  id: string;
  name: string;
  university: string;
  email: string;
  phone: string;
  avatarUrl: string | null; // null → pakai inisial
  level: DangerLevel; // level keamanan akun
  safeTripDays: number;
  reportCount: number;
  memberSince: string; // ISO date
  verified: boolean;
}

// Kontak darurat yang dihubungi saat SOS.
export interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  relationship: string; // Ibu, Bapak, Teman, dll.
  active: boolean;
  // Buat dead-man's switch: kalau heartbeat hilang, server kirim Telegram ke
  // chat_id ini. Kosong → kontak ini cuma jadi tujuan SOS manual (WA), gak
  // dapet auto-notif kalau hp dirampok.
  telegramChatId?: string | null;
}

// Preferensi keamanan (toggle di Profil).
export interface SecurityPrefs {
  autoSos: boolean;
  batteryAlert: boolean;
  darkMode: boolean;
}

// Notifikasi.
export type NotifType = 'critical' | 'trip' | 'education' | 'system';
export interface AppNotification {
  id: string;
  type: NotifType;
  title: string;
  body: string;
  time: string; // mis. "2j lalu"
  section: string; // "HARI INI" | "REKOMENDASI" | "KEMARIN"
  linkUrl?: string | null;
}

// State pemantauan perjalanan (dead man's switch).
export type TripStatus = 'active' | 'arrived' | 'sos';

export interface Heartbeat {
  latitude: number;
  longitude: number;
  battery: number; // 0..1
  charging: boolean;
  speed: number; // km/h
  timestamp: string; // ISO
}
