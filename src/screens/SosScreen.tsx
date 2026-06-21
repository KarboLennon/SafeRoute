import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import * as Battery from 'expo-battery';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { reverseGeocode } from '../lib/routing';
import { getEmergencyContacts } from '../services/profile';
import { sendManualSos } from '../services/sos';
import { EmergencyContact } from '../types';
import { colors, radius } from '../constants/theme';

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('62')) return digits;
  if (digits.startsWith('0')) return '62' + digits.slice(1);
  if (digits.startsWith('8')) return '62' + digits;
  return digits;
}

type Loc = { latitude: number; longitude: number; label: string };

export default function SosScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [contacts, setContacts] = useState<EmergencyContact[] | null>(null);
  const [location, setLocation] = useState<Loc | null>(null);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());
  const [tgState, setTgState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [tgResult, setTgResult] = useState<{ sent: number; total: number } | null>(null);

  const telegramTargets = (contacts ?? []).filter((c) => !!c.telegramChatId).length;

  useEffect(() => {
    let alive = true;
    getEmergencyContacts().then((c) => {
      if (alive) setContacts(c.filter((x) => x.active));
    });
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (!alive) return;
        const label = await reverseGeocode({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
        if (alive) {
          setLocation({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            label,
          });
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function blastTelegram() {
    if (tgState === 'sending') return;
    setTgState('sending');
    setTgResult(null);
    let batteryPct: number | undefined;
    try {
      const lvl = await Battery.getBatteryLevelAsync();
      if (lvl >= 0) batteryPct = Math.round(lvl * 100);
    } catch {
      // ignore
    }
    const result = await sendManualSos({
      locationLabel: location?.label,
      lat: location?.latitude,
      lon: location?.longitude,
      batteryPct,
    });
    if (!result) {
      setTgState('error');
      return;
    }
    setTgResult({ sent: result.sent, total: result.total });
    setTgState('done');
  }

  function sendWA(c: EmergencyContact) {
    const phone = normalizePhone(c.phone);
    if (!phone) return;
    const mapsUrl = location
      ? `https://maps.google.com/?q=${location.latitude},${location.longitude}`
      : '';
    const text = location
      ? `[SOS] Aku butuh bantuan! Aku sekarang di ${location.label}. Pantau lokasiku di sini: ${mapsUrl}`
      : `[SOS] Aku butuh bantuan! Lokasi belum bisa diambil — tolong hubungi aku secepatnya.`;
    Linking.openURL(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`).catch(() => {});
    setSentIds((prev) => new Set(prev).add(c.id));
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top + 16 }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Badge */}
        <View style={styles.badge}>
          <Ionicons name="alert-circle" size={14} color={colors.surface} />
          <Text style={styles.badgeText}>MODE DARURAT AKTIF</Text>
        </View>

        <Text style={styles.title}>Kirim SOS via WhatsApp</Text>
        <Text style={styles.desc}>
          Tap kontak yang mau dihubungi. WhatsApp terbuka dengan pesan + lokasi pre-filled — tinggal tekan
          tombol kirim di WA.
        </Text>

        {/* Lokasi */}
        <View style={styles.locCard}>
          <View style={styles.locPin}>
            <Ionicons name="location" size={18} color={colors.surface} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.locLabel}>LOKASI SAAT INI</Text>
            <Text style={styles.locText}>{location?.label ?? 'Mendeteksi lokasi...'}</Text>
          </View>
          {!location && <ActivityIndicator size="small" color={colors.primary} />}
        </View>

        {/* Blast Telegram — instant ke semua kontak yang punya chat_id */}
        {telegramTargets > 0 && (
          <Pressable
            style={[
              styles.tgBtn,
              tgState === 'sending' && styles.tgBtnSending,
              tgState === 'done' && styles.tgBtnDone,
              tgState === 'error' && styles.tgBtnError,
            ]}
            onPress={blastTelegram}
            disabled={tgState === 'sending'}
            accessibilityLabel="Blast SOS lewat Telegram ke semua kontak"
          >
            {tgState === 'sending' ? (
              <ActivityIndicator color={colors.surface} />
            ) : (
              <Ionicons
                name={tgState === 'done' ? 'checkmark-done' : tgState === 'error' ? 'alert' : 'send'}
                size={18}
                color={colors.surface}
              />
            )}
            <Text style={styles.tgBtnText}>
              {tgState === 'sending'
                ? 'Mengirim...'
                : tgState === 'done' && tgResult
                  ? `Terkirim ke ${tgResult.sent}/${tgResult.total} Telegram`
                  : tgState === 'error'
                    ? 'Gagal kirim — coba lagi'
                    : `Blast SOS ke ${telegramTargets} Telegram`}
            </Text>
          </Pressable>
        )}

        {/* Kontak darurat */}
        <Text style={styles.sectionLabel}>
          KONTAK DARURAT {contacts ? `(${contacts.length})` : ''}
        </Text>

        {contacts === null ? (
          <ActivityIndicator color={colors.primary} style={{ marginVertical: 12 }} />
        ) : contacts.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              Belum ada kontak darurat aktif. Tambahkan dulu di menu Kontak Darurat.
            </Text>
            <Pressable
              style={styles.emptyBtn}
              onPress={() => {
                navigation.goBack();
                // @ts-ignore — root stack, parent navigator handles
                navigation.navigate?.('KontakDarurat');
              }}
            >
              <Text style={styles.emptyBtnText}>Buka Kontak Darurat</Text>
            </Pressable>
          </View>
        ) : (
          contacts.map((c) => {
            const hasSent = sentIds.has(c.id);
            return (
              <View key={c.id} style={styles.contactRow}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{(c.name[0] ?? '?').toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.contactName}>{c.name}</Text>
                  <Text style={styles.contactSub}>
                    {c.relationship} · {c.phone}
                  </Text>
                </View>
                <Pressable
                  style={[styles.waBtn, hasSent && styles.waBtnSent]}
                  onPress={() => sendWA(c)}
                  accessibilityLabel={`Kirim SOS ke ${c.name} via WhatsApp`}
                >
                  <Ionicons name="logo-whatsapp" size={16} color={colors.surface} />
                  <Text style={styles.waBtnText}>{hasSent ? 'Kirim Lagi' : 'Kirim WA'}</Text>
                </Pressable>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Tutup */}
      <View style={[styles.actions, { paddingBottom: insets.bottom + 12 }]}>
        <Pressable style={[styles.btn, styles.btnGhost]} onPress={() => navigation.goBack()}>
          <Text style={styles.btnGhostText}>Tutup</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  contentArea: {flex: 1},
  content: { paddingHorizontal: 24, alignItems: 'center', gap: 14, paddingBottom: 260, },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.danger,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  badgeText: { color: colors.surface, fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },

  title: { fontSize: 22, fontWeight: '800', color: colors.textPrimary, textAlign: 'center' },
  desc: { fontSize: 13, color: colors.textMuted, textAlign: 'center', lineHeight: 19 },

  locCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: 14,
    width: '100%',
  },
  locPin: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locLabel: { fontSize: 10, color: colors.textMuted, fontWeight: '700', letterSpacing: 0.5 },
  locText: { fontSize: 13, color: colors.textPrimary, fontWeight: '600', marginTop: 2 },

  sectionLabel: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '700',
    letterSpacing: 0.5,
    alignSelf: 'flex-start',
    marginTop: 4,
  },

  empty: {
    width: '100%',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: 16,
    gap: 12,
    alignItems: 'center',
  },
  emptyText: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', lineHeight: 18 },
  emptyBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: radius.pill,
  },
  emptyBtnText: { color: colors.surface, fontSize: 13, fontWeight: '700' },

  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    paddingVertical: 8,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.surface, fontSize: 14, fontWeight: '700' },
  contactName: { fontSize: 14, color: colors.textPrimary, fontWeight: '700' },
  contactSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },

  waBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#25D366',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.pill,
  },
  waBtnSent: { backgroundColor: colors.textMuted },
  waBtnText: { color: colors.surface, fontSize: 13, fontWeight: '700' },

  tgBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    height: 52,
    backgroundColor: colors.danger,
    borderRadius: radius.md,
  },
  tgBtnSending: { opacity: 0.7 },
  tgBtnDone: { backgroundColor: '#16A34A' },
  tgBtnError: { backgroundColor: '#B91C1C' },
  tgBtnText: { color: colors.surface, fontSize: 14, fontWeight: '800' },

  actions: { paddingHorizontal: 24, paddingTop: 8, gap: 10 },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    borderRadius: radius.md,
  },
  btnGhost: { borderWidth: 1, borderColor: colors.border },
  btnGhostText: { color: colors.textSecondary, fontSize: 15, fontWeight: '600' },
});
