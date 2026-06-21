import { Ionicons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { useFocusEffect } from '@react-navigation/native';
import { addEmergencyContact, deleteEmergencyContact, getEmergencyContacts } from '../services/profile';
import { EmergencyContact } from '../types';
import { colors, radius } from '../constants/theme';

const RELATIONSHIPS = ['Ibu', 'Bapak', 'Saudara', 'Pasangan', 'Teman', 'Lainnya'];

export default function OnboardingContactScreen() {
  const insets = useSafeAreaInsets();
  const { markOnboardingDone, refreshOnboarding } = useAuth();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [relationship, setRelationship] = useState('');
  const [openRel, setOpenRel] = useState(false);
  const [adding, setAdding] = useState(false);

  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [showList, setShowList] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const cs = await getEmergencyContacts();
    setContacts(cs);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  const formValid = name.trim().length > 1 && phone.trim().length >= 8 && !!relationship;

  async function submit() {
    if (!formValid || adding) return;
    setAdding(true);
    try {
      await addEmergencyContact({
        name: name.trim(),
        phone: `+62 ${phone.trim()}`,
        relationship,
        telegramChatId: null,
      });
      setName('');
      setPhone('');
      setRelationship('');
      setOpenRel(false);
      await reload();
    } catch (e: any) {
      Alert.alert('Gagal', e?.message ?? 'Coba lagi.');
    } finally {
      setAdding(false);
    }
  }

  async function removeContact(id: string) {
    Alert.alert('Hapus kontak?', 'Kontak ini akan dihapus dari daftar darurat.', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: async () => {
          await deleteEmergencyContact(id);
          await reload();
        },
      },
    ]);
  }

  async function onLanjut() {
    if (contacts.length === 0) return;
    await refreshOnboarding();
    markOnboardingDone();
  }

  const lanjutDisabled = contacts.length === 0;

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={{ width: 24 }} />
        <Text style={styles.headerTitle}>Atur Kontak Darurat</Text>
        <View style={styles.helpBtn}>
          <Ionicons name="help-circle-outline" size={18} color={colors.textMuted} />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.alertCard}>
          <Ionicons name="shield-checkmark" size={18} color={colors.primary} />
          <Text style={styles.alertText}>
            Tambahkan setidaknya satu kontak darurat terpercaya agar kami dapat memberitahu mereka jika terjadi sesuatu.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Kontak Baru</Text>

          <Text style={styles.label}>Nama Lengkap</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Contoh: Skala Samudra"
            placeholderTextColor={colors.textMuted}
          />

          <Text style={styles.label}>Hubungan</Text>
          <Pressable style={styles.dropdown} onPress={() => setOpenRel((v) => !v)}>
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

          <Text style={styles.label}>Nomor Telepon</Text>
          <View style={styles.phoneRow}>
            <View style={styles.prefix}>
              <Text style={styles.prefixText}>+62</Text>
            </View>
            <TextInput
              style={[styles.input, { flex: 1, marginTop: 0 }]}
              value={phone}
              onChangeText={setPhone}
              placeholder="81234567890"
              placeholderTextColor={colors.textMuted}
              keyboardType="phone-pad"
            />
          </View>

          <Pressable
            style={[styles.addBtn, (!formValid || adding) && styles.addBtnDisabled]}
            onPress={submit}
            disabled={!formValid || adding}
          >
            {adding ? (
              <ActivityIndicator color={colors.surface} />
            ) : (
              <>
                <Ionicons name="person-add" size={18} color={colors.surface} />
                <Text style={styles.addBtnText}>Tambah Kontak</Text>
              </>
            )}
          </Pressable>
        </View>

        <View style={styles.listHead}>
          <Text style={styles.sectionLabel}>DAFTAR KONTAK TERDAFTAR</Text>
          {contacts.length > 0 && (
            <Text style={styles.countText}>{contacts.length} Kontak</Text>
          )}
        </View>

        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginVertical: 16 }} />
        ) : contacts.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ionicons name="document-outline" size={28} color={colors.textMuted} />
            </View>
            <Text style={styles.emptyText}>Belum ada kontak darurat yang ditambahkan.</Text>
          </View>
        ) : (
          <View style={styles.listCard}>
            <Pressable style={styles.listRow} onPress={() => setShowList((v) => !v)}>
              <Ionicons name="people-outline" size={18} color={colors.primary} />
              <Text style={styles.listRowText}>
                {contacts[0].name}
                {contacts.length > 1 ? ` +${contacts.length - 1} lainnya` : ''}
              </Text>
              <Ionicons name={showList ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
            </Pressable>
            {showList && (
              <View style={styles.listExpand}>
                {contacts.map((c) => (
                  <View key={c.id} style={styles.contactRow}>
                    <View style={styles.contactAvatar}>
                      <Text style={styles.contactAvatarText}>{(c.name[0] ?? '?').toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.contactName}>{c.name}</Text>
                      <Text style={styles.contactSub}>{c.relationship} · {c.phone}</Text>
                    </View>
                    <Pressable hitSlop={10} onPress={() => removeContact(c.id)}>
                      <Ionicons name="trash-outline" size={18} color={colors.danger} />
                    </Pressable>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <Pressable
          style={[styles.cta, lanjutDisabled && styles.ctaDisabled]}
          onPress={onLanjut}
          disabled={lanjutDisabled}
        >
          <Text style={[styles.ctaText, lanjutDisabled && styles.ctaTextDisabled]}>Lanjutkan</Text>
          <Ionicons
            name="arrow-forward"
            size={18}
            color={lanjutDisabled ? colors.textMuted : colors.surface}
          />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: colors.surface,
  },
  headerTitle: { fontSize: 16, fontWeight: '800', color: colors.primary },
  helpBtn: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center', justifyContent: 'center',
  },

  alertCard: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#EAEEF6',
    borderRadius: radius.md,
    padding: 14,
  },
  alertText: { flex: 1, fontSize: 13, color: colors.textSecondary, lineHeight: 19 },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 18,
    gap: 4,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTitle: { fontSize: 16, fontWeight: '800', color: colors.primary, marginBottom: 6 },

  label: { fontSize: 12, color: colors.textSecondary, fontWeight: '600', marginTop: 12 },
  input: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    height: 46,
    fontSize: 14,
    color: colors.textPrimary,
    marginTop: 6,
  },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    height: 46,
    marginTop: 6,
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

  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  prefix: {
    height: 46,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prefixText: { fontSize: 14, color: colors.textSecondary, fontWeight: '600' },

  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    marginTop: 18,
  },
  addBtnDisabled: { opacity: 0.5 },
  addBtnText: { color: colors.surface, fontSize: 15, fontWeight: '700' },

  listHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  sectionLabel: { fontSize: 11, color: colors.textMuted, fontWeight: '700', letterSpacing: 0.5 },
  countText: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },

  empty: {
    backgroundColor: colors.bg,
    alignItems: 'center',
    gap: 10,
    paddingVertical: 28,
  },
  emptyIcon: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center', justifyContent: 'center',
  },
  emptyText: { fontSize: 13, color: colors.textMuted, textAlign: 'center', paddingHorizontal: 24 },

  listCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  listRowText: { flex: 1, fontSize: 14, color: colors.textPrimary, fontWeight: '600' },
  listExpand: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  contactAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  contactAvatarText: { color: colors.surface, fontSize: 13, fontWeight: '700' },
  contactName: { fontSize: 14, color: colors.textPrimary, fontWeight: '600' },
  contactSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },

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
    height: 50,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  ctaDisabled: { backgroundColor: colors.surfaceAlt },
  ctaText: { color: colors.surface, fontSize: 15, fontWeight: '700' },
  ctaTextDisabled: { color: colors.textMuted },
});
