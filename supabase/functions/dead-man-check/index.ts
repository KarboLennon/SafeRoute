// Auto-SOS Telegram untuk trip yang last_heartbeat_at-nya lebih dari STALE_AFTER_MS
// dan sos_sent_at masih null. Dipicu pg_cron tiap menit.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const TELEGRAM_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') ?? '';

const STALE_AFTER_MS = 2 * 60 * 1000;

const HEADERS = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
};

interface TripRow {
  id: string;
  user_id: string;
  origin_label: string;
  dest_label: string;
  last_lat: number | null;
  last_lon: number | null;
  last_battery: number | null;
  last_heartbeat_at: string | null;
  started_at: string;
}

interface ContactRow {
  name: string;
  telegram_chat_id: string;
}

async function fetchStaleTrips(): Promise<TripRow[]> {
  const cutoff = new Date(Date.now() - STALE_AFTER_MS).toISOString();
  const url =
    `${SUPABASE_URL}/rest/v1/trips` +
    `?status=eq.active` +
    `&last_heartbeat_at=lt.${encodeURIComponent(cutoff)}` +
    `&sos_sent_at=is.null` +
    `&select=id,user_id,origin_label,dest_label,last_lat,last_lon,last_battery,last_heartbeat_at,started_at`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`fetch trips ${res.status}: ${await res.text()}`);
  return await res.json();
}

async function fetchContacts(userId: string): Promise<ContactRow[]> {
  const url =
    `${SUPABASE_URL}/rest/v1/emergency_contacts` +
    `?user_id=eq.${userId}` +
    `&active=eq.true` +
    `&telegram_chat_id=not.is.null` +
    `&select=name,telegram_chat_id`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) return [];
  return await res.json();
}

async function fetchUserName(userId: string): Promise<string> {
  const url = `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=full_name`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) return 'Seseorang';
  const rows = await res.json();
  return rows[0]?.full_name || 'Seseorang';
}

async function markSosSent(tripId: string): Promise<void> {
  await fetch(`${SUPABASE_URL}/rest/v1/trips?id=eq.${tripId}`, {
    method: 'PATCH',
    headers: HEADERS,
    body: JSON.stringify({ sos_sent_at: new Date().toISOString() }),
  });
}

async function sendTelegram(chatId: string, text: string): Promise<boolean> {
  const res = await fetch(
    `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'Markdown',
        disable_web_page_preview: false,
      }),
    }
  );
  if (!res.ok) {
    console.warn('[telegram] gagal kirim:', res.status, await res.text());
    return false;
  }
  return true;
}

function buildMessage(args: {
  name: string;
  originLabel: string;
  destLabel: string;
  lastLat: number | null;
  lastLon: number | null;
  lastBattery: number | null;
  startedAt: string;
}): string {
  const lines: string[] = [];
  lines.push(`🚨 *AUTO-SOS JagaMalam*`);
  lines.push('');
  lines.push(`${args.name} udah lebih dari 2 menit gak update posisi — bisa jadi hp-nya dirampok, mati, atau lagi gak ada sinyal.`);
  lines.push('');
  lines.push(`📍 *Perjalanan*: ${args.originLabel} → ${args.destLabel}`);
  lines.push(`🕐 Mulai: ${new Date(args.startedAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB`);
  if (args.lastLat != null && args.lastLon != null) {
    lines.push('');
    lines.push(`📌 *Lokasi terakhir:*`);
    lines.push(`https://maps.google.com/?q=${args.lastLat},${args.lastLon}`);
  }
  if (args.lastBattery != null) {
    lines.push(`🔋 Baterai terakhir: ${args.lastBattery}%`);
  }
  lines.push('');
  lines.push(`Hubungi ${args.name} sekarang. Kalau gak merespons, pertimbangkan lapor 110.`);
  return lines.join('\n');
}

Deno.serve(async () => {
  if (!TELEGRAM_TOKEN) {
    return new Response('TELEGRAM_BOT_TOKEN belum diset', { status: 500 });
  }
  if (!SERVICE_KEY) {
    return new Response('SUPABASE_SERVICE_ROLE_KEY belum diset', { status: 500 });
  }

  const trips = await fetchStaleTrips();
  const result: Record<string, unknown> = {
    checked_at: new Date().toISOString(),
    stale_trips: trips.length,
    sent: 0,
    no_contacts: 0,
  };

  for (const trip of trips) {
    const [contacts, userName] = await Promise.all([
      fetchContacts(trip.user_id),
      fetchUserName(trip.user_id),
    ]);
    if (contacts.length === 0) {
      await markSosSent(trip.id);
      (result.no_contacts as number)++;
      continue;
    }

    const message = buildMessage({
      name: userName,
      originLabel: trip.origin_label,
      destLabel: trip.dest_label,
      lastLat: trip.last_lat,
      lastLon: trip.last_lon,
      lastBattery: trip.last_battery,
      startedAt: trip.started_at,
    });

    let anySent = false;
    for (const c of contacts) {
      const ok = await sendTelegram(c.telegram_chat_id, message);
      if (ok) anySent = true;
    }
    if (anySent) {
      await markSosSent(trip.id);
      (result.sent as number)++;
    }
  }

  return new Response(JSON.stringify(result, null, 2), {
    headers: { 'Content-Type': 'application/json' },
  });
});
