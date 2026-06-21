import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RootStackParamList } from '../navigation/types';
import { updateProfile } from '../services/profile';
import { colors, radius } from '../constants/theme';

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase();
}

export default function EditProfilScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'EditProfil'>>();
  const insets = useSafeAreaInsets();
  const { profile } = route.params;

  const [name, setName] = useState(profile.name);
  const [university, setUniversity] = useState(profile.university);
  const [phone, setPhone] = useState(profile.phone);
  const [busy, setBusy] = useState(false);

  const changed =
    name.trim() !== profile.name ||
    university.trim() !== profile.university ||
    phone.trim() !== profile.phone;

  async function onSave() {
    if (!name.trim()) {
      Alert.alert('Nama wajib diisi', 'Nama lengkap tidak boleh kosong.');
      return;
    }
    setBusy(true);
    try {
      await updateProfile({
        name: name.trim(),
        university: university.trim(),
        phone: phone.trim(),
      });
      navigation.goBack();
    } catch (e: unknown) {
      Alert.alert('Gagal menyimpan', e instanceof Error ? e.message : 'Coba lagi.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Edit Profil</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 24 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Avatar (preview inisial, ikut berubah saat nama diedit) */}
        <View style={styles.avatarWrap}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{name.trim() ? initials(name) : '?'}</Text>
          </View>
        </View>

        <Field label="Nama Lengkap" icon="person-outline" value={name} onChange={setName} placeholder="Nama sesuai KTM" />
        <Field
          label="Universitas"
          icon="school-outline"
          value={university}
          onChange={setUniversity}
          placeholder="Nama universitas"
        />
        <Field
          label="Nomor Telepon"
          icon="call-outline"
          value={phone}
          onChange={setPhone}
          placeholder="0812xxxx"
          keyboardType="phone-pad"
        />

        {/* Email — read-only (dikelola lewat akun/auth) */}
        <Text style={styles.label}>Email</Text>
        <View style={[styles.inputWrap, styles.inputLocked]}>
          <Ionicons name="at" size={18} color={colors.textMuted} />
          <Text style={styles.lockedText} numberOfLines={1}>
            {profile.email || '—'}
          </Text>
          <Ionicons name="lock-closed" size={15} color={colors.textMuted} />
        </View>
        <Text style={styles.hint}>Email tidak bisa diubah di sini.</Text>

        <Pressable
          style={[styles.cta, (!changed || busy) && { opacity: 0.5 }]}
          onPress={onSave}
          disabled={!changed || busy}
        >
          <Text style={styles.ctaText}>{busy ? 'Menyimpan...' : 'Simpan Perubahan'}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({
  label,
  icon,
  value,
  onChange,
  placeholder,
  keyboardType,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  keyboardType?: 'phone-pad';
}) {
  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputWrap}>
        <Ionicons name={icon} size={18} color={colors.textMuted} />
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          keyboardType={keyboardType}
        />
      </View>
    </>
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
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: colors.textPrimary },

  avatarWrap: { alignItems: 'center', marginBottom: 20 },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.surface, fontSize: 30, fontWeight: '700' },

  label: { fontSize: 13, color: colors.textSecondary, fontWeight: '600', marginBottom: 6, marginTop: 14 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    height: 52,
  },
  input: { flex: 1, fontSize: 14, color: colors.textPrimary, padding: 0 },
  inputLocked: { backgroundColor: colors.surfaceAlt, borderColor: colors.surfaceAlt },
  lockedText: { flex: 1, fontSize: 14, color: colors.textMuted },
  hint: { fontSize: 12, color: colors.textMuted, marginTop: 5, marginLeft: 4 },

  cta: { backgroundColor: colors.primary, height: 54, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', marginTop: 28 },
  ctaText: { color: colors.surface, fontSize: 16, fontWeight: '700' },
});
