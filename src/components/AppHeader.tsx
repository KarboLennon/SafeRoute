import { Ionicons } from '@expo/vector-icons';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../constants/theme';

export default function AppHeader() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      <Image 
        source={require('./../../assets/logo-header.png')}
        style={styles.logoImage}
        resizeMode="contain"
      />
      <Ionicons name="navigate-circle-outline" size={26} color={colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: colors.surface,
  },
  logoImage: {
    width: 160,
    height: 40,
  },
});