import { isSupabaseConfigured, supabase } from '../lib/supabase';

export interface ManualSosPayload {
  locationLabel?: string;
  lat?: number;
  lon?: number;
  batteryPct?: number;
}

export interface ManualSosResult {
  sent: number;
  failed: number;
  total: number;
  reason?: string;
}

export async function sendManualSos(payload: ManualSosPayload): Promise<ManualSosResult | null> {
  if (!isSupabaseConfigured) return null;
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) return null;

  const url = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/manual-sos`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.warn('[sos] manual-sos non-OK:', res.status, await res.text());
      return null;
    }
    return (await res.json()) as ManualSosResult;
  } catch (e) {
    console.warn('[sos] manual-sos error:', e);
    return null;
  }
}
