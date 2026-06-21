import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import AppHeader from '../components/AppHeader';
import { DANGER_LEVELS } from '../constants/config';
import { INCIDENT_CATEGORIES } from '../constants/incident';
import { getReports, timeAgo } from '../services/reports';
import { Report } from '../types';
import { colors, radius } from '../constants/theme';

const SEVERITY: Record<number, string> = {
  5: 'PERINGATAN FATAL',
  4: 'BAHAYA',
  3: 'SIAGA',
  2: 'WASPADA',
  1: 'INFO',
};

const FILTERS = ['Semua', 'Begal', 'Tawuran'] as const;

export default function LaporanKomunitasScreen() {
  const [reports, setReports] = useState<Report[]>([]);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('Semua');

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      getReports().then((r) => alive && setReports(r));
      return () => {
        alive = false;
      };
    }, [])
  );

  const shown = reports.filter((r) => {
    if (filter === 'Begal') return r.category === 'pencurian';
    if (filter === 'Tawuran') return r.category === 'tawuran';
    return true;
  });

  return (
    <View style={styles.root}>
      <AppHeader />

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

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 12 }}>
        <Text style={styles.sectionLabel}>LAPORAN TERBARU ({shown.length})</Text>
        {shown.map((r) => (
          <ReportCard key={r.id} report={r} />
        ))}
      </ScrollView>
    </View>
  );
}

function ReportCard({ report: r }: { report: Report }) {
  const meta = DANGER_LEVELS[r.level];
  const cat = INCIDENT_CATEGORIES[r.category];
  const link = r.sourceUrl || r.evidence.find((e) => e.type === 'link')?.url;
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <View style={[styles.catIcon, { backgroundColor: `${meta.color}22` }]}>
          <Ionicons name={cat.icon} size={20} color={meta.color} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{r.title}</Text>
            <View style={[styles.sevBadge, { backgroundColor: meta.color }]}>
              <Text style={styles.sevText}>{SEVERITY[r.level]}</Text>
            </View>
          </View>
          <Text style={styles.location}>
            {r.locationName} · {timeAgo(r.occurredAt)}
          </Text>
        </View>
      </View>

      {/* Sumber berita */}
      <View style={styles.trustRow}>
        {r.source === 'news' ? (
          <>
            <Ionicons name="newspaper" size={15} color={colors.primary} />
            <Text style={[styles.trustText, { color: colors.primary }]} numberOfLines={1}>
              Sumber Berita · {r.reporterName}
            </Text>
          </>
        ) : r.trusted ? (
          <>
            <Ionicons name="checkmark-circle" size={15} color={colors.green} />
            <Text style={[styles.trustText, { color: colors.green }]}>
              Terverifikasi Berita · {r.confirmations} konfirmasi
            </Text>
          </>
        ) : (
          <>
            <Ionicons name="time-outline" size={15} color={colors.warning} />
            <Text style={[styles.trustText, { color: colors.warning }]}>
              Belum terverifikasi · {r.confirmations} konfirmasi
            </Text>
          </>
        )}
      </View>

      {/* Aksi */}
      <View style={styles.actions}>
        <Pressable
          style={[styles.confirmBtn, !link && styles.confirmBtnDisabled]}
          onPress={() => link && Linking.openURL(link)}
          disabled={!link}
        >
          <Ionicons name="open-outline" size={16} color={link ? colors.primary : colors.textMuted} />
          <Text style={[styles.confirmText, !link && { color: colors.textMuted }]}>Baca Berita</Text>
        </Pressable>
        <View style={styles.stat}>
          <Ionicons name="chatbubble-outline" size={15} color={colors.textMuted} />
          <Text style={styles.statText}>{r.comments}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },

  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: colors.surface },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, color: colors.textSecondary, fontWeight: '500' },
  chipTextActive: { color: colors.surface },

  sectionLabel: { fontSize: 11, color: colors.textMuted, fontWeight: '700', letterSpacing: 0.5, marginLeft: 4 },

  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 14, gap: 10 },
  cardHead: { flexDirection: 'row', gap: 12 },
  catIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  title: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  sevBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.sm },
  sevText: { color: colors.surface, fontSize: 9, fontWeight: '800', letterSpacing: 0.3 },
  location: { fontSize: 12, color: colors.textMuted, marginTop: 3 },

  trustRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  trustText: { fontSize: 12, fontWeight: '600' },

  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: 10,
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  confirmBtnDisabled: { opacity: 0.5 },
  confirmText: { fontSize: 13, color: colors.primary, fontWeight: '700' },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { fontSize: 13, color: colors.textMuted },
});
