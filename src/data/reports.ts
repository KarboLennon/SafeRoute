import { Report } from '../types';
import newsRaw from './newsReports.json';

// Berita bundled saat build — dipakai sebagai fallback bila Supabase belum
// punya data dari pipeline. Source of truth runtime ada di getReports().
export const NEWS_REPORTS = newsRaw as Report[];
