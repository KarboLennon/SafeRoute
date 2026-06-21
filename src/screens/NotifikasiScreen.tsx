import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { getNotifications } from '../services/notifications';
import { timeAgo } from '../services/reports';
import { AppNotification, NotifType } from '../types';
import { colors, radius } from '../constants/theme';

const FILTERS = ['Semua', 'Kritis', 'Pembaruan'] as const;
const SECTION_ORDER = ['HARI INI', 'REKOMENDASI', 'KEMARIN'];

export default function NotifikasiScreen() {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('Semua');

  useEffect(() => {
    let alive = true;
    getNotifications().then((n) => alive && setItems(n));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const ch = supabase
      .channel('notifications-stream')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        (payload) => {
          const r = payload.new as Record<string, any>;
          setItems((prev) => {
            if (prev.some((x) => x.id === r.id)) return prev;
            const next: AppNotification = {
              id: r.id,
              type: r.type,
              title: r.title,
              body: r.body ?? '',
              time: r.created_at ? timeAgo(r.created_at) : 'Baru saja',
              section: r.section ?? 'HARI INI',
              linkUrl: r.link_url ?? null,
            };
            return [next, ...prev];
          });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  const shown = items.filter((n) =>
    filter === 'Kritis' ? n.type === 'critical' : filter === 'Pembaruan' ? n.type === 'system' : true
  );

  const grouped = useMemo(() => {
    const map: Record<string, AppNotification[]> = {};
    for (const n of shown) (map[n.section] ??= []).push(n);
    return SECTION_ORDER.filter((s) => map[s]?.length).map((s) => ({ section: s, items: map[s] }));
  }, [shown]);

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.headerTitle}>Notifikasi</Text>
      </View>

      {/* Filter */}
      <View style={styles.filterRow}>
        {FILTERS.map((f) => {
          const active = f === filter;
          return (
            <Pressable key={f} onPress={() => setFilter(f)} style={[styles.chip, active && styles.chipActive]}>
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{f}</Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 18, paddingBottom: 24 }}>
        {grouped.map((g) => (
          <View key={g.section} style={{ gap: 12 }}>
            <Text style={styles.sectionLabel}>{g.section}</Text>
            {g.items.map((n) => (
              <NotifCard
                key={n.id}
                notif={n}
                onDismiss={() => setItems((prev) => prev.filter((x) => x.id !== n.id))}
              />
            ))}
          </View>
        ))}
        {grouped.length === 0 && <Text style={styles.empty}>Tidak ada notifikasi.</Text>}
      </ScrollView>
    </View>
  );
}

const ICON: Record<NotifType, keyof typeof Ionicons.glyphMap> = {
  critical: 'warning',
  trip: 'walk',
  education: 'shield-checkmark',
  system: 'time-outline',
};

function NotifCard({ notif: n, onDismiss }: { notif: AppNotification; onDismiss: () => void }) {
  function openLink() {
    if (n.linkUrl) Linking.openURL(n.linkUrl).catch(() => {});
  }

  if (n.type === 'education') {
    return (
      <View style={styles.eduCard}>
        <Text style={styles.eduCap}>EDUKASI KEAMANAN</Text>
        <Text style={styles.eduTitle}>{n.title}</Text>
        <Text style={styles.eduBody}>{n.body}</Text>
        <Pressable style={styles.eduBtn} onPress={openLink}>
          <Text style={styles.eduBtnText}>Baca Selengkapnya</Text>
        </Pressable>
      </View>
    );
  }

  const critical = n.type === 'critical';
  const hasLink = !!n.linkUrl;
  return (
    <View style={[styles.card, critical && styles.cardCritical]}>
      <View style={styles.cardContent}>
        <View style={[styles.icon, critical ? styles.iconCritical : styles.iconNormal]}>
          <Ionicons
            name={ICON[n.type]}
            size={18}
            color={critical ? colors.danger : colors.primary}
          />
        </View>

        <View style={styles.contentRight}>
          <View style={styles.titleRow}>
            <Text
              style={[styles.title, critical && { color: colors.danger }]}
              numberOfLines={1}
            >
              {n.title}
            </Text>

            {!!n.time && (
              <Text style={styles.time}>
                {n.time}
              </Text>
            )}
          </View>

          <Text style={styles.body}>
            {n.body}
          </Text>

          {critical && (
            <View style={styles.actions}>
              <Pressable
                style={[styles.detailBtn, !hasLink && { opacity: 0.4 }]}
                onPress={openLink}
                disabled={!hasLink}
              >
                <Text style={styles.detailText}>Lihat Detail</Text>
              </Pressable>

              <Pressable style={styles.dismissBtn} onPress={onDismiss}>
                <Text style={styles.dismissText}>Abaikan</Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: 16, paddingBottom: 12, backgroundColor: colors.surface, alignItems: 'center' , borderBottomWidth: 1, borderBottomColor: colors.border, },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },

  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 15, backgroundColor: colors.surface },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, color: colors.textSecondary, fontWeight: '500' },
  chipTextActive: { color: colors.surface },

  sectionLabel: { fontSize: 11, color: colors.textMuted, fontWeight: '700', letterSpacing: 0.5, marginLeft: 4 },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 14,
  },

  cardCritical: {
    backgroundColor: colors.dangerBg,
  },

  cardContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },

  icon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },

  iconCritical: {
    backgroundColor: 'rgba(186,26,26,0.12)',
  },

  iconNormal: {
    backgroundColor: colors.surfaceAlt,
  },

  contentRight: {
    flex: 1,
    gap: 6,
  },

  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },

  title: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },

  time: {
    fontSize: 11,
    color: colors.textMuted,
  },

  body: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 19,
  },

  actions: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 },
  detailBtn: { backgroundColor: colors.danger, paddingHorizontal: 18, paddingVertical: 10, borderRadius: radius.md },
  detailText: { color: colors.surface, fontSize: 14, fontWeight: '700' },
  dismissBtn: { paddingHorizontal: 12, paddingVertical: 10 },
  dismissText: { color: colors.danger, fontSize: 14, fontWeight: '600' },

  eduCard: { backgroundColor: colors.primary, borderRadius: radius.lg, padding: 18, gap: 8 },
  eduCap: { fontSize: 11, fontWeight: '700', color: '#9DB2D9', letterSpacing: 0.5 },
  eduTitle: { fontSize: 16, fontWeight: '700', color: colors.surface },
  eduBody: { fontSize: 13, color: '#C7D2E8', lineHeight: 19 },
  eduBtn: { alignSelf: 'flex-start', backgroundColor: colors.surface, paddingHorizontal: 16, paddingVertical: 10, borderRadius: radius.pill, marginTop: 4 },
  eduBtnText: { color: colors.primary, fontSize: 13, fontWeight: '700' },

  empty: { fontSize: 13, color: colors.textMuted, textAlign: 'center', paddingVertical: 40 },
});
