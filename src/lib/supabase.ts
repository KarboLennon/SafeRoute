import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
// Terima dua nama: ANON_KEY (legacy JWT) atau KEY (publishable key baru `sb_publishable_…`).
const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_KEY ?? '';

// true bila kredensial Supabase sudah diisi. Dipakai untuk auth gate:
// kalau false → app jalan dalam "mode demo/tamu" tanpa backend.
export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured) {
  console.warn(
    '[supabase] EXPO_PUBLIC_SUPABASE_URL / ANON_KEY belum diset — jalan mode demo (tanpa auth). Lihat .env.example.'
  );
}

// createClient menolak URL kosong → pakai placeholder valid saat belum dikonfigurasi.
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false, // RN tidak punya URL session
    },
  }
);

/**
 * ID user yang sedang login, atau null kalau belum (mode demo/tamu).
 * Dipakai lapisan service untuk memilih: query DB (login) vs data dummy (demo).
 * Memakai getSession() (baca storage lokal, tanpa network round-trip).
 */
export async function currentUserId(): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

/** Nama tampilan user saat ini (dari metadata signUp), fallback 'Warga'. */
export async function currentUserName(): Promise<string> {
  if (!isSupabaseConfigured) return 'Warga';
  const { data } = await supabase.auth.getSession();
  const meta = data.session?.user?.user_metadata as { full_name?: string } | undefined;
  return meta?.full_name?.trim() || 'Warga';
}
