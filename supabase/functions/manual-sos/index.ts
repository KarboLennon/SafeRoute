// Instant SOS Telegram dipicu user. user_id diambil dari JWT (Supabase
// verify_jwt: true sudah validasi signature sebelum kode ini jalan).

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const TELEGRAM_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') ?? '';

const HEADERS = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
};

interface ContactRow {
  name: string;
  telegram_chat_id: string;
}

interface SosPayload {
  locationLabel?: string;
  lat?: number;
  lon?: number;
  batteryPct?: number;
}

function extractUserId(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const jwt = authHeader.replace(/^Bearer\s+/i, '');
  const parts = jwt.split('.');
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}

async function fetchUserName(userId: string): Promise<string> {
  const url = `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=full_name`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) return 'Seseorang';
  const rows = await res.json();
  return rows[0]?.full_name || 'Seseorang';
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
  locationLabel?: string;
  lat?: number;
  lon?: number;
  batteryPct?: number;
}): string {
  const lines: string[] = [];
  lines.push(`🚨 *SOS MANUAL — SafeRoute*`);
  lines.push('');
  lines.push(`${args.name} barusan tekan tombol SOS. Butuh bantuan SEKARANG.`);
  lines.push('');
  if (args.locationLabel) {
    lines.push(`📍 *Lokasi*: ${args.locationLabel}`);
  }
  if (args.lat != null && args.lon != null) {
    lines.push(`📌 *Koordinat:*`);
    lines.push(`https://maps.google.com/?q=${args.lat},${args.lon}`);
  }
  if (args.batteryPct != null) {
    lines.push(`🔋 Baterai: ${args.batteryPct}%`);
  }
  lines.push('');
  lines.push(`Telepon ${args.name} sekarang. Kalau gak diangkat — lapor 110 + cari ke lokasi di atas.`);
  return lines.join('\n');
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }
  if (!TELEGRAM_TOKEN) {
    return new Response(JSON.stringify({ error: 'TELEGRAM_BOT_TOKEN belum diset' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }

  const userId = extractUserId(req.headers.get('Authorization'));
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  let payload: SosPayload = {};
  try {
    payload = await req.json();
  } catch {
    // body optional
  }

  const [contacts, userName] = await Promise.all([
    fetchContacts(userId),
    fetchUserName(userId),
  ]);

  if (contacts.length === 0) {
    return new Response(JSON.stringify({
      sent: 0,
      failed: 0,
      reason: 'no_contacts_with_telegram',
    }), { headers: { 'Content-Type': 'application/json' } });
  }

  const message = buildMessage({
    name: userName,
    locationLabel: payload.locationLabel,
    lat: payload.lat,
    lon: payload.lon,
    batteryPct: payload.batteryPct,
  });

  let sent = 0;
  let failed = 0;
  for (const c of contacts) {
    const ok = await sendTelegram(c.telegram_chat_id, message);
    if (ok) sent++;
    else failed++;
  }

  return new Response(JSON.stringify({ sent, failed, total: contacts.length }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
