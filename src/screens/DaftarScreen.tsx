import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { signUp } from '../services/auth';
import { colors, radius } from '../constants/theme';

export default function DaftarScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit() {
    if (!name.trim() || !email.trim() || !phone.trim() || password.length < 8) {
      Alert.alert('Lengkapi data', 'Isi semua field, kata sandi min. 8 karakter.');
      return;
    }
    if (!agree) {
      Alert.alert('Persetujuan', 'Setujui Syarat & Ketentuan dulu.');
      return;
    }
    setBusy(true);
    try {
      const data = await signUp({ name: name.trim(), email: email.trim(), phone: phone.trim(), password });
      if (data.session) {
        // Verifikasi email mati → langsung login; auth gate otomatis masuk ke app.
        return;
      }
      Alert.alert(
        'Pendaftaran Berhasil',
        'Cek email kamu untuk verifikasi, lalu masuk.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (e: unknown) {
      Alert.alert('Gagal daftar', e instanceof Error ? e.message : 'Coba lagi.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </Pressable>
        <Text style={styles.headerTitle}>Daftar Akun</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Image source={require('../../assets/icon.png')} style={styles.logo} />
        <Text style={styles.title}>Gabung Safe Route</Text>
        <Text style={styles.subtitle}>Lengkapi identitas kamu untuk memulai perjalanan yang lebih aman.</Text>

        <Field label="Nama Lengkap" icon="person-outline" value={name} onChange={setName} placeholder="Masukkan nama sesuai KTM" />
        <Field label="Email" icon="at" value={email} onChange={setEmail} placeholder="nama@mahasiswa.univ.ac.id" keyboardType="email-address" />
        <Field label="Nomor Telepon" icon="call-outline" value={phone} onChange={setPhone} placeholder="0812xxxx" keyboardType="phone-pad" />

        <Text style={styles.label}>Kata Sandi</Text>
        <View style={styles.inputWrap}>
          <Ionicons name="lock-closed-outline" size={18} color={colors.textMuted} />
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="Min. 8 karakter"
            placeholderTextColor={colors.textMuted}
            secureTextEntry={!showPw}
          />
          <Pressable onPress={() => setShowPw((v) => !v)} hitSlop={8}>
            <Ionicons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.textMuted} />
          </Pressable>
        </View>

        <Pressable style={styles.terms} onPress={() => setAgree((v) => !v)}>
          <Ionicons
            name={agree ? 'checkbox' : 'square-outline'}
            size={20}
            color={agree ? colors.primary : colors.textMuted}
          />
          <Text style={styles.termsText}>
            Saya menyetujui <Text style={styles.termsLink}>Syarat & Ketentuan</Text> serta{' '}
            <Text style={styles.termsLink}>Kebijakan Privasi</Text> SafeRoute.
          </Text>
        </Pressable>

        <Pressable style={[styles.cta, busy && { opacity: 0.6 }]} onPress={onSubmit} disabled={busy}>
          <Text style={styles.ctaText}>{busy ? 'Memproses...' : 'Daftar Sekarang'}</Text>
        </Pressable>

        <Pressable style={styles.switchRow} onPress={() => navigation.goBack()}>
          <Text style={styles.switchText}>
            Sudah punya akun? <Text style={styles.switchLink}>Masuk</Text>
          </Text>
        </Pressable>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 10 }]}>
        <Ionicons name="shield-checkmark-outline" size={13} color={colors.textMuted} />
        <Text style={styles.footerText}>ENKRIPSI END-TO-END</Text>
      </View>
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
  keyboardType?: 'email-address' | 'phone-pad';
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
          autoCapitalize={keyboardType === 'email-address' ? 'none' : 'words'}
          keyboardType={keyboardType}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12, backgroundColor: colors.surface },
  headerTitle: { fontSize: 16, fontWeight: '700', color: colors.primary },

  content: { padding: 24 },
  logo: { alignSelf: 'center', width: 64, height: 64, borderRadius: 18, marginBottom: 12 },
  title: { fontSize: 22, fontWeight: '800', color: colors.primary, textAlign: 'center' },
  subtitle: { fontSize: 13, color: colors.textMuted, textAlign: 'center', marginTop: 6, marginBottom: 18, lineHeight: 19 },

  label: { fontSize: 13, color: colors.textSecondary, fontWeight: '600', marginBottom: 6, marginTop: 12 },
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

  terms: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 18 },
  termsText: { flex: 1, fontSize: 12, color: colors.textSecondary, lineHeight: 17 },
  termsLink: { color: colors.primary, fontWeight: '700' },

  cta: { backgroundColor: colors.primary, height: 54, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  ctaText: { color: colors.surface, fontSize: 16, fontWeight: '700' },

  switchRow: { alignItems: 'center', marginTop: 18 },
  switchText: { fontSize: 14, color: colors.textMuted },
  switchLink: { color: colors.primary, fontWeight: '700' },

  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingTop: 8 },
  footerText: { fontSize: 11, color: colors.textMuted, fontWeight: '600', letterSpacing: 1 },
});
