import { useEffect, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

export interface NewsAlert {
  id: string;
  title: string;
  description: string;
  level: number;
  reporterName: string;
  sourceUrl: string | null;
  latitude: number;
  longitude: number;
}

export function useNewsRealtime(): {
  latest: NewsAlert | null;
  dismiss: () => void;
} {
  const [latest, setLatest] = useState<NewsAlert | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const channel = supabase
      .channel('reports-news')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'reports', filter: 'source=eq.news' },
        (payload) => {
          const r = payload.new as Record<string, any>;
          setLatest({
            id: r.id,
            title: r.title || 'Berita baru',
            description: r.description || '',
            level: r.level ?? 1,
            reporterName: r.reporter_name || 'Sumber berita',
            sourceUrl: r.source_url ?? null,
            latitude: r.latitude,
            longitude: r.longitude,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { latest, dismiss: () => setLatest(null) };
}
