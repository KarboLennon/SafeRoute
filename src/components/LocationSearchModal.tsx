import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Place, resolvePlace, searchPlaces } from '../lib/routing';
import { colors, radius } from '../constants/theme';

type Props = {
  visible: boolean;
  title: string;
  onClose: () => void;
  onSelect: (place: Place) => void;
};

export default function LocationSearchModal({ visible, title, onClose, onSelect }: Props) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      setQuery('');
      setResults([]);
      setResolvingId(null);
    }
  }, [visible]);

  useEffect(() => {
    if (query.trim().length < 3) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      const r = await searchPlaces(query);
      setResults(r);
      setSearching(false);
    }, 350);
    return () => clearTimeout(t);
  }, [query]);

  async function handlePick(p: Place) {
    // Hasil ORS langsung pakai (koordinat sudah ada).
    // Hasil Google butuh Place Details panggilan kedua buat ambil geometry.
    if (!p.placeId) {
      onSelect(p);
      return;
    }
    setResolvingId(p.placeId);
    const resolved = await resolvePlace(p);
    setResolvingId(null);
    if (resolved) onSelect(resolved);
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={8}>
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </Pressable>
          <Text style={styles.title}>{title}</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.searchWrap}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            style={styles.input}
            value={query}
            onChangeText={setQuery}
            placeholder="Cari alamat atau tempat..."
            placeholderTextColor={colors.textMuted}
            autoFocus
            returnKeyType="search"
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </Pressable>
          )}
        </View>

        <View style={{ flex: 1 }}>
          {results.map((p, i) => {
            const busy = resolvingId && p.placeId === resolvingId;
            return (
              <Pressable
                key={`${p.label}-${i}`}
                style={styles.item}
                onPress={() => handlePick(p)}
                disabled={!!resolvingId}
              >
                <Ionicons name="location-outline" size={18} color={colors.textMuted} />
                <Text style={styles.itemText} numberOfLines={2}>
                  {p.label}
                </Text>
                {busy && <ActivityIndicator size="small" color={colors.primary} />}
              </Pressable>
            );
          })}
          {query.trim().length >= 3 && results.length === 0 && (
            <Text style={styles.empty}>
              {searching ? `Mencari "${query}"...` : `Tidak ditemukan "${query}"`}
            </Text>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  title: { fontSize: 17, fontWeight: '700', color: colors.textPrimary },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surfaceAlt,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 14,
    height: 46,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  input: { flex: 1, fontSize: 14, color: colors.textPrimary, padding: 0 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  itemText: { flex: 1, fontSize: 14, color: colors.textPrimary },
  empty: { fontSize: 13, color: colors.textMuted, textAlign: 'center', paddingVertical: 20 },
});
