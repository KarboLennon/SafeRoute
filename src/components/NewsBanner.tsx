import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { Animated, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DANGER_LEVELS } from '../constants/config';
import { NewsAlert } from '../hooks/useNewsRealtime';
import { DangerLevel } from '../types';
import { colors, radius } from '../constants/theme';

type Props = {
  alert: NewsAlert | null;
  onDismiss: () => void;
};

const AUTO_HIDE_MS = 7000;

export default function NewsBanner({ alert, onDismiss }: Props) {
  const insets = useSafeAreaInsets();
  const slide = useRef(new Animated.Value(-200)).current;

  useEffect(() => {
    if (!alert) return;
    Animated.spring(slide, { toValue: 0, useNativeDriver: true, friction: 8 }).start();
    const t = setTimeout(() => {
      Animated.timing(slide, { toValue: -200, duration: 260, useNativeDriver: true }).start(() => {
        onDismiss();
      });
    }, AUTO_HIDE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alert]);

  if (!alert) return null;
  const lvl = (alert.level >= 1 && alert.level <= 3 ? alert.level : 1) as DangerLevel;
  const levelMeta = DANGER_LEVELS[lvl];

  function openSource() {
    if (alert?.sourceUrl) Linking.openURL(alert.sourceUrl).catch(() => {});
    onDismiss();
  }

  return (
    <Animated.View
      style={[
        styles.wrap,
        { paddingTop: insets.top + 8, transform: [{ translateY: slide }] },
      ]}
      pointerEvents="box-none"
    >
      <Pressable style={[styles.card, { borderLeftColor: levelMeta.color }]} onPress={openSource}>
        <View style={[styles.iconWrap, { backgroundColor: `${levelMeta.color}22` }]}>
          <Ionicons name="newspaper" size={20} color={levelMeta.color} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.headRow}>
            <Text style={[styles.tag, { color: levelMeta.color }]}>
              BERITA · LEVEL {lvl} · {levelMeta.label.toUpperCase()}
            </Text>
            <Pressable hitSlop={10} onPress={onDismiss}>
              <Ionicons name="close" size={16} color={colors.textMuted} />
            </Pressable>
          </View>
          <Text style={styles.title} numberOfLines={2}>
            {alert.title}
          </Text>
          {alert.sourceUrl && (
            <View style={styles.linkRow}>
              <Ionicons name="link" size={11} color={colors.primary} />
              <Text style={styles.linkText} numberOfLines={1}>
                Ketuk untuk baca · {alert.reporterName}
              </Text>
            </View>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 12,
    zIndex: 100,
  },
  card: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 12,
    borderLeftWidth: 4,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tag: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  title: { fontSize: 13, color: colors.textPrimary, fontWeight: '700', marginTop: 4, lineHeight: 18 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  linkText: { fontSize: 11, color: colors.primary, flex: 1 },
});
