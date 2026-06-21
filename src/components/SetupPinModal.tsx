import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { setSafetyPin } from '../services/profile';
import { colors, radius } from '../constants/theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
};

export default function SetupPinModal({ visible, onClose, onSaved }: Props) {
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setPin('');
      setConfirm('');
      setError(null);
    }
  }, [visible]);

  async function submit() {
    if (!/^\d{4}$/.test(pin)) {
      setError('PIN harus 4 angka');
      return;
    }
    if (pin !== confirm) {
      setError('Konfirmasi PIN tidak cocok');
      return;
    }
    setSaving(true);
    try {
      await setSafetyPin(pin);
      onSaved();
      onClose();
    } catch (e: any) {
      setError(e?.message || 'Gagal simpan PIN');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => {}}>
          <View style={styles.iconWrap}>
            <Ionicons name="lock-closed" size={28} color={colors.primary} />
          </View>
          <Text style={styles.title}>PIN Keamanan</Text>
          <Text style={styles.desc}>
            4 angka yang cuma kamu yang tau. Dipakai konfirmasi &quot;Saya Aman&quot; pas
            peringatan keluar rute muncul — biar orang lain gak bisa nge-bypass.
          </Text>

          <Text style={styles.label}>Masukkan PIN</Text>
          <TextInput
            style={styles.input}
            value={pin}
            onChangeText={(t) => {
              setPin(t.replace(/\D/g, '').slice(0, 4));
              setError(null);
            }}
            placeholder="••••"
            placeholderTextColor={colors.textMuted}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={4}
            textAlign="center"
          />

          <Text style={styles.label}>Ulangi PIN</Text>
          <TextInput
            style={styles.input}
            value={confirm}
            onChangeText={(t) => {
              setConfirm(t.replace(/\D/g, '').slice(0, 4));
              setError(null);
            }}
            placeholder="••••"
            placeholderTextColor={colors.textMuted}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={4}
            textAlign="center"
          />

          {error && <Text style={styles.error}>{error}</Text>}

          <View style={styles.actions}>
            <Pressable style={[styles.btn, styles.btnGhost]} onPress={onClose} disabled={saving}>
              <Text style={styles.btnGhostText}>Batal</Text>
            </Pressable>
            <Pressable
              style={[styles.btn, styles.btnPrimary, saving && { opacity: 0.5 }]}
              onPress={submit}
              disabled={saving}
            >
              <Text style={styles.btnPrimaryText}>{saving ? 'Menyimpan...' : 'Simpan PIN'}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 22, gap: 8 },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 4,
  },
  title: { fontSize: 18, fontWeight: '800', color: colors.textPrimary, textAlign: 'center' },
  desc: { fontSize: 12, color: colors.textMuted, textAlign: 'center', lineHeight: 17, marginBottom: 6 },
  label: { fontSize: 11, color: colors.textSecondary, fontWeight: '700', marginTop: 6, letterSpacing: 0.5 },
  input: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    height: 56,
    fontSize: 24,
    color: colors.textPrimary,
    letterSpacing: 8,
    marginTop: 4,
  },
  error: { fontSize: 12, color: colors.danger, textAlign: 'center', marginTop: 4 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  btn: { flex: 1, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md },
  btnGhost: { borderWidth: 1, borderColor: colors.border },
  btnGhostText: { color: colors.textSecondary, fontSize: 14, fontWeight: '700' },
  btnPrimary: { backgroundColor: colors.primary },
  btnPrimaryText: { color: colors.surface, fontSize: 14, fontWeight: '700' },
});
