import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useCountdown } from '../hooks/useCountdown';
import { colors, radius } from '../constants/theme';

type Props = {
  visible: boolean;
  batteryPct: number;
  onShare: () => void; // "Bagikan Lokasi Saat Ini" / timeout otomatis
  onContinue: () => void; // "Lanjutkan Perjalanan"
};

/** Peringatan baterai lemah — otomatis kirim lokasi sebelum perangkat mati. */
export default function LowBatteryModal({ visible, batteryPct, onShare, onContinue }: Props) {
  const seconds = useCountdown(9, onShare, visible);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Ionicons name="battery-dead" size={28} color={colors.warning} />
          </View>
          <Text style={styles.title}>Baterai Lemah</Text>
          <Text style={styles.desc}>Perangkat akan segera mati. Silahkan amankan lokasi anda.</Text>

          <View style={styles.chip}>
            <Ionicons name="time-outline" size={14} color={colors.warning} />
            <Text style={styles.chipText}>Mengirim lokasi dalam {seconds} detik...</Text>
          </View>

          <Pressable style={[styles.btn, styles.btnWarning]} onPress={onShare}>
            <Ionicons name="navigate" size={18} color={colors.surface} />
            <Text style={styles.btnWarningText}>Bagikan Lokasi Saat Ini</Text>
          </Pressable>
          <Pressable style={[styles.btn, styles.btnGhost]} onPress={onContinue}>
            <Text style={styles.btnGhostText}>Lanjutkan Perjalanan</Text>
          </Pressable>

          <View style={styles.footer}>
            <Ionicons name="people" size={13} color={colors.textMuted} />
            <Text style={styles.footerText}>Kepada: Emak, Ultraman Ribut</Text>
            <Ionicons name="battery-dead-outline" size={14} color={colors.danger} />
            <Text style={styles.footerBatt}>{batteryPct}%</Text>
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
  card: { width: '100%', backgroundColor: colors.surface, borderRadius: radius.lg, padding: 24, alignItems: 'center', gap: 10 },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.warningBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 18, fontWeight: '800', color: colors.textPrimary },
  desc: { fontSize: 13, color: colors.textMuted, textAlign: 'center', lineHeight: 18 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.warningBg,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    marginVertical: 2,
  },
  chipText: { fontSize: 12, color: colors.warning, fontWeight: '600' },

  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: radius.md,
    width: '100%',
  },
  btnWarning: { backgroundColor: colors.warning },
  btnWarningText: { color: colors.surface, fontSize: 15, fontWeight: '700' },
  btnGhost: { backgroundColor: colors.surfaceAlt },
  btnGhostText: { color: colors.textSecondary, fontSize: 14, fontWeight: '600' },

  footer: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  footerText: { fontSize: 12, color: colors.textMuted },
  footerBatt: { fontSize: 12, color: colors.danger, fontWeight: '700' },
});
