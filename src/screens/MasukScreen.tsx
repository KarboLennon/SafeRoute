import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { AuthStackParamList } from '../navigation/AuthStack';
import { signIn } from '../services/auth';
import { colors, radius } from '../constants/theme';

export default function MasukScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const insets = useSafeAreaInsets();
  const { configured, enterAsGuest } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit() {
    if (!email.trim() || !password) {
      Alert.alert('Lengkapi data', 'Isi email dan kata sandi.');
      return;
    }
    setBusy(true);
    try {
      await signIn(email.trim(), password);
      // Sesi terupdate via onAuthStateChange → gate otomatis pindah ke app.
    } catch (e: unknown) {
      Alert.alert('Gagal masuk', e instanceof Error ? e.message : 'Coba lagi.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.headerTitle}>Masuk Akun</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Image source={require('../../assets/icon.png')} style={styles.logo} />
        <Text style={styles.title}>Masuk Safe Route</Text>
        <Text style={styles.subtitle}>Masuk untuk kembali mencari perjalanan yang lebih aman.</Text>

        <Text style={styles.label}>Email</Text>
        <View style={styles.inputWrap}>
          <Ionicons name="at" size={18} color={colors.textMuted} />
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="nama@mahasiswa.univ.ac.id"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />
        </View>

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

        <Pressable style={styles.forgot}>
          <Text style={styles.forgotText}>Lupa Password?</Text>
        </Pressable>

        <Pressable style={[styles.cta, busy && { opacity: 0.6 }]} onPress={onSubmit} disabled={busy}>
          <Text style={styles.ctaText}>{busy ? 'Memproses...' : 'Masuk'}</Text>
        </Pressable>

        <Pressable style={styles.switchRow} onPress={() => navigation.navigate('Daftar')}>
          <Text style={styles.switchText}>
            Belum punya akun? <Text style={styles.switchLink}>Daftar</Text>
          </Text>
        </Pressable>

        {!configured && (
          <Pressable style={styles.guestBtn} onPress={enterAsGuest}>
            <Text style={styles.guestText}>Lanjut sebagai tamu (mode demo)</Text>
          </Pressable>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 10 }]}>
        <Ionicons name="shield-checkmark-outline" size={13} color={colors.textMuted} />
        <Text style={styles.footerText}>ENKRIPSI END-TO-END</Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: 16, paddingBottom: 12, alignItems: 'center', backgroundColor: colors.surface },
  headerTitle: { fontSize: 16, fontWeight: '700', color: colors.primary },

  content: { padding: 24, alignItems: 'stretch' },
  logo: {
    alignSelf: 'center',
    width: 72,
    height: 72,
    borderRadius: 20,
    marginTop: 16,
    marginBottom: 14,
  },
  title: { fontSize: 24, fontWeight: '800', color: colors.primary, textAlign: 'center' },
  subtitle: { fontSize: 13, color: colors.textMuted, textAlign: 'center', marginTop: 6, marginBottom: 24, lineHeight: 19 },

  label: { fontSize: 13, color: colors.textSecondary, fontWeight: '600', marginBottom: 6, marginTop: 10 },
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

  forgot: { alignSelf: 'flex-end', marginTop: 10 },
  forgotText: { fontSize: 12, color: colors.primary, fontWeight: '600' },

  cta: { backgroundColor: colors.primary, height: 54, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  ctaText: { color: colors.surface, fontSize: 16, fontWeight: '700' },

  switchRow: { alignItems: 'center', marginTop: 18 },
  switchText: { fontSize: 14, color: colors.textMuted },
  switchLink: { color: colors.primary, fontWeight: '700' },

  guestBtn: { alignItems: 'center', marginTop: 18, paddingVertical: 10 },
  guestText: { fontSize: 13, color: colors.textSecondary, fontWeight: '600', textDecorationLine: 'underline' },

  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingTop: 8 },
  footerText: { fontSize: 11, color: colors.textMuted, fontWeight: '600', letterSpacing: 1 },
});
