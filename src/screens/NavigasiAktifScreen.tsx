import { Ionicons, MaterialCommunityIcons, MaterialIcons, } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Battery from 'expo-battery';
import * as Location from 'expo-location';
import { Fragment, useEffect, useRef, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import MapView, { Callout, Circle, Marker, Polyline } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LowBatteryModal from '../components/LowBatteryModal';
import RouteDeviationModal from '../components/RouteDeviationModal';
import { DANGER_LEVELS } from '../constants/config';
import { RootStackParamList } from '../navigation/types';
import { getReports } from '../services/reports';
import { sendManualSos } from '../services/sos';
import { endTrip, sendHeartbeat, simulateBegal } from '../services/trips';
import { reverseGeocode } from '../lib/routing';
import { Report } from '../types';
import { colors, radius } from '../constants/theme';

const GREEN = '#006D3B';
const ROUTE_GREEN = '#16A34A';
const BANNER = '#0B1C30';

type LL = { latitude: number; longitude: number };

const FALLBACK_ROUTE: LL[] = [
  { latitude: -6.343, longitude: 106.737 },
  { latitude: -6.335, longitude: 106.748 },
  { latitude: -6.32, longitude: 106.755 },
  { latitude: -6.3, longitude: 106.745 },
  { latitude: -6.282, longitude: 106.725 },
  { latitude: -6.265, longitude: 106.705 },
];

const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

function haversineM(a: LL, b: LL): number {
  const R = 6_371_000;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function bearingDeg(a: LL, b: LL): number {
  const y = Math.sin(toRad(b.longitude - a.longitude)) * Math.cos(toRad(b.latitude));
  const x =
    Math.cos(toRad(a.latitude)) * Math.sin(toRad(b.latitude)) -
    Math.sin(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.cos(toRad(b.longitude - a.longitude));
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function nearestIndex(coords: LL[], p: LL): number {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < coords.length; i++) {
    const d = haversineM(coords[i], p);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

function remainingMeters(coords: LL[], fromIdx: number): number {
  let m = 0;
  for (let i = fromIdx; i < coords.length - 1; i++) m += haversineM(coords[i], coords[i + 1]);
  return m;
}

function fmtDist(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m / 10) * 10} m`;
}

export default function NavigasiAktifScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'NavigasiAktif'>>();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);

  const routeCoords: LL[] =
    route.params?.coords && route.params.coords.length > 1 ? route.params.coords : FALLBACK_ROUTE;
  const steps = route.params?.steps ?? [];
  const tripId = route.params?.tripId;

  const [userLoc, setUserLoc] = useState<(LL & { heading: number }) | null>(null);
  const [remainingM, setRemainingM] = useState(remainingMeters(routeCoords, 0));
  const [maneuver, setManeuver] = useState<{ instruction: string; distanceM: number } | null>(
    steps[0] ? { instruction: steps[0].instruction, distanceM: steps[0].distanceM } : null
  );
  const [simulating, setSimulating] = useState(true); // default: demo drive (emulator GPS diam)
  const [nearbyDanger, setNearbyDanger] = useState<{ title: string; distM: number; color: string } | null>(null);
  const [showDeviation, setShowDeviation] = useState(false);
  const [danger, setDanger] = useState<Report[]>([]);
  const dangerRef = useRef<Report[]>([]);
  const stepIdxRef = useRef(0);
  const deviationShownRef = useRef(false);
  const heartbeatRef = useRef<{ lat: number; lon: number; batt: number | null } | null>(null);
  const endedRef = useRef(false);
  const [simState, setSimState] = useState<'idle' | 'firing' | 'fired'>('idle');
  const [simResult, setSimResult] = useState<{ sent: number } | null>(null);
  const simRef = useRef(false);

  useEffect(() => {
    let alive = true;
    getReports().then((r) => {
      if (!alive) return;
      const trusted = r.filter((x) => x.trusted);
      setDanger(trusted);
      dangerRef.current = trusted;
    });
    return () => {
      alive = false;
    };
  }, []);

  function onPosition(p: LL & { heading: number }) {
    setUserLoc(p);
    mapRef.current?.animateCamera(
      { center: p, heading: p.heading, pitch: 50, zoom: 15.8 },
      { duration: 600 }
    );
    const idx = nearestIndex(routeCoords, p);
    setRemainingM(remainingMeters(routeCoords, idx));
    if (!deviationShownRef.current && haversineM(p, routeCoords[idx]) > 150) {
      deviationShownRef.current = true;
      setShowDeviation(true);
    }
    let nearest: Report | null = null;
    let bestD = Infinity;
    for (const d of dangerRef.current) {
      const dist = haversineM(p, d);
      if (dist < bestD) {
        bestD = dist;
        nearest = d;
      }
    }
    setNearbyDanger(
      nearest && bestD < 600
        ? { title: nearest.title, distM: bestD, color: DANGER_LEVELS[nearest.level].color }
        : null
    );
    if (steps.length) {
      let si = stepIdxRef.current;
      while (si < steps.length - 1 && haversineM(p, steps[si].location) < 30) si++;
      stepIdxRef.current = si;
      setManeuver({
        instruction: steps[si].instruction,
        distanceM: haversineM(p, steps[si].location),
      });
    }
  }

  useEffect(() => {
    let sub: Location.LocationSubscription | undefined;
    let timer: ReturnType<typeof setInterval> | undefined;

    if (simulating) {
      let i = 0;
      const stepBy = Math.max(1, Math.round(routeCoords.length / 150));
      timer = setInterval(() => {
        if (i >= routeCoords.length - 1) {
          clearInterval(timer);
          return;
        }
        const cur = routeCoords[i];
        const nxt = routeCoords[Math.min(i + stepBy, routeCoords.length - 1)];
        onPosition({ ...cur, heading: bearingDeg(cur, nxt) });
        i += stepBy;
      }, 550);
    } else {
      (async () => {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        sub = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 4 },
          (loc) =>
            onPosition({
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
              heading: loc.coords.heading ?? 0,
            })
        );
      })();
    }

    return () => {
      sub?.remove();
      if (timer) clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simulating]);

  const level = Battery.useBatteryLevel();
  const battPct = level != null && level >= 0 ? Math.round(level * 100) : 100;
  const battStable = battPct > 20;

  useEffect(() => {
    if (userLoc) {
      heartbeatRef.current = {
        lat: userLoc.latitude,
        lon: userLoc.longitude,
        batt: battPct,
      };
    }
  }, [userLoc, battPct]);

  useEffect(() => {
    if (!tripId) return;
    const tick = () => {
      if (simRef.current) return;
      const h = heartbeatRef.current;
      if (h) sendHeartbeat(tripId, h.lat, h.lon, h.batt);
    };
    tick();
    const timer = setInterval(tick, 20_000);
    return () => clearInterval(timer);
  }, [tripId]);

  async function triggerSim() {
    if (simRef.current) return;
    simRef.current = true;
    setSimState('firing');
    let sent = 0;
    if (tripId) {
      const result = await simulateBegal(tripId);
      if (result) sent = result.sent;
    } else {
      const fallback = await sendManualSos({
        locationLabel: userLoc ? undefined : 'Mode demo',
        lat: userLoc?.latitude,
        lon: userLoc?.longitude,
        batteryPct: battPct,
      });
      sent = fallback?.sent ?? 0;
    }
    setSimResult({ sent });
    setSimState('fired');
  }

  async function autoSosTelegram() {
    if (!userLoc) {
      await sendManualSos({ batteryPct: battPct });
      return;
    }
    let label: string | undefined;
    try {
      label = await reverseGeocode({ latitude: userLoc.latitude, longitude: userLoc.longitude });
    } catch {
      // best effort
    }
    await sendManualSos({
      locationLabel: label,
      lat: userLoc.latitude,
      lon: userLoc.longitude,
      batteryPct: battPct,
    });
  }

  function finishTrip(status: 'arrived' | 'sos' | 'cancelled') {
    if (!tripId || endedRef.current) return;
    endedRef.current = true;
    const h = heartbeatRef.current;
    if (h) sendHeartbeat(tripId, h.lat, h.lon, h.batt);
    endTrip(tripId, status);
  }

  useEffect(() => {
    return () => {
      if (tripId && !endedRef.current) {
        endedRef.current = true;
        endTrip(tripId, 'cancelled');
      }
    };
  }, [tripId]);

  const [showBattery, setShowBattery] = useState(false);
  useEffect(() => {
    if (battPct <= 15) setShowBattery(true);
  }, [battPct]);

  const remainingKm = remainingM / 1000;
  const etaMin = Math.max(1, Math.round((remainingKm / 25) * 60)); // asumsi 25 km/jam
  const eta = new Date(Date.now() + etaMin * 60000);
  const etaStr = `${eta.getHours().toString().padStart(2, '0')}:${eta.getMinutes().toString().padStart(2, '0')}`;

  return (
    <View style={styles.root}>
      {/* Peta */}
      <View style={styles.mapArea}>
        {/* Peta */}
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={{
            latitude: routeCoords[0].latitude,
            longitude: routeCoords[0].longitude,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }}
          showsCompass
          mapPadding={{
            top: 120,
            right: 0,
            bottom: 0,
            left: 0,
          }}
        >
          {danger.map((r) => {
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
                  <Callout
                    onPress={() => {
                      const url = r.sourceUrl || r.evidence.find((e) => e.type === 'link')?.url;
                      if (url) Linking.openURL(url);
                    }}
                  >
                    <View style={styles.callout}>
                      <Text style={[styles.calloutTitle, { color: meta.color }]}>
                        Level {r.level} · {meta.label}
                      </Text>
                      <Text style={styles.calloutDesc} numberOfLines={3}>
                        {r.description}
                      </Text>
                      {(r.source === 'news' || r.evidence.some((e) => e.type === 'link')) && (
                        <View style={styles.calloutLink}>
                          <Ionicons name="newspaper-outline" size={12} color={colors.primary} />
                          <Text style={styles.calloutLinkText}>
                            {r.source === 'news' ? `Baca berita · ${r.reporterName}` : 'Lihat bukti'}
                          </Text>
                        </View>
                      )}
                    </View>
                  </Callout>
                </Marker>
              </Fragment>
            );
          })}

          <Polyline coordinates={routeCoords} strokeColor={ROUTE_GREEN} strokeWidth={7} />

          {/* Penanda posisi pengguna (panah arah) */}
          {userLoc && (
            <Marker coordinate={userLoc} flat rotation={userLoc.heading} anchor={{ x: 0.5, y: 0.5 }}>
              <View style={styles.userDot}>
                <MaterialCommunityIcons name="navigation" size={20} color={colors.surface} />
              </View>
            </Marker>
          )}
        </MapView>
          <Pressable
            onLongPress={triggerSim}
            delayLongPress={800}
            style={[
              styles.banner,
              simState !== 'idle' && styles.bannerSim,
            ]}
          >
            <View style={styles.turnIcon}>
              <Ionicons
                name={simState === 'idle' ? 'arrow-up' : simState === 'firing' ? 'sync' : 'warning'}
                size={24}
                color={BANNER}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.turnMain} numberOfLines={1}>
                {simState === 'firing'
                  ? 'Simulasi: heartbeat dihentikan…'
                  : simState === 'fired'
                    ? `🚨 Auto-SOS terkirim ke ${simResult?.sent ?? 0} kontak`
                    : maneuver
                      ? maneuver.instruction
                      : 'Mengikuti rute'}
              </Text>
              <Text style={styles.turnSub}>
                {simState === 'fired'
                  ? 'Cek Telegram kontak darurat'
                  : simState === 'firing'
                    ? 'Memicu dead-man\'s switch'
                    : maneuver
                      ? `${fmtDist(maneuver.distanceM)} lagi`
                      : `${fmtDist(remainingM)} tersisa`}
              </Text>
            </View>
            <Ionicons
              name={simState === 'idle' ? 'volume-high' : 'flask'}
              size={22}
              color={colors.surface}
            />
          </Pressable>

        {/* Toggle simulasi / GPS */}
        <Pressable
          style={styles.simBtn}
          onPress={() => setSimulating((s) => !s)}
        >
          <Ionicons name={simulating ? 'play' : 'navigate'} size={14} color={colors.surface} />
          <Text style={styles.simText}>{simulating ? 'Simulasi' : 'GPS Aktif'}</Text>
        </Pressable>

        {/* Peringatan zona rawan di dekat */}
        {nearbyDanger && (
          <View style={[styles.dangerChip, { borderColor: nearbyDanger.color }]}>
            <Ionicons name="warning" size={16} color={nearbyDanger.color} />
            <Text style={styles.dangerChipText} numberOfLines={1}>
              {nearbyDanger.title} · {fmtDist(nearbyDanger.distM)}
            </Text>
          </View>
        )}
        <View style={styles.floatingActions}>
          <Pressable style={styles.sos} onPress={() => navigation.navigate('SOS')}>
            <Text style={styles.sosText}>SOS</Text>
          </Pressable>
          {/* <Pressable style={styles.laporan} onPress={() => navigation.navigate('LaporInsiden')}>
            <Ionicons name="warning-outline" size={14} color={colors.warning} />
            <Text style={styles.laporanText}>Laporan</Text>
          </Pressable> */}
        </View>

        <View style={styles.card}>   
          {/* Bottom sheet monitoring */}
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingBottom: insets.bottom + 8 }}>
              <View style={styles.sheetHead}>
                <Pressable
                  onLongPress={() => {
                    deviationShownRef.current = true;
                    setShowDeviation(true);
                  }}
                  delayLongPress={800}
                  style={styles.monitorRow}
                >
                  <View style={styles.dot} />
                  <Text style={styles.monitorText}>Monitoring Aktif</Text>
                </Pressable>
                <Pressable style={styles.selesaiBtn} onPress={() => navigation.popToTop()}>
                  <Text style={styles.selesaiText}>Selesai</Text>
                </Pressable>
              </View>

              <View style={styles.statsRow}>
                <View style={styles.statCard}>
                  <Text style={styles.statLabel}>ESTIMASI TIBA</Text>
                  <Text style={styles.statBig}>
                    {etaStr} <Text style={styles.statUnit}>WIB</Text>
                  </Text>
                  <View style={styles.divider} />
                  <Text style={styles.statSub}>{fmtDist(remainingM)} tersisa</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statLabel}>SKOR KEAMANAN</Text>
                  <View style={styles.scoreRow}>
                    <Text style={[styles.statBig, { color: GREEN }]}>98</Text>

                    <Text style={[styles.statSub, { color: GREEN }]}>
                      Sangat{"\n"}Aman
                    </Text>
                  </View>
                  <View style={styles.divider} />
                  <View style={styles.battRow}>
                    <Ionicons name="battery-half" size={18} color={battStable ? GREEN : colors.danger} />
                    <Text style={styles.battPct}>{battPct}%</Text>
                    <Text style={[styles.battState, { color: battStable ? GREEN : colors.danger }]}>
                      {battStable ? 'Stabil' : 'Lemah'}
                    </Text>
                  </View>
            
                </View>
              </View>

              <View style={styles.analisis}>
                <Text style={styles.analisisTitle}>Analisis Rute</Text>
                {[
                  { icon: 'sunny-outline' as const, text: 'Penerangan jalan sangat baik' },
                  { icon: 'videocam-outline' as const, text: 'Terpantau CCTV 24/7' },
                  { icon: 'people-outline' as const, text: 'Area ramai pejalan kaki' },
                ].map((a) => (
                  <View key={a.text} style={styles.analisisRow}>
                    <Ionicons name={a.icon} size={16} color={colors.primaryAlt} />
                    <Text style={styles.analisisText}>{a.text}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.actions}>
                <ActionBtn icon="share-location" label="Bagikan Lokasi" />
                <ActionBtn icon="record-voice-over" label="Lapor Kendala" />
                <ActionBtn icon="contact-emergency" label="Kontak" />
              </View>
            </ScrollView>
          </View>

          <RouteDeviationModal
            visible={showDeviation}
            onSafe={() => setShowDeviation(false)}
            onReroute={() => setShowDeviation(false)}
            onSos={() => {
              setShowDeviation(false);
              finishTrip('sos');
              autoSosTelegram();
              navigation.navigate('SOS');
            }}
          />
          <LowBatteryModal
            visible={showBattery}
            batteryPct={battPct}
            onShare={() => setShowBattery(false)}
            onContinue={() => setShowBattery(false)}
          />
        </View>
      </View>
    </View>
  );
}

function ActionBtn({ icon, label }: { icon: keyof typeof MaterialIcons.glyphMap; label: string }) {
  return (
    <Pressable style={styles.actionBtn}>
      <MaterialIcons name={icon} size={20} color={colors.primary} />
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },

  banner: { flexDirection: 'row', alignItems: 'center', gap: 20, backgroundColor: colors.primaryAlt,borderRadius: radius.md, padding: 14, marginTop: 50, marginHorizontal: 25 },
  bannerSim: { backgroundColor: '#7F1D1D' },
  turnIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  turnMain: { color: colors.surface, fontSize: 16, fontWeight: '700' },
  turnSub: { color: '#A8B2C4', fontSize: 13, marginTop: 1 },

  mapArea: { flex: 1 },
  map: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  card: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '50%',
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
  callout: { width: 220, padding: 4, gap: 4 },
  calloutTitle: { fontSize: 13, fontWeight: '700' },
  calloutDesc: { fontSize: 12, color: colors.textSecondary, lineHeight: 16 },
  calloutLink: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  calloutLinkText: { fontSize: 11, color: colors.primary, fontWeight: '600' },
  userDot: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.surface,
  },
  simBtn: {
    position: 'absolute',
    left: 16,
    top: 170,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    elevation: 4,
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 12,
  },
  simText: { color: colors.surface, fontSize: 12, fontWeight: '700' },
  dangerChip: {
    position: 'absolute',
    top: 12,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.97)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    maxWidth: '70%',
    elevation: 4,
  },
  dangerChipText: { fontSize: 12, fontWeight: '700', color: colors.textPrimary },
  sheetHandle: {
    width: 48,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#D1D5DB',
    alignSelf: 'center',
    marginBottom: 16,
  },
  floatingActions: {
    position: 'absolute',
    right: 16,
    top: '50%',
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
  sosText: { color: colors.surface, fontWeight: '800', fontSize: 16 },
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
  sheet: { maxHeight: 360 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  monitorRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: GREEN },
  monitorText: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  selesaiBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border },
  selesaiText: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 8,},

  statsRow: { flexDirection: 'row', gap: 12 },
  statCard: { flex: 1, backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: 14 },
  statLabel: { fontSize: 10, color: colors.textMuted, fontWeight: '700', letterSpacing: 0.5 },
  statBig: { fontSize: 28, fontWeight: '800', color: colors.primaryAlt, marginTop: 4 },
  statUnit: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  statSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 ,textAlign: 'left'},

  battRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surfaceAlt, borderRadius: radius.md},
  battPct: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  battState: { fontSize: 13, fontWeight: '600', marginLeft: 'auto' },

  analisis: { gap: 8 , backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: 14 },
  analisisTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  analisisRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  analisisText: { fontSize: 13, color: colors.textSecondary },

  actions: { flexDirection: 'row', gap: 10 },
  actionBtn: { flex: 1, alignItems: 'center', gap: 6, backgroundColor: colors.surfaceAlt, borderRadius: radius.md, paddingVertical: 14 },
  actionLabel: { fontSize: 11, color: colors.textSecondary, fontWeight: '600', textAlign: 'center' },
});
