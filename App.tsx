import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import AuthStack from './src/navigation/AuthStack';
import { RootStackParamList } from './src/navigation/types';
import Tabs from './src/navigation/Tabs';
import NavigasiAktifScreen from './src/screens/NavigasiAktifScreen';
import OnboardingContactScreen from './src/screens/OnboardingContactScreen';
import SosScreen from './src/screens/SosScreen';
import LaporanKomunitasScreen from './src/screens/LaporanKomunitasScreen';
import EditProfilScreen from './src/screens/EditProfilScreen';
import { colors } from './src/constants/theme';

const Stack = createNativeStackNavigator<RootStackParamList>();

function MainStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs" component={Tabs} />
      <Stack.Screen name="EditProfil" component={EditProfilScreen} />
      <Stack.Screen name="NavigasiAktif" component={NavigasiAktifScreen} />
      <Stack.Screen name="SOS" component={SosScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="LaporanKomunitas" component={LaporanKomunitasScreen} />
    </Stack.Navigator>
  );
}

function Root() {
  const { session, guestMode, loading, needsOnboarding } = useAuth();
  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  const authed = !!session || guestMode;
  let body;
  if (!authed) {
    body = <AuthStack />;
  } else if (session && needsOnboarding === null) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  } else if (session && needsOnboarding) {
    body = <OnboardingContactScreen />;
  } else {
    body = <MainStack />;
  }
  return <NavigationContainer>{body}</NavigationContainer>;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <AuthProvider>
        <Root />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
