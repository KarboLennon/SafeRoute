import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AddContactModal from './AddContactModal';
import {
  addEmergencyContact,
  deleteEmergencyContact,
  getEmergencyContacts,
} from '../services/profile';
import { EmergencyContact } from '../types';
import { colors, radius } from '../constants/theme';

export default function KontakDaruratModal() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [showAdd, setShowAdd] = useState(false);

  function reload() {
    getEmergencyContacts().then(setContacts);
  }
  useEffect(reload, []);

  function call(phone: string) {
    Linking.openURL(`tel:${phone.replace(/\s/g, '')}`);
  }

  function confirmDelete(c: EmergencyContact) {
    Alert.alert('Hapus Kontak', `Hapus ${c.name} dari kontak darurat?`, [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: () => deleteEmergencyContact(c.id).then(reload),
      },
    ]);
  }

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Kontak Darurat</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <Text style={styles.sectionLabel}>
          KONTAK AKTIF ({contacts.length})
        </Text>

        {contacts.map((c, index) => (
          <View key={c.id}     
            style={[
              styles.row,
              index < contacts.length - 1 && styles.rowDivider,
            ]}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{c.name}</Text>
              <Text style={styles.detail}>
                <Text style={{ color: colors.green }}>● </Text>
                {c.relationship} • {c.phone}
              </Text>
            </View>
            <Pressable onPress={() => call(c.phone)} hitSlop={6}>
              <MaterialCommunityIcons name="phone-outline" size={18} color="black" />
            </Pressable>
            <Pressable onPress={() => confirmDelete(c)} hitSlop={6}>
              <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
            </Pressable>
          </View>
        ))}

        {contacts.length === 0 && (
          <Text style={styles.empty}>Belum ada kontak darurat. Tambahkan minimal satu.</Text>
        )}

        <Pressable style={styles.addBtn} onPress={() => setShowAdd(true)}>
          <Ionicons name="add-circle" size={20} color={colors.primary} />
          <Text style={styles.addText}>Tambah Kontak Baru</Text>
        </Pressable>

        <Text style={styles.note}>
          Kontak darurat akan diberi tahu otomatis (lokasi & status) saat kamu mengirim SOS atau
          pemantauan mendeteksi anomali.
        </Text>
      </ScrollView>

      <AddContactModal
        visible={showAdd}
        onClose={() => setShowAdd(false)}
        onAdd={(input) => {
          addEmergencyContact(input).then(() => {
            setShowAdd(false);
            reload();
          });
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: colors.textPrimary },

  sectionLabel: { fontSize: 11, color: colors.textMuted, fontWeight: '700', letterSpacing: 0.5, marginLeft: 4 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 14,
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  detail: { fontSize: 12, color: colors.textMuted, marginTop: 2 },

  empty: { fontSize: 13, color: colors.textMuted, textAlign: 'center', paddingVertical: 20 },

  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.primary,
  },
  addText: { fontSize: 15, color: colors.primary, fontWeight: '700' },

  note: { fontSize: 12, color: colors.textMuted, lineHeight: 17, marginTop: 8, paddingVertical: 5, paddingHorizontal: 4 },
});
