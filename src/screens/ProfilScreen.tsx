import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import Modal from 'react-native-modal';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import AppHeader from '../components/AppHeader';
import SetupPinModal from '../components/SetupPinModal';
import { useAuth } from '../contexts/AuthContext';
import { clearSafetyPin, getProfile, getSecurityPrefs, hasSafetyPin, updateSecurityPrefs } from '../services/profile';
import { RootStackParamList } from '../navigation/types';
import { SecurityPrefs, UserProfile } from '../types';
import { colors, radius } from '../constants/theme';
import KontakDaruratModal from '../components/KontakDaruratModal';

const MENU = [
  {
    icon: 'id-card',
    label: 'Kontak Darurat',
    bg: '#DCFCE7',
    fg: '#16A34A',
    action: 'contacts',
  },
  {
    icon: 'location-outline',
    label: 'Kirim Alert Manual',
    bg: '#FCE9D9',
    fg: '#E8833A',
    action: 'alert',
  },
] as const;

function initials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

export default function ProfilScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { signOut } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [prefs, setPrefs] = useState<SecurityPrefs | null>(null);
  const [pinSet, setPinSet] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [showContacts, setShowContacts] = useState(false);

  function onLogout() {
    Alert.alert('Keluar', 'Yakin mau keluar dari akun?', [
      { text: 'Batal', style: 'cancel' },
      { text: 'Keluar', style: 'destructive', onPress: () => signOut() },
    ]);
  }

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      getProfile().then((p) => alive && setProfile(p));
      return () => {
        alive = false;
      };
    }, [])
  );

  useEffect(() => {
    let alive = true;
    getSecurityPrefs().then((p) => alive && setPrefs(p));
    hasSafetyPin().then((v) => alive && setPinSet(v));
    return () => {
      alive = false;
    };
  }, []);

  function onClearPin() {
    Alert.alert('Hapus PIN?', 'Tanpa PIN, siapapun bisa konfirmasi "Saya Aman" di peringatan keluar rute.', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: async () => {
          await clearSafetyPin();
          setPinSet(false);
        },
      },
    ]);
  }

  function toggle(key: keyof SecurityPrefs, value: boolean) {
    setPrefs((prev) => (prev ? { ...prev, [key]: value } : prev));
    updateSecurityPrefs({ [key]: value });
  }

  return (
    <View style={styles.root}>
      <AppHeader />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 22, paddingBottom: 32 }}>
        {/* Header profil */}
        <View style={styles.profileHead}>
          <Pressable
            style={styles.avatarWrap}
            onPress={() => profile && navigation.navigate('EditProfil', { profile })}
            disabled={!profile}
            hitSlop={8}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{profile ? initials(profile.name) : '...'}</Text>
            </View>
            <View style={styles.editBadge}>
              <Ionicons name="pencil" size={12} color={colors.surface} />
            </View>
          </Pressable>
          <Text style={styles.name}>{profile?.name ?? 'Memuat...'}</Text>
          <Text style={styles.university}>
            {profile ? `${profile.university} • Tingkat Akhir` : ''}
          </Text>
          {profile?.verified && (
            <View style={styles.verifiedPill}>
              <Ionicons name="shield-checkmark" size={13} color={colors.primary} />
              <Text style={styles.verifiedText}>Mahasiswa Terverifikasi</Text>
            </View>
          )}
        </View>

        {/* Support & community (menu) */}
        <Section label="BANTUAN">
          {MENU.map((m, i) => (
              <Pressable
                key={m.label}
                style={[styles.row, i < MENU.length && styles.divider]}
                onPress={() => {
                  switch (m.action) {
                    case 'contacts':
                      setShowContacts(true);
                      break;

                    case 'alert':
                      navigation.navigate('SOS');
                      break;
                  }
                }}
              >
              <View style={[styles.menuIcon, { backgroundColor: m.bg }]}>
                <Ionicons name={m.icon} size={18} color={m.fg} />
              </View>
              <Text style={[styles.rowTitle, { flex: 1 }]}>{m.label}</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>
          ))}

          <Pressable 
            style={[styles.row, styles.divider]}
            onPress={() => setShowPinModal(true)}
            onLongPress={pinSet ? onClearPin : undefined}
          >
            <View style={[styles.menuIcon, { backgroundColor: '#DBEAFE' }]}>
              <Ionicons name={pinSet ? 'lock-closed' : 'lock-open'} size={18} color="#2563EB" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>Safety PIN</Text>
              <Text style={styles.rowSub}>
                {pinSet ? 'Aktif · Tahan untuk hapus' : 'Belum diset · Tap untuk buat'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        </Section>
        

        {/* Preferensi keamanan */}
        <Section label="PREFERENSI KEAMANAN">
          <ToggleRow
            icon="notifications"
            title="SOS Otomatis"
            subtitle="Peringatan SOS ke kontak darurat"
            value={prefs?.autoSos ?? false}
            onChange={(v) => toggle('autoSos', v)}
            divider
          />
          <ToggleRow
            icon="battery-half"
            title="Peringatan Baterai"
            subtitle="Infokan Bila Baterai < 15%"
            value={prefs?.batteryAlert ?? false}
            onChange={(v) => toggle('batteryAlert', v)}
            divider
          />
        </Section>

        {/* Akun */}
        <Section label="ACCOUNT">
          <Row divider>
            <Ionicons name="help-circle-outline" size={20} color={colors.primary} />
            <Text style={[styles.rowTitle, { flex: 1 }]}>Bantuan</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Row>
          <Pressable style={styles.row} onPress={onLogout}>
            <Ionicons name="log-out-outline" size={20} color={colors.danger} />
            <Text style={[styles.rowTitle, { flex: 1, color: colors.danger }]}>Keluar</Text>
          </Pressable>
        </Section>

        <Text style={styles.version}>SafeRoute Version 0.0.1{'\n'}© 2026 MATA Team</Text>
      </ScrollView>

      <SetupPinModal
        visible={showPinModal}
        onClose={() => setShowPinModal(false)}
        onSaved={() => setPinSet(true)}
      />
      <Modal
        isVisible={showContacts}
        onBackdropPress={() => setShowContacts(false)}
        swipeDirection="down"
        onSwipeComplete={() => setShowContacts(false)}
        style={{ margin: 0, justifyContent: 'flex-end' }}
      >
        <View style={styles.bottomSheet}>
          <View style={styles.sheetHandle} />
          <KontakDaruratModal />
        </View>
      </Modal>
    </View>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={styles.sectionLabel}>{label}</Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

function Row({ children, divider }: { children: React.ReactNode; divider?: boolean }) {
  return <View style={[styles.row, divider && styles.divider]}>{children}</View>;
}

function ToggleRow({
  icon,
  title,
  subtitle,
  value,
  onChange,
  divider,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  divider?: boolean;
}) {
  return (
    <View style={[styles.row, divider && styles.divider]}>
      <Ionicons name={icon} size={20} color={colors.primary} />
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        {subtitle && <Text style={styles.rowSub}>{subtitle}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: colors.primary, false: colors.border }}
        thumbColor={colors.surface}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },

  profileHead: { alignItems: 'center', gap: 4, paddingTop: 8 },
  avatarWrap: { marginBottom: 8 },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.surface, fontSize: 30, fontWeight: '700' },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primaryAlt,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.bg,
  },
  name: { fontSize: 20, fontWeight: '700', color: colors.textPrimary },
  university: { fontSize: 13, color: colors.textMuted },
  verifiedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
  },
  verifiedText: { fontSize: 12, color: colors.primary, fontWeight: '600' },

  sectionLabel: { fontSize: 11, color: colors.textMuted, fontWeight: '700', letterSpacing: 0.5, marginLeft: 4 },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, overflow: 'hidden' },
  bottomSheet: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    overflow: 'hidden',
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#D1D5DB',
    alignSelf: 'center',
    marginVertical: 12,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 15 },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  rowTitle: { fontSize: 14, color: colors.textPrimary, fontWeight: '600' },
  rowSub: { fontSize: 12, color: colors.textMuted, marginTop: 1 },

  menuIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  version: { fontSize: 11, color: colors.textMuted, textAlign: 'center', marginTop: 4, lineHeight: 16 },
});