import { currentUserId, isSupabaseConfigured, supabase } from '../lib/supabase';

export interface TripPoint {
  latitude: number;
  longitude: number;
  label: string;
}

export interface Trip {
  id: string;
  token: string;
}

export async function createTrip(origin: TripPoint, dest: TripPoint): Promise<Trip | null> {
  if (!isSupabaseConfigured) return null;
  const uid = await currentUserId();
  if (!uid) return null;
  const { data, error } = await supabase
    .from('trips')
    .insert({
      user_id: uid,
      origin_label: origin.label,
      origin_lat: origin.latitude,
      origin_lon: origin.longitude,
      dest_label: dest.label,
      dest_lat: dest.latitude,
      dest_lon: dest.longitude,
    })
    .select('id, token')
    .single();
  if (error || !data) {
    console.warn('[trips] gagal create:', error?.message);
    return null;
  }
  return { id: data.id, token: data.token };
}

export async function sendHeartbeat(
  tripId: string,
  lat: number,
  lon: number,
  batteryPct: number | null
): Promise<void> {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase
    .from('trips')
    .update({
      last_lat: lat,
      last_lon: lon,
      last_battery: batteryPct,
      last_heartbeat_at: new Date().toISOString(),
    })
    .eq('id', tripId)
    .eq('status', 'active');
  if (error) console.warn('[trips] heartbeat gagal:', error.message);
}

export async function endTrip(
  tripId: string,
  status: 'arrived' | 'sos' | 'cancelled'
): Promise<void> {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase
    .from('trips')
    .update({ status, ended_at: new Date().toISOString() })
    .eq('id', tripId);
  if (error) console.warn('[trips] end gagal:', error.message);
}

export async function simulateBegal(tripId: string): Promise<{ sent: number } | null> {
  if (!isSupabaseConfigured) return null;
  const staleAt = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { error } = await supabase
    .from('trips')
    .update({ last_heartbeat_at: staleAt, sos_sent_at: null })
    .eq('id', tripId);
  if (error) {
    console.warn('[trips] simulasi mark stale gagal:', error.message);
    return null;
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) return null;
  const url = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/dead-man-check`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    if (!res.ok) {
      console.warn('[trips] dead-man-check non-OK:', res.status);
      return null;
    }
    const json = (await res.json()) as { sent?: number };
    return { sent: json.sent ?? 0 };
  } catch (e) {
    console.warn('[trips] dead-man-check error:', e);
    return null;
  }
}
