import { sha256 } from 'js-sha256';
import { DangerLevel, EmergencyContact, SecurityPrefs, UserProfile } from '../types';
import { currentUserId, isSupabaseConfigured, supabase } from '../lib/supabase';

/**
 * Login → query `profiles` & `emergency_contacts`. Tanpa login → data dummy
 * in-memory, supaya UI yang panggil fungsi async ini tidak perlu tahu bedanya.
 */

const DUMMY_PROFILE: UserProfile = {
  id: 'dummy-user',
  name: 'Arya Pratama',
  university: 'Universitas Pamulang',
  email: 'arya.pratama@unpam.ac.id',
  phone: '+62 812-3456-7890',
  avatarUrl: null,
  level: 1,
  safeTripDays: 12,
  reportCount: 0,
  memberSince: '2026-01-15',
  verified: true,
};

const DUMMY_CONTACTS: EmergencyContact[] = [
  { id: 'c1', name: 'Sari Wijaya', phone: '+62 812-3456-7890', relationship: 'Ibu', active: true },
  { id: 'c2', name: 'Budi Santoso', phone: '+62 811-2233-4455', relationship: 'Bapak', active: true },
  { id: 'c3', name: 'Rangga Putra', phone: '+62 813-9988-7766', relationship: 'Teman', active: true },
];

const DUMMY_PREFS: SecurityPrefs = { autoSos: true, batteryAlert: true, darkMode: false };

// ---------- Mapper baris DB (snake_case) → tipe app (camelCase) ----------

function rowToProfile(r: Record<string, any>): UserProfile {
  return {
    id: r.id,
    name: r.full_name || 'Pengguna',
    university: r.university || 'Universitas Pamulang',
    email: r.email || '',
    phone: r.phone || '',
    avatarUrl: r.avatar_url ?? null,
    level: ((r.level ?? 1) as DangerLevel),
    safeTripDays: r.safe_trip_days ?? 0,
    reportCount: r.report_count ?? 0,
    memberSince: r.created_at ?? new Date().toISOString(),
    verified: !!r.verified,
  };
}

function rowToContact(r: Record<string, any>): EmergencyContact {
  return {
    id: r.id,
    name: r.name,
    phone: r.phone,
    relationship: r.relationship,
    active: !!r.active,
    telegramChatId: r.telegram_chat_id ?? null,
  };
}

function toPrefs(p: any): SecurityPrefs {
  return {
    autoSos: p?.autoSos ?? true,
    batteryAlert: p?.batteryAlert ?? true,
    darkMode: p?.darkMode ?? false,
  };
}

// ---------- Profil ----------

/**
 * Pastikan baris `profiles` ada & sinkron dengan metadata akun (nama, telepon, email).
 * Dipanggil setiap user login — menambal kasus di mana trigger DB tidak sempat jalan
 * (mis. akun dibuat sebelum skema dipasang), supaya nomor telepon tetap kesimpan.
 */
export async function syncProfileFromAuth(): Promise<void> {
  if (!isSupabaseConfigured) return;
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;
  if (!user) return;

  const meta = (user.user_metadata ?? {}) as { full_name?: string; phone?: string };
  const patch: Record<string, any> = { id: user.id, email: user.email };
  if (meta.full_name?.trim()) patch.full_name = meta.full_name.trim();
  if (meta.phone?.trim()) patch.phone = meta.phone.trim();

  const { error } = await supabase.from('profiles').upsert(patch, { onConflict: 'id' });
  if (error) console.warn('[profile] gagal sinkron profil:', error.message);
}

/** Ambil profil pengguna saat ini. */
export async function getProfile(): Promise<UserProfile> {
  const uid = await currentUserId();
  if (!uid) return DUMMY_PROFILE;

  const { data, error } = await supabase.from('profiles').select('*').eq('id', uid).single();
  if (error || !data) {
    console.warn('[profile] gagal ambil profil:', error?.message);
    return DUMMY_PROFILE;
  }
  return rowToProfile(data);
}

/** Perbarui data profil (nama, universitas, telepon). Email diatur lewat auth → tidak diubah di sini. */
export async function updateProfile(patch: {
  name?: string;
  university?: string;
  phone?: string;
}): Promise<UserProfile> {
  const uid = await currentUserId();
  if (!uid) {
    if (patch.name !== undefined) DUMMY_PROFILE.name = patch.name;
    if (patch.university !== undefined) DUMMY_PROFILE.university = patch.university;
    if (patch.phone !== undefined) DUMMY_PROFILE.phone = patch.phone;
    return { ...DUMMY_PROFILE };
  }

  const dbPatch: Record<string, any> = {};
  if (patch.name !== undefined) dbPatch.full_name = patch.name;
  if (patch.university !== undefined) dbPatch.university = patch.university;
  if (patch.phone !== undefined) dbPatch.phone = patch.phone;

  const { data, error } = await supabase
    .from('profiles')
    .update(dbPatch)
    .eq('id', uid)
    .select()
    .single();
  if (error || !data) throw error ?? new Error('Gagal menyimpan profil.');
  return rowToProfile(data);
}

// ---------- Kontak darurat ----------

/** Ambil daftar kontak darurat. */
export async function getEmergencyContacts(): Promise<EmergencyContact[]> {
  const uid = await currentUserId();
  if (!uid) return [...DUMMY_CONTACTS];

  const { data, error } = await supabase
    .from('emergency_contacts')
    .select('*')
    .eq('user_id', uid)
    .order('created_at', { ascending: true });
  if (error) {
    console.warn('[profile] gagal ambil kontak:', error.message);
    return [];
  }
  return (data ?? []).map(rowToContact);
}

/** Tambah kontak darurat baru. */
export async function addEmergencyContact(
  input: Omit<EmergencyContact, 'id' | 'active'>
): Promise<EmergencyContact> {
  const uid = await currentUserId();
  if (!uid) {
    const contact: EmergencyContact = { ...input, id: `c${Date.now()}`, active: true };
    DUMMY_CONTACTS.push(contact);
    return contact;
  }

  const { data, error } = await supabase
    .from('emergency_contacts')
    .insert({
      user_id: uid,
      name: input.name,
      phone: input.phone,
      relationship: input.relationship,
      telegram_chat_id: input.telegramChatId || null,
    })
    .select()
    .single();
  if (error || !data) throw error ?? new Error('Gagal menyimpan kontak.');
  return rowToContact(data);
}

export async function setContactTelegram(
  id: string,
  chatId: string | null
): Promise<void> {
  const uid = await currentUserId();
  if (!uid) {
    const c = DUMMY_CONTACTS.find((x) => x.id === id);
    if (c) c.telegramChatId = chatId;
    return;
  }
  const { error } = await supabase
    .from('emergency_contacts')
    .update({ telegram_chat_id: chatId })
    .eq('id', id);
  if (error) throw error;
}

function hashPin(pin: string, uid: string): string {
  return sha256(`${uid}:${pin}`);
}

let cachedPinHash: string | null | undefined;

export async function hasSafetyPin(): Promise<boolean> {
  const uid = await currentUserId();
  if (!uid) return false;
  if (cachedPinHash === undefined) {
    const { data } = await supabase
      .from('profiles')
      .select('safety_pin_hash')
      .eq('id', uid)
      .single();
    cachedPinHash = data?.safety_pin_hash ?? null;
  }
  return !!cachedPinHash;
}

export async function setSafetyPin(pin: string): Promise<void> {
  const uid = await currentUserId();
  if (!uid) throw new Error('Belum login');
  if (!/^\d{4}$/.test(pin)) throw new Error('PIN harus 4 digit');
  const hash = hashPin(pin, uid);
  const { error } = await supabase
    .from('profiles')
    .update({ safety_pin_hash: hash })
    .eq('id', uid);
  if (error) throw error;
  cachedPinHash = hash;
}

export async function clearSafetyPin(): Promise<void> {
  const uid = await currentUserId();
  if (!uid) return;
  await supabase.from('profiles').update({ safety_pin_hash: null }).eq('id', uid);
  cachedPinHash = null;
}

export async function verifySafetyPin(pin: string): Promise<boolean> {
  const uid = await currentUserId();
  if (!uid) return false;
  if (cachedPinHash === undefined) {
    const { data } = await supabase
      .from('profiles')
      .select('safety_pin_hash')
      .eq('id', uid)
      .single();
    cachedPinHash = data?.safety_pin_hash ?? null;
  }
  if (!cachedPinHash) return false;
  const candidate = hashPin(pin, uid);
  return candidate === cachedPinHash;
}

/** Hapus kontak darurat. */
export async function deleteEmergencyContact(id: string): Promise<void> {
  const uid = await currentUserId();
  if (!uid) {
    const i = DUMMY_CONTACTS.findIndex((c) => c.id === id);
    if (i >= 0) DUMMY_CONTACTS.splice(i, 1);
    return;
  }

  const { error } = await supabase.from('emergency_contacts').delete().eq('id', id);
  if (error) throw error;
}

// ---------- Preferensi keamanan (disimpan di profiles.preferences jsonb) ----------

/** Ambil preferensi keamanan. */
export async function getSecurityPrefs(): Promise<SecurityPrefs> {
  const uid = await currentUserId();
  if (!uid) return { ...DUMMY_PREFS };

  const { data, error } = await supabase.from('profiles').select('preferences').eq('id', uid).single();
  if (error || !data) {
    console.warn('[profile] gagal ambil preferensi:', error?.message);
    return { ...DUMMY_PREFS };
  }
  return toPrefs(data.preferences);
}

/** Perbarui preferensi keamanan (merge ke jsonb yang sudah ada). */
export async function updateSecurityPrefs(patch: Partial<SecurityPrefs>): Promise<SecurityPrefs> {
  const uid = await currentUserId();
  if (!uid) {
    Object.assign(DUMMY_PREFS, patch);
    return { ...DUMMY_PREFS };
  }

  const { data } = await supabase.from('profiles').select('preferences').eq('id', uid).single();
  const merged = { ...toPrefs(data?.preferences), ...patch };
  const { error } = await supabase.from('profiles').update({ preferences: merged }).eq('id', uid);
  if (error) throw error;
  return merged;
}
