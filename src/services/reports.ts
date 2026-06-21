import { NEWS_REPORTS } from '../data/reports';
import { supabase } from '../lib/supabase';
import { Report } from '../types';

/**
 * Lapisan akses data laporan berita.
 *
 * Sumber tunggal: tabel `public.reports` (source='news'). Pipeline scraping
 * (scripts/news-pipeline.mjs --supabase) UPSERT berita ke DB tiap jam 00:00 WIB
 * via GitHub Actions cron. Bundled JSON (NEWS_REPORTS) dipakai jaring pengaman
 * bila DB kosong / koneksi mati.
 */

const byNewest = (a: Report, b: Report) => b.occurredAt.localeCompare(a.occurredAt);

function rowToReport(r: Record<string, any>): Report {
  return {
    id: r.id,
    title: r.title,
    category: r.category,
    level: r.level,
    latitude: r.latitude,
    longitude: r.longitude,
    locationName: r.location_name ?? '',
    description: r.description ?? '',
    occurredAt: r.occurred_at,
    reporterName: r.reporter_name ?? 'Berita',
    evidence: [], // berita pakai sourceUrl, evidence array hanya buat kompat tipe
    confirmations: r.confirmations ?? 0,
    comments: r.comments ?? 0,
    likes: r.likes ?? 0,
    trusted: !!r.trusted,
    source: r.source ?? 'news',
    sourceUrl: r.source_url ?? undefined,
    locationConfidence: r.location_confidence ?? undefined,
  };
}

export async function getReports(): Promise<Report[]> {
  const { data, error } = await supabase
    .from('reports')
    .select('*')
    .order('occurred_at', { ascending: false });
  if (error) {
    console.warn('[reports] gagal ambil laporan, fallback berita bundled:', error.message);
    return [...NEWS_REPORTS].sort(byNewest);
  }
  const all = (data ?? []).map(rowToReport);
  // Kalau DB belum berisi berita (pipeline belum jalan / migrasi awal), pakai
  // bundled JSON sebagai jaring pengaman supaya peta tetap ada konten.
  return all.length ? all : [...NEWS_REPORTS].sort(byNewest);
}

/** Waktu relatif singkat: "2 mnt lalu", "3 jam lalu". */
export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return 'baru saja';
  if (m < 60) return `${m} mnt lalu`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} jam lalu`;
  return `${Math.round(h / 24)} hari lalu`;
}
