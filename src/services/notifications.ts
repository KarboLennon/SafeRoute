import { currentUserId, supabase } from '../lib/supabase';
import { AppNotification } from '../types';
import { timeAgo } from './reports';

const DUMMY: AppNotification[] = [
  {
    id: 'n1',
    type: 'critical',
    title: 'Peringatan Kritis: Aktivitas Tidak Biasa',
    body:
      'Terdeteksi aktivitas mencurigakan di rute yang sering Anda lalui di sekitar Jl. Sudirman. Harap tetap waspada atau pilih rute alternatif.',
    time: '2j lalu',
    section: 'HARI INI',
  },
  {
    id: 'n2',
    type: 'trip',
    title: 'Update Perjalanan',
    body:
      'Perjalanan Anda ke "Kampus" pagi tadi tercatat aman. Statistik keamanan rute ini meningkat 12% minggu ini.',
    time: '4j lalu',
    section: 'HARI INI',
  },
  {
    id: 'n3',
    type: 'education',
    title: 'Tips Keamanan: Berjalan di Malam Hari',
    body:
      'Pelajari cara menggunakan fitur SOS cepat dan bagikan lokasi secara real-time dengan orang terpercaya.',
    time: '',
    section: 'REKOMENDASI',
  },
  {
    id: 'n4',
    type: 'system',
    title: 'Pembaruan Sistem Tersedia',
    body: 'Update v2.4 membawa algoritma prediksi bahaya baru yang lebih akurat.',
    time: '1h lalu',
    section: 'KEMARIN',
  },
];

function rowToNotif(r: Record<string, any>): AppNotification {
  return {
    id: r.id,
    type: r.type,
    title: r.title,
    body: r.body ?? '',
    time: r.created_at ? timeAgo(r.created_at) : '',
    section: r.section ?? 'HARI INI',
    linkUrl: r.link_url ?? null,
  };
}

export async function getNotifications(): Promise<AppNotification[]> {
  const uid = await currentUserId();
  if (!uid) return DUMMY;

  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .or(`user_id.eq.${uid},user_id.is.null`)
    .order('created_at', { ascending: false });
  if (error) {
    console.warn('[notifications] gagal ambil notifikasi:', error.message);
    return [];
  }
  return (data ?? []).map(rowToNotif);
}
