import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Location from 'expo-location';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import MapView, { Callout, Circle, Marker, Polyline } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LocationSearchModal from '../components/LocationSearchModal';
import { DANGER_LEVELS } from '../constants/config';
import {
  AVOID_MIN_LEVEL_SAFEST,
  Place,
  RouteResult,
  ThreeRoutes,
  avoidableReports,
  dangerRadiusM,
  getThreeRoutes,
  reverseGeocode,
} from '../lib/routing';
import { RootStackParamList } from '../navigation/types';
import { getReports } from '../services/reports';
import SetupPinModal from '../components/SetupPinModal';
import { hasSafetyPin } from '../services/profile';
import { createTrip } from '../services/trips';
import { Report } from '../types';
import { colors, radius } from '../constants/theme';

function openReportSource(r: Report) {
  const url = r.sourceUrl || r.evidence.find((e) => e.type === 'link')?.url;
  if (url) Linking.openURL(url);
}

type RouteKey = 'teraman' | 'waspada' | 'risiko';

const META: Record<
  RouteKey,
  { name: string; icon: keyof typeof Ionicons.glyphMap; color: string; bg: string; tag: string; sub: string }
> = {
  teraman: { name: 'Rute Teraman', icon: 'shield-checkmark', color: '#16A34A', bg: '#DCFCE7', tag: 'Terbaik', sub: 'Penerangan Baik' },
  waspada: { name: 'Rute Waspada', icon: 'warning', color: '#CA8A04', bg: '#FEF9C3', tag: 'Area Sepi', sub: 'Hati-hati' },
  risiko: { name: 'Rute Risiko Tinggi', icon: 'alert-circle', color: '#DC2626', bg: '#FEE2E2', tag: 'Cepat', sub: 'Rawan Begal' },
};

type RouteState = 'idle' | 'loading' | 'ready' | 'error';

export default function PerjalananScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const [origin, setOrigin] = useState<Place | null>(null);
  const [dest, setDest] = useState<Place | null>(null);
  const [routes, setRoutes] = useState<ThreeRoutes | null>(null);
  const [routeState, setRouteState] = useState<RouteState>('idle');
  const [selected, setSelected] = useState<RouteKey>('teraman');
  const [editing, setEditing] = useState<'origin' | 'dest' | null>(null);
  const [locatingOrigin, setLocatingOrigin] = useState(true);
  const [reports, setReports] = useState<Report[] | null>(null);
  const [creatingTrip, setCreatingTrip] = useState(false);
  const [showPinSetup, setShowPinSetup] = useState(false);

  useEffect(() => {
    let alive = true;
    getReports().then((r) => alive && setReports(r));
    return () => {
      alive = false;
    };
  }, []);

  const danger = useMemo(
    () => (reports ? avoidableReports(reports, AVOID_MIN_LEVEL_SAFEST) : []),
    [reports]
  );

  const info = useMemo(
    () =>
      (reports ?? []).filter(
        (r) => r.trusted && r.level >= 1 && r.level < AVOID_MIN_LEVEL_SAFEST
      ),
    [reports]
  );

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          if (alive) setLocatingOrigin(false);
          return;
        }
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const point = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
        const label = await reverseGeocode(point);
        if (alive) setOrigin({ ...point, label });
      } catch (e) {
        console.warn('[perjalanan] gagal ambil lokasi', e);
      } finally {
        if (alive) setLocatingOrigin(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!origin || !dest) {
      setRoutes(null);
      setRouteState('idle');
      return;
    }
    if (!reports) {
      setRouteState('loading');
      return;
    }
    let alive = true;
    setRoutes(null);
    setRouteState('loading');
    getThreeRoutes(origin, dest, reports).then((r) => {
      if (!alive) return;
      if (r) {
        setRoutes(r);
        setRouteState('ready');
      } else {
        setRouteState('error');
      }
    });
    return () => {
      alive = false;
    };
  }, [origin, dest, reports]);

  function swap() {
    if (!origin || !dest) return;
    setOrigin(dest);
    setDest(origin);
  }

  const selectedRoute: RouteResult | undefined = routes?.[selected];
  const mapRef = useRef<MapView>(null);

  const region = useMemo(() => {
    if (origin && dest) {
      return {
        latitude: (origin.latitude + dest.latitude) / 2,
        longitude: (origin.longitude + dest.longitude) / 2,
        latitudeDelta: Math.max(0.04, Math.abs(origin.latitude - dest.latitude) * 1.8),
        longitudeDelta: Math.max(0.04, Math.abs(origin.longitude - dest.longitude) * 1.8),
      };
    }
    const focus = origin ?? dest;
    if (focus) {
      return { latitude: focus.latitude, longitude: focus.longitude, latitudeDelta: 0.04, longitudeDelta: 0.04 };
    }
    return { latitude: -6.343, longitude: 106.737, latitudeDelta: 0.08, longitudeDelta: 0.08 };
  }, [origin, dest]);

  useEffect(() => {
    mapRef.current?.animateToRegion(region, 500);
  }, [region]);

  const ROUTE_ORDER: RouteKey[] = ['teraman', 'waspada', 'risiko'];

  return (
    <View style={styles.root}>
      <View style={styles.mapArea}>
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={region}
          zoomEnabled
          zoomControlEnabled
          scrollEnabled
          pitchEnabled
          rotateEnabled
        >
          {/* Insiden ringan (level 1-2) — marker kecil, tanpa circle, FYI saja */}
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

          {/* Zona rawan (digambar di bawah garis rute) — radius = zona yang dihindari router */}
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
                  zIndex={1}
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

          {routes &&
            ROUTE_ORDER.map((k) => (
              <Polyline
                key={k}
                coordinates={routes[k].coordinates}
                strokeColor={selected === k ? META[k].color : `${META[k].color}55`}
                strokeWidth={selected === k ? 6 : 3}
                zIndex={selected === k ? 5 : 3}
              />
            ))}
          {origin && <Marker coordinate={origin} title={origin.label} pinColor={colors.primary} />}
          {dest && <Marker coordinate={dest} title={dest.label} pinColor={colors.danger} />}
        </MapView>
        {/* Asal & tujuan */}
        <View style={styles.locCard}>
          <View style={{ flex: 1 }}>
            <Pressable style={styles.locRow} onPress={() => setEditing('origin')}>
              <Ionicons name="radio-button-on" size={18} color={colors.primary} />
              <Text
                style={[styles.locText, !origin && styles.locTextPlaceholder]}
                numberOfLines={1}
              >
                {origin ? origin.label : locatingOrigin ? 'Mencari lokasi anda...' : 'Pilih lokasi awal'}
              </Text>
              <Text style={styles.locTag}>Lokasi Awal</Text>
            </Pressable>
            <View style={styles.locDivider} />
            <Pressable style={styles.locRow} onPress={() => setEditing('dest')}>
              <Ionicons name="location" size={18} color={colors.danger} />
              <Text
                style={[styles.locText, !dest && styles.locTextPlaceholder]}
                numberOfLines={1}
              >
                {dest ? dest.label : 'Mau ke mana?'}
              </Text>
              <Text style={styles.locTag}>Tujuan</Text>
            </Pressable>
          </View>
          <Pressable
            style={[styles.swapBtn, (!origin || !dest) && { opacity: 0.4 }]}
            onPress={swap}
            disabled={!origin || !dest}
            hitSlop={6}
          >
            <Ionicons name="swap-vertical" size={18} color={colors.textSecondary} />
          </Pressable>
        </View>
        <View style={styles.floatingActions}>
          <Pressable style={styles.sos} onPress={() => navigation.navigate('SOS')}>
            <Text style={styles.sosText}>SOS</Text>
          </Pressable>
          {/* <Pressable style={styles.laporan} onPress={() => navigation.navigate('LaporInsiden')}>
            <Ionicons name="warning-outline" size={14} color={colors.warning} />
            <Text style={styles.laporanText}>Laporan</Text>
          </Pressable> */}
        </View>
        {/* Peta */}
        <View style={styles.card}>
          {/* Pilih rute */}
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Pilih Rute</Text>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{
                paddingBottom: 65,
                gap: 15,
              }}
            >              
              {ROUTE_ORDER.map((k) => {
                const m = META[k];
                const r = routes?.[k];
                const active = selected === k;
                return (
                  <Pressable key={k} style={[styles.routeCard, active && { borderColor: m.color }]} onPress={() => setSelected(k)}>
                    <View style={[styles.routeIcon, { backgroundColor: m.bg }]}>
                      <Ionicons name={m.icon} size={22} color={m.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.routeName}>{m.name}</Text>
                      <Text style={styles.routeMeta}>
                        {r ? `${Math.round(r.durationMin)} min • ${r.distanceKm.toFixed(1)} km` : 'menghitung...'}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 2 }}>
                      <View style={[styles.scoreBadge, { backgroundColor: m.bg }]}>
                        <Text style={[styles.scoreText, { color: m.color }]}>{r ? r.safetyScore : '—'} SCORE</Text>
                      </View>
                      <Text style={[styles.routeTag, { color: m.color }]}>{m.tag}</Text>
                      <Text style={styles.routeSub}>{m.sub}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </View>
      {/* Mulai */}
      <View style={[styles.footer, { paddingBottom: insets.bottom  }]}>
        <Pressable
          style={[styles.cta, (!selectedRoute || creatingTrip) && styles.ctaDisabled]}
          disabled={!selectedRoute || creatingTrip}
          onPress={async () => {
            if (!selectedRoute || !origin || !dest) return;
            const pinReady = await hasSafetyPin();
            if (!pinReady) {
              setShowPinSetup(true);
              return;
            }
            setCreatingTrip(true);
            const trip = await createTrip(origin, dest);
            setCreatingTrip(false);
            navigation.navigate('NavigasiAktif', {
              coords: selectedRoute.coordinates,
              steps: selectedRoute.steps,
              tripId: trip?.id,
            });
          }}
        >
          {creatingTrip ? (
            <ActivityIndicator color={colors.surface} />
          ) : (
            <>
              <Ionicons name="navigate" size={18} color={colors.surface} />
              <Text style={styles.ctaText}>Mulai Perjalanan</Text>
            </>
          )}
        </Pressable>
      </View>

      <LocationSearchModal
        visible={editing !== null}
        title={editing === 'origin' ? 'Lokasi Awal' : 'Tujuan'}
        onClose={() => setEditing(null)}
        onSelect={(p) => {
          if (editing === 'origin') setOrigin(p);
          else setDest(p);
          setEditing(null);
        }}
      />

      <SetupPinModal
        visible={showPinSetup}
        onClose={() => setShowPinSetup(false)}
        onSaved={async () => {
          if (!selectedRoute || !origin || !dest) return;
          setCreatingTrip(true);
          const trip = await createTrip(origin, dest);
          setCreatingTrip(false);
          navigation.navigate('NavigasiAktif', {
            coords: selectedRoute.coordinates,
            steps: selectedRoute.steps,
            tripId: trip?.id,
          });
        }}
      />

    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  mapArea: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 12, backgroundColor: colors.surface },
  headerTitle: { fontSize: 20, fontWeight: '700', color: colors.textPrimary },
  card: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,

    maxHeight: '40%',

    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,

    paddingTop: 20,

    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  locCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    marginHorizontal: 16,
    marginTop : 55,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  locText: { flex: 1, fontSize: 14, color: colors.textPrimary, fontWeight: '600' },
  locTextPlaceholder: { color: colors.textMuted, fontWeight: '500' },
  locTag: { fontSize: 11, color: colors.textMuted },
  locDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 28 },
  swapBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  map: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  sheetHandle: {
    width: 48,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#D1D5DB',
    alignSelf: 'center',
  },
  floatingActions: {
    position: 'absolute',
    right: 16,
    top: '55%',
    alignItems: 'flex-end',
    transform: [{ translateY: -60 }],
    gap: 12,
  },
  sos: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
  },
  sosText: { color: colors.surface, fontWeight: '800', fontSize: 15 },
  laporan: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  laporanText: { color: colors.surface, fontSize: 12, fontWeight: '600' },

  sheet: { paddingHorizontal: 16, gap: 12 },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  routeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: 14,
  },
  routeIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  routeName: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  routeMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  scoreBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.sm },
  scoreText: { fontSize: 10, fontWeight: '800' },
  routeTag: { fontSize: 13, fontWeight: '700' },
  routeSub: { fontSize: 11, color: colors.textMuted },

  callout: { width: 200, padding: 4, gap: 3 },
  calloutTitle: { fontSize: 13, fontWeight: '700' },
  infoDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoDotCore: { width: 6, height: 6, borderRadius: 3 },
  calloutDesc: { fontSize: 12, color: colors.textSecondary, lineHeight: 16 },
  calloutLink: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  calloutLinkText: { fontSize: 11, color: colors.primary, fontWeight: '600' },

  emptyState: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  emptySub: { fontSize: 12, color: colors.textMuted, textAlign: 'center', lineHeight: 17 },

  footer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    height: 52,
    borderRadius: radius.md,
  },
  ctaDisabled: { opacity: 0.6 },
  ctaText: { color: colors.surface, fontSize: 16, fontWeight: '700' },
});
