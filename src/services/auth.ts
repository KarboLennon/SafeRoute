import { supabase } from '../lib/supabase';

/** Daftar akun baru. Nama & telepon disimpan sebagai metadata → tabel profiles via trigger. */
export async function signUp(input: {
  name: string;
  email: string;
  phone: string;
  password: string;
}) {
  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: { data: { full_name: input.name, phone: input.phone } },
  });
  if (error) throw error;
  return data;
}

/** Masuk dengan email + password. */
export async function signIn(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

/** Kirim email reset password. */
export async function resetPassword(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) throw error;
}

/** Keluar. */
export async function signOut() {
  await supabase.auth.signOut();
}
