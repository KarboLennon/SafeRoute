import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../constants/theme';

export type TabKey = 'beranda' | 'perjalanan' | 'peta' | 'notifikasi' | 'profil';

const TABS: {
  key: TabKey;
  label: string;
  icon: (active: boolean) => React.ReactNode;
  badge?: boolean;
}[] = [
  {
    key: 'beranda',
    label: 'Beranda',
    icon: (a) => <Ionicons name={a ? 'home' : 'home-outline'} size={22} color={a ? colors.primary : colors.textMuted} />,
  },
  {
    key: 'perjalanan',
    label: 'Perjalanan',
    icon: (a) => <MaterialCommunityIcons name="rocket-outline" size={22} color={a ? colors.primary : colors.textMuted} />,
  },
  {
    key: 'notifikasi',
    label: 'Notifikasi',
    icon: (a) => <Ionicons name={a ? 'notifications' : 'notifications-outline'} size={22} color={a ? colors.primary : colors.textMuted} />,
    badge: true,
  },
  {
    key: 'profil',
    label: 'Profil',
    icon: (a) => <Ionicons name={a ? 'person' : 'person-outline'} size={22} color={a ? colors.primary : colors.textMuted} />,
  },
];

type Props = {
  active: TabKey;
  onChange?: (key: TabKey) => void;
};

export default function BottomNav({ active, onChange }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.container, { paddingBottom: 10 + insets.bottom }]}>
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        return (
          <Pressable key={tab.key} style={styles.item} onPress={() => onChange?.(tab.key)}>
            <View>
              {tab.icon(isActive)}
              {tab.badge && <View style={styles.badge} />}
            </View>
            <Text style={[styles.label, isActive && styles.labelActive]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
    paddingBottom: 10,
  },
  item: { flex: 1, alignItems: 'center', gap: 4 },
  label: { fontSize: 11, color: colors.textMuted },
  labelActive: { color: colors.primary, fontWeight: '600' },
  badge: {
    position: 'absolute',
    top: -2,
    right: -4,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.danger,
    borderWidth: 1.5,
    borderColor: colors.surface,
  },
});
