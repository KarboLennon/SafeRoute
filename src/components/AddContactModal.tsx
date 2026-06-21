import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius } from '../constants/theme';

const RELATIONSHIPS = ['Ibu', 'Bapak', 'Saudara', 'Pasangan', 'Teman', 'Lainnya'];

type Props = {
  visible: boolean;
  onClose: () => void;
  onAdd: (input: {
    name: string;
    phone: string;
    relationship: string;
    telegramChatId: string | null;
  }) => void;
};

export default function AddContactModal({ visible, onClose, onAdd }: Props) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [relationship, setRelationship] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');
  const [openRel, setOpenRel] = useState(false);

  const valid = name.trim().length > 1 && phone.trim().length >= 8 && relationship !== '';

  function reset() {
    setName('');
    setPhone('');
    setRelationship('');
    setTelegramChatId('');
    setOpenRel(false);
  }

  function submit() {
    if (!valid) return;
    onAdd({
      name: name.trim(),
      phone: `+62 ${phone.trim()}`,
      relationship,
      telegramChatId: telegramChatId.trim() || null,
    });
    reset();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => setOpenRel(false)}>
          <Text style={styles.title}>Kontak Baru</Text>

          {/* Nama */}
          <Text style={styles.label}>Nama Lengkap</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Contoh: Budi Santoso"
            placeholderTextColor={colors.textMuted}
          />

          {/* Hubungan (dropdown) */}
          <Text style={styles.label}>Hubungan</Text>
          <Pressable style={styles.input} onPress={() => setOpenRel((v) => !v)}>
            <Text style={[styles.dropdownText, !relationship && { color: colors.textMuted }]}>
              {relationship || 'Pilih hubungan'}
            </Text>
            <Ionicons name={openRel ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
          </Pressable>
          {openRel && (
            <View style={styles.options}>
              {RELATIONSHIPS.map((r) => (
                <Pressable
                  key={r}
                  style={styles.option}
                  onPress={() => {
                    setRelationship(r);
                    setOpenRel(false);
                  }}
                >
                  <Text style={styles.optionText}>{r}</Text>
                  {relationship === r && <Ionicons name="checkmark" size={16} color={colors.primary} />}
                </Pressable>
              ))}
            </View>
          )}

          {/* Telepon */}
          <Text style={styles.label}>Nomor Telepon</Text>
          <View style={styles.phoneRow}>
            <View style={styles.prefix}>
              <Text style={styles.prefixText}>+62</Text>
            </View>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={phone}
              onChangeText={setPhone}
              placeholder="81234567890"
              placeholderTextColor={colors.textMuted}
              keyboardType="phone-pad"
            />
          </View>

          {/* Telegram Chat ID */}
          <Text style={styles.label}>Telegram Chat ID (opsional)</Text>
          <TextInput
            style={styles.input}
            value={telegramChatId}
            onChangeText={setTelegramChatId}
            placeholder="Contoh: 8523186869"
            placeholderTextColor={colors.textMuted}
            keyboardType="number-pad"
          />
          <Text style={styles.helper}>
            Isi biar kontak ini otomatis dapet alert Telegram pas kamu hilang sinyal &gt; 2 menit pas jalan malem.
          </Text>

          {/* Aksi */}
          <View style={styles.actions}>
            <Pressable
              style={[styles.btn, styles.btnCancel]}
              onPress={() => {
                reset();
                onClose();
              }}
            >
              <Text style={styles.btnCancelText}>Batal</Text>
            </Pressable>
            <Pressable style={[styles.btn, styles.btnAdd, !valid && styles.btnDisabled]} onPress={submit}>
              <Ionicons name="person-add" size={16} color={colors.surface} />
              <Text style={styles.btnAddText}>Tambah Kontak</Text>
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
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 20, gap: 6 },
  title: { fontSize: 18, fontWeight: '800', color: colors.primaryAlt, marginBottom: 6 },

  label: { fontSize: 12, color: colors.textSecondary, fontWeight: '600', marginTop: 8 },
  input: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    height: 48,
    fontSize: 14,
    color: colors.textPrimary,
    marginTop: 4,
  },
  dropdownText: { fontSize: 14, color: colors.textPrimary },

  options: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 4,
    overflow: 'hidden',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  optionText: { fontSize: 14, color: colors.textPrimary },

  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  prefix: {
    height: 48,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  prefixText: { fontSize: 14, color: colors.textSecondary, fontWeight: '600' },
  helper: { fontSize: 11, color: colors.textMuted, marginTop: 6, lineHeight: 15 },

  actions: { flexDirection: 'row', gap: 12, marginTop: 18 },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 48,
    borderRadius: radius.md,
  },
  btnCancel: {  flex: 0.8, backgroundColor: colors.danger },
  btnCancelText: { color: colors.surface, fontSize: 15, fontWeight: '700' },
  btnAdd: {   flex: 1,backgroundColor: colors.primary },
  btnAddText: { color: colors.surface, fontSize: 15, fontWeight: '700' },
  btnDisabled: { opacity: 0.5 },
});
