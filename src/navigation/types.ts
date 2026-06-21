import { UserProfile } from '../types';

// Daftar route di root stack + param-nya.
export type RootStackParamList = {
  Tabs: undefined;
  // Edit profil — bawa data profil saat ini supaya form langsung terisi.
  EditProfil: { profile: UserProfile };
  // Rute terpilih (koordinat + turn-by-turn) untuk navigasi realtime.
  // tripId opsional: kalau di-set, NavigasiAktif kirim heartbeat tiap ~20s ke
  // Supabase supaya dead-man's switch & halaman track publik bisa jalan.
  NavigasiAktif:
    | {
        coords?: { latitude: number; longitude: number }[];
        steps?: {
          instruction: string;
          distanceM: number;
          location: { latitude: number; longitude: number };
        }[];
        tripId?: string;
      }
    | undefined;
  SOS: undefined;
  KontakDarurat: undefined;
  LaporanKomunitas: undefined;
};
