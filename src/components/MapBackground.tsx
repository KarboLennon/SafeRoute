import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors } from '../constants/theme';

/**
 * Placeholder peta sementara.
 *
 * react-native-maps di Android butuh Google Maps API key — tanpa itu MapView
 * crash. Sampai key dipasang (app.json → android.config.googleMaps.apiKey,
 * lalu rebuild), kita render placeholder ini supaya UI tetap jalan.
 *
 * Setelah key siap, ganti komponen ini dengan <MapView> dari react-native-maps.
 */
export default function MapBackground({ style }: { style?: ViewStyle }) {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.grid} />
      <View style={styles.center}>
        <Ionicons name="location" size={28} color={colors.primary} />
        <Text style={styles.text}>Peta (butuh Google Maps API key)</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#E8EAF0', overflow: 'hidden' },
  grid: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.4 },
  center: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  text: { fontSize: 12, color: colors.textMuted },
});
