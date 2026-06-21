import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useCountdown } from '../hooks/useCountdown';
import { hasSafetyPin, verifySafetyPin } from '../services/profile';
import { colors, radius } from '../constants/theme';

type Props = {
  visible: boolean;
  onSafe: () => void;
  onReroute: () => void;
  onSos: () => void;
};

export default function RouteDeviationModal({ visible, onSafe, onReroute, onSos }: Props) {
  const seconds = useCountdown(28, onSos, visible);
  const [pinRequired, setPinRequired] = useState(false);
  const [askingPin, setAskingPin] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setAskingPin(false);
      setPinInput('');
      setPinError(null);
      hasSafetyPin().then(setPinRequired);
    }
  }, [visible]);

  async function handleSafePress() {
    if (!pinRequired) {
      onSafe();
      return;
    }
    setAskingPin(true);
  }

  async function submitPin(value: string) {
    if (value.length !== 4) return;
    const ok = await verifySafetyPin(value);
    if (ok) {
      onSafe();
    } else {
      setPinError('PIN salah — SOS dikirim');
      setTimeout(onSos, 600);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {/* Header oranye */}
          <View style={styles.header}>
            <Ionicons name="warning" size={14} color={colors.surface} style={styles.headerWarn} />
            <View style={styles.headerIcon}>
              <Ionicons name="walk" size={26} color={colors.surface} />
            </View>
            <Text style={styles.headerTitle}>Peringatan Keluar Rute</Text>
            <Text style={styles.headerSub}>
              Kamu teridentifikasi keluar dari rute jalan yang seharusnya, apakah kamu baik-baik saja?
            </Text>
          </View>

          {/* Body */}
          <View style={styles.body}>
            <View style={styles.ring}>
              <Text style={styles.count}>{seconds}</Text>
              <Text style={styles.countLabel}>DETIK</Text>
            </View>

            {askingPin ? (
              <>
                <Text style={styles.note}>
                  Masukkan PIN keamanan kamu. Salah PIN = SOS otomatis terkirim.
                </Text>
                <TextInput
                  style={styles.pinInput}
                  value={pinInput}
                  onChangeText={(t) => {
                    const v = t.replace(/\D/g, '').slice(0, 4);
                    setPinInput(v);
                    setPinError(null);
                    if (v.length === 4) submitPin(v);
                  }}
                  placeholder="••••"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="number-pad"
                  secureTextEntry
                  maxLength={4}
                  textAlign="center"
                  autoFocus
                />
                {pinError && <Text style={styles.pinError}>{pinError}</Text>}
                <Pressable style={[styles.btn, styles.btnGhost]} onPress={() => setAskingPin(false)}>
                  <Text style={styles.btnGhostText}>Batal</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={styles.note}>
                  Pesan SOS akan otomatis terkirim kepada kontak darurat bila tidak ada jawaban.
                </Text>

                <Pressable style={[styles.btn, styles.btnPrimary]} onPress={handleSafePress}>
                  <Ionicons
                    name={pinRequired ? 'lock-closed' : 'checkmark-circle'}
                    size={18}
                    color={colors.surface}
                  />
                  <Text style={styles.btnPrimaryText}>
                    {pinRequired ? 'Saya Aman (PIN)' : 'Saya Aman'}
                  </Text>
                </Pressable>
                <Pressable style={[styles.btn, styles.btnGhost]} onPress={onReroute}>
                  <Ionicons name="refresh" size={16} color={colors.textSecondary} />
                  <Text style={styles.btnGhostText}>Ulang Rute Saya</Text>
                </Pressable>
                <Pressable style={[styles.btn, styles.btnDanger]} onPress={onSos}>
                  <Ionicons name="alert" size={18} color={colors.surface} />
                  <Text style={styles.btnDangerText}>Kirim SOS</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  card: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  header: { backgroundColor: colors.warning, padding: 20, alignItems: 'center' },
  headerWarn: { position: 'absolute', top: 12, right: 14, opacity: 0.8 },
  headerIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  headerTitle: { color: colors.surface, fontSize: 16, fontWeight: '800' },
  headerSub: { color: colors.surface, fontSize: 12, textAlign: 'center', marginTop: 6, lineHeight: 17, opacity: 0.95 },

  body: { padding: 20, alignItems: 'center', gap: 12 },
  ring: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 5,
    borderColor: colors.warning,
    alignItems: 'center',
    justifyContent: 'center',
  },
  count: { fontSize: 28, fontWeight: '800', color: colors.textPrimary },
  countLabel: { fontSize: 9, fontWeight: '700', color: colors.textMuted, letterSpacing: 1 },
  note: { fontSize: 12, color: colors.textMuted, textAlign: 'center', lineHeight: 17 },

  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: radius.md,
    width: '100%',
  },
  btnPrimary: { backgroundColor: colors.primary },
  btnPrimaryText: { color: colors.surface, fontSize: 15, fontWeight: '700' },
  btnGhost: { borderWidth: 1, borderColor: colors.border },
  btnGhostText: { color: colors.textSecondary, fontSize: 14, fontWeight: '600' },
  btnDanger: { backgroundColor: colors.danger },
  btnDangerText: { color: colors.surface, fontSize: 15, fontWeight: '700' },

  pinInput: {
    width: '100%',
    height: 64,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    fontSize: 32,
    letterSpacing: 12,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  pinError: { fontSize: 13, color: colors.danger, fontWeight: '600', textAlign: 'center' },
});
