import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { CommonActions, useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Fragment, useCallback, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Callout, Circle, Marker } from 'react-native-maps';
import AppHeader from '../components/AppHeader';
import NewsBanner from '../components/NewsBanner';
import SearchBar from '../components/SearchBar';
import { DANGER_LEVELS, INITIAL_REGION } from '../constants/config';
import { useNewsRealtime } from '../hooks/useNewsRealtime';
import { AVOID_MIN_LEVEL_SAFEST, avoidableReports, dangerRadiusM } from '../lib/routing';
import { RootStackParamList } from '../navigation/types';
import { getEmergencyContacts, getProfile } from '../services/profile';
import { getReports } from '../services/reports';
import { Report, UserProfile } from '../types';
import { colors, radius } from '../constants/theme';

function openReportSource(r: Report) {
  const url = r.sourceUrl || r.evidence.find((e) => e.type === 'link')?.url;
  if (url) Linking.openURL(url);
}

function firstName(full: string): string {
  return full.split(' ')[0] || full;
}

export default function HomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { latest, dismiss } = useNewsRealtime();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [activeContactCount, setActiveContactCount] = useState<number | null>(null);
  const [newsCount24h, setNewsCount24h] = useState<number | null>(null);
  const [reports, setReports] = useState<Report[]>([]);

  const danger = reports.length ? avoidableReports(reports, AVOID_MIN_LEVEL_SAFEST) : [];
  const info = reports.filter(
    (r) => r.trusted && r.level >= 1 && r.level < AVOID_MIN_LEVEL_SAFEST
  );

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      getProfile().then((p) => alive && setProfile(p));
      getEmergencyContacts().then((cs) => {
        if (alive) setActiveContactCount(cs.filter((c) => c.active).length);
      });
      getReports().then((rs) => {
        if (!alive) return;
        setReports(rs);
        const cutoff = Date.now() - 24 * 60 * 60 * 1000;
        const recent = rs.filter(
          (r) => r.source === 'news' && new Date(r.occurredAt).getTime() >= cutoff
        );
        setNewsCount24h(recent.length);
      });
      return () => {
        alive = false;
      };
    }, [])
  );

  return (
    <View style={styles.root}>
      <NewsBanner alert={latest} onDismiss={dismiss} />
      <AppHeader />

      {/* Map + overlay */}
      <View style={styles.mapArea}>
        <MapView
          style={styles.map}
          initialRegion={INITIAL_REGION}
          zoomEnabled
          scrollEnabled
          pitchEnabled
          rotateEnabled
        >
          {info.map((r) => {
            const meta = DANGER_LEVELS[r.level];
            return (
              <Marker
                key={r.id}
                coordinate={{ latitude: r.latitude, longitude: r.longitude }}
                anchor={{ x: 0.5, y: 0.5 }}
              >
                <View style={[styles.infoDot, { borderColor: meta.color, backgroundColor: `${meta.color}33` }]}>
                  <View style={[styles.infoDotCore, { backgroundColor: meta.color }]} />
                </View>
                <Callout onPress={() => openReportSource(r)}>
                  <View style={styles.callout}>
                    <Text style={[styles.calloutTitle, { color: meta.color }]}>
                      Level {r.level} · {meta.label}
                    </Text>
                    <Text style={styles.calloutDesc} numberOfLines={2}>
                      {r.locationName || r.description}
                    </Text>
                    {(r.source === 'news' || r.evidence.some((e) => e.type === 'link')) && (
                      <View style={styles.calloutLink}>
                        <Ionicons name="open-outline" size={12} color={colors.primary} />
                        <Text style={styles.calloutLinkText}>
                          {r.source === 'news' ? 'Baca berita' : 'Lihat bukti'}
                        </Text>
                      </View>
                    )}
                  </View>
                </Callout>
              </Marker>
            );
          })}

          {danger.map((r) => {
            const meta = DANGER_LEVELS[r.level];
            return (
              <Fragment key={r.id}>
                <Circle
                  center={{ latitude: r.latitude, longitude: r.longitude }}
                  radius={dangerRadiusM(r.level)}
                  strokeColor={meta.color}
                  fillColor={`${meta.color}33`}
                  strokeWidth={1}
                />
                <Marker coordinate={{ latitude: r.latitude, longitude: r.longitude }} pinColor={meta.color}>
                  <Callout onPress={() => openReportSource(r)}>
                    <View style={styles.callout}>
                      <Text style={[styles.calloutTitle, { color: meta.color }]}>
                        Level {r.level} · {meta.label}
                      </Text>
                      <Text style={styles.calloutDesc} numberOfLines={2}>
                        {r.locationName || r.description}
                      </Text>
                      {(r.source === 'news' || r.evidence.some((e) => e.type === 'link')) && (
                        <View style={styles.calloutLink}>
                          <Ionicons name="open-outline" size={12} color={colors.primary} />
                          <Text style={styles.calloutLinkText}>
                            {r.source === 'news' ? 'Baca berita' : 'Lihat bukti'}
                          </Text>
                        </View>
                      )}
                    </View>
                  </Callout>
                </Marker>
              </Fragment>
            );
          })}
        </MapView>
        <SearchBar />

        {/* Tombol SOS mengambang */}
        <Pressable style={styles.sosButton} onPress={() => navigation.navigate('SOS')}>
          <Text style={styles.sosText}>SOS</Text>
        </Pressable>

        {/* Kartu status (bottom sheet) */}
        <View style={styles.card}>
          <View style={styles.sheetHandle} />
          <View style={styles.cardRow}>
            <Text style={styles.greeting}>
              Halo, {profile ? firstName(profile.name) : '...'}!
            </Text>
            <View style={styles.levelPill}>
              <Ionicons name="shield-checkmark-outline" size={14} color={colors.primary} />
              <Text style={styles.levelText}>Level {profile?.level ?? '—'}</Text>
            </View>
          </View>

          <View style={styles.statusRow}>
            <View style={styles.dot} />
            <Text style={styles.statusText}>Status: Aman - Pemantauan Mati</Text>
          </View>

          {/* Stat cards */}
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
          
              <MaterialCommunityIcons name="map-marker-path" size={18} color={colors.primary} />
              <Text style={styles.statValue}>
                {profile ? `${profile.safeTripDays} Hari` : '—'}
              </Text>
              <Text style={styles.statLabel}>Trip Aman</Text>
            </View>
            <View style={styles.statsColumn}>
              <Pressable style={styles.actionCard} onPress={() => navigation.navigate('KontakDarurat')}>
                <Ionicons name="people-outline" size={18} color={colors.primary} />
                <View style={styles.actionContent}>
                  <Text style={styles.statValue}>  
                    {activeContactCount != null ? `${activeContactCount} Kontak` : '—'}
                  </Text>
                  <Text style={styles.statLabel}>Darurat</Text>
                </View>
              </Pressable>
              <Pressable style={styles.actionCard} onPress={() => navigation.navigate('LaporanKomunitas')}>
                <Ionicons name="document-text-outline" size={18} color={colors.primary} />
                <View style={styles.actionContent}>
                  <Text style={styles.statValue}>
                      {newsCount24h != null ? `${newsCount24h} Berita` : '—'}
                  </Text>
                  <Text style={styles.statLabel}>Terbaru</Text>
                </View>
              </Pressable>
            </View>
          </View>

          {/* CTA */}
          <Pressable
            style={styles.cta}
            onPress={() => navigation.dispatch(CommonActions.navigate({ name: 'perjalanan' }))}
          >
            <Ionicons name="warning-outline" size={18} color={colors.surface} />
            <Text style={styles.ctaText}>Mulai Perjalanan Aman</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  mapArea: { flex: 1 },
  map: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  sosButton: {
    position: 'absolute',
    right: 16,
    top: '45%',
    transform: [{ translateY: -55 }],

    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.danger,

    alignItems: 'center',
    justifyContent: 'center',
  },
  sosText: { color: colors.surface, fontWeight: '800', fontSize: 16 },
  sheetHandle: {
    width: 48,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#D1D5DB',
    alignSelf: 'center',
    marginBottom: 16,
  },
  card: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: 20,
    gap: 14,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  greeting: { fontSize: 20, fontWeight: '700', color: colors.textPrimary },
  levelPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  levelText: { fontSize: 12, color: colors.primary, fontWeight: '600' },

  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: -4 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
  statusText: { fontSize: 13, color: colors.textSecondary },

  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },

  statCard: {
    width: 150,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: 8,

    alignItems: 'center',     
    justifyContent: 'center', 

    gap: 2,
  },

  statsColumn: {
    flex: 1,
    gap: 10,
  },
  actionCard: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionContent: {
    flex: 1,
  },
  statValue: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  statLabel: { fontSize: 11, color: colors.textMuted },

  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    height: 52,
    borderRadius: radius.md,
  },
  ctaText: { color: colors.surface, fontSize: 16, fontWeight: '700' },

  infoDot: {
    width: 18, height: 18, borderRadius: 9,
    borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  infoDotCore: { width: 6, height: 6, borderRadius: 3 },
  callout: { width: 200, padding: 4, gap: 3 },
  calloutTitle: { fontSize: 13, fontWeight: '700' },
  calloutDesc: { fontSize: 12, color: colors.textSecondary, lineHeight: 16 },
  calloutLink: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  calloutLinkText: { fontSize: 11, color: colors.primary, fontWeight: '600' },
});
