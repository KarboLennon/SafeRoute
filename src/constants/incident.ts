import { Ionicons } from '@expo/vector-icons';
import { DangerLevel, IncidentCategory } from '../types';

// Metadata kategori insiden (untuk form Lapor Insiden & label di feed).
export const INCIDENT_CATEGORIES: Record<
  IncidentCategory,
  { label: string; sub: string; icon: keyof typeof Ionicons.glyphMap; level: DangerLevel }
> = {
  pencurian: { label: 'Begal / Pencurian', sub: 'Begal, Rampok, Jambret, Curanmor', icon: 'shield-outline', level: 4 },
  tawuran: { label: 'Tawuran', sub: 'Bentrok antar kelompok', icon: 'people', level: 4 },
  demonstrasi: { label: 'Demonstrasi', sub: 'Unjuk rasa, jalan ditutup', icon: 'megaphone-outline', level: 2 },
  bahaya_jalan: { label: 'Bahaya Jalan', sub: 'Gelap, Lubang, Pohon Tumbang', icon: 'warning-outline', level: 2 },

};

// Ambang konfirmasi komunitas agar laporan jadi "Terverifikasi Komunitas".
export const CONFIRM_THRESHOLD = 3;
