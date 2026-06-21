import { Ionicons } from '@expo/vector-icons';
import { CommonActions, useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Fragment, useCallback, useMemo, useRef, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Callout, Circle, Marker } from 'react-native-maps';
import AppHeader from '../components/AppHeader';
import SearchBar from '../components/SearchBar';
import { DANGER_LEVELS, INITIAL_REGION } from '../constants/config';
import { RootStackParamList } from '../navigation/types';
import { getReports } from '../services/reports';
import { Report } from '../types';
import { colors, radius } from '../constants/theme';

const FILTERS = ['Hari Ini', 'Minggu Ini', 'Bulan Ini'] as const;

// Buka link sumber laporan (berita / bukti) di browser.
function openReportSource(r: Report) {
  const url = r.sourceUrl || r.evidence.find((e) => e.type === 'link')?.url;
  if (url) Linking.openURL(url);
}

export default function PetaScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const mapRef = useRef<MapView>(null);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('Hari Ini');
  const [reports, setReports] = useState<Report[]>([]);

  async function zoom(delta: number) {
    const cam = await mapRef.current?.getCamera();
    if (cam) mapRef.current?.animateCamera({ ...cam, zoom: (cam.zoom ?? 12) + delta }, { duration: 250 });
  }

  // Refresh tiap layar di-fokus → kalo pipeline baru jalan, marker langsung
  // ke-update tanpa perlu reload manual.
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      getReports().then((r) => alive && setReports(r));
      return () => {
        alive = false;
      };
    }, [])
  );

  // Hanya kejadian terverifikasi yang tampil di peta.
  const visible = useMemo(() => reports.filter((r) => r.trusted), [reports]);

  return (
    <View style={styles.root}>
      <AppHeader />
      <SearchBar placeholder="Cari lokasi aman..." />

      {/* Filter waktu */}
      <View style={styles.filterRow}>
        {FILTERS.map((f) => {
          const active = f === filter;
          return (
            <Pressable
              key={f}
              onPress={() => setFilter(f)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{f}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* Peta */}
      <View style={styles.mapArea}>
        <MapView ref={mapRef} style={styles.map} initialRegion={INITIAL_REGION} zoomEnabled>
          {visible.map((r) => {
            const meta = DANGER_LEVELS[r.level];
            return (
              <Fragment key={r.id}>
                <Circle
                  center={{ latitude: r.latitude, longitude: r.longitude }}
                  radius={100 + r.level * 40}
                  strokeColor={meta.color}
                  fillColor={`${meta.color}40`}
                  strokeWidth={1}
                />
                <Marker coordinate={{ latitude: r.latitude, longitude: r.longitude }} pinColor={meta.color}>
                  <Callout onPress={() => openReportSource(r)} tooltip={false}>
                    <View style={styles.callout}>
                      <Text style={[styles.calloutTitle, { color: meta.color }]}>
                        Level {r.level} · {meta.label}
                      </Text>
                      <Text style={styles.calloutDesc} numberOfLines={3}>
                        {r.description}
                      </Text>
                      {r.source === 'news' ? (
                        <View style={styles.calloutLink}>
                          <Ionicons name="newspaper-outline" size={12} color={colors.primary} />
                          <Text style={styles.calloutLinkText}>Baca berita · {r.reporterName}</Text>
                        </View>
                      ) : r.evidence.some((e) => e.type === 'link') ? (
                        <View style={styles.calloutLink}>
                          <Ionicons name="open-outline" size={12} color={colors.primary} />
                          <Text style={styles.calloutLinkText}>Lihat bukti</Text>
                        </View>
                      ) : null}
                    </View>
                  </Callout>
                </Marker>
              </Fragment>
            );
          })}
        </MapView>

        {/* Tombol lokasi mengambang */}
        <Pressable style={styles.fab}>
          <Ionicons name="locate" size={22} color={colors.primary} />
        </Pressable>

        {/* Kontrol zoom */}
        <View style={styles.zoomCtl}>
          <Pressable style={styles.zoomBtn} onPress={() => zoom(1)}>
            <Ionicons name="add" size={22} color={colors.textPrimary} />
          </Pressable>
          <View style={styles.zoomDivider} />
          <Pressable style={styles.zoomBtn} onPress={() => zoom(-1)}>
            <Ionicons name="remove" size={22} color={colors.textPrimary} />
          </Pressable>
        </View>

        {/* Legenda level (compact: Aman → Bahaya) */}
        <View style={styles.legend}>
          <Text style={styles.legendCap}>Aman</Text>
          <View style={styles.legendStrip}>
            {Object.values(DANGER_LEVELS).map((meta, i) => (
              <View key={i} style={{ flex: 1, backgroundColor: meta.color }} />
            ))}
          </View>
          <Text style={styles.legendCap}>Bahaya</Text>
        </View>

        {/* Kartu area (bottom sheet) */}
        <View style={styles.card}>
          <View style={styles.cardHead}>
            <View>
              <Text style={styles.areaLabel}>AREA SAAT INI</Text>
              <Text style={styles.areaName}>Main Quadrangle</Text>
            </View>
            <View style={styles.safeBadge}>
              <Ionicons name="shield-checkmark" size={14} color={colors.safeBadgeText} />
              <Text style={styles.safeBadgeText}>Keamanan Tinggi</Text>
            </View>
          </View>

          <View style={styles.actions}>
            <Pressable
              style={[styles.actionBtn, styles.navBtn]}
              onPress={() => navigation.dispatch(CommonActions.navigate({ name: 'perjalanan' }))}
            >
              <Ionicons name="navigate-outline" size={18} color={colors.primary} />
              <Text style={styles.navText}>Mulai Navigasi</Text>
            </Pressable>
            <Pressable
              style={[styles.actionBtn, styles.reportBtn]}
              onPress={() => navigation.navigate('LaporanKomunitas')}
            >
              <Ionicons name="newspaper-outline" size={18} color={colors.dangerText} />
              <Text style={styles.reportText}>Lihat Berita</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },

  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 10 },
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

  mapArea: { flex: 1 },
  map: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  fab: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 4,
  },
  zoomCtl: {
    position: 'absolute',
    right: 16,
    top: 76,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 4,
  },
  zoomBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  zoomDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  legend: {
    position: 'absolute',
    top: 14,
    left: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: radius.pill,
    paddingVertical: 5,
    paddingHorizontal: 10,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  legendCap: { fontSize: 10, color: colors.textMuted, fontWeight: '600' },
  legendStrip: { flexDirection: 'row', width: 56, height: 7, borderRadius: 4, overflow: 'hidden' },

  callout: { width: 220, padding: 4, gap: 4 },
  calloutTitle: { fontSize: 13, fontWeight: '700' },
  calloutDesc: { fontSize: 12, color: colors.textSecondary, lineHeight: 16 },
  calloutLink: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  calloutLinkText: { fontSize: 11, color: colors.primary, fontWeight: '600' },

  card: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: 20,
    gap: 16,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  areaLabel: { fontSize: 11, color: colors.textMuted, fontWeight: '600', letterSpacing: 0.5 },
  areaName: { fontSize: 18, fontWeight: '700', color: colors.textPrimary, marginTop: 2 },
  safeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.safeBadgeBg,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  safeBadgeText: { fontSize: 12, color: colors.safeBadgeText, fontWeight: '600' },

  actions: { flexDirection: 'row', gap: 12 },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: radius.md,
  },
  navBtn: { borderWidth: 1.5, borderColor: colors.primary },
  navText: { color: colors.primary, fontWeight: '700', fontSize: 14 },
  reportBtn: { backgroundColor: colors.dangerBg },
  reportText: { color: colors.dangerText, fontWeight: '700', fontSize: 14 },
});
