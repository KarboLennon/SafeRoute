import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import HomeScreen from '../screens/HomeScreen';
import NotifikasiScreen from '../screens/NotifikasiScreen';
import PerjalananScreen from '../screens/PerjalananScreen';
import PetaScreen from '../screens/PetaScreen';
import ProfilScreen from '../screens/ProfilScreen';
import AppTabBar from './AppTabBar';

const Tab = createBottomTabNavigator();

export default function Tabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <AppTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      {/* Nama route harus sama dengan TabKey di BottomNav */}
      <Tab.Screen name="beranda" component={HomeScreen} />
      <Tab.Screen name="perjalanan" component={PerjalananScreen} />
      <Tab.Screen name="peta" component={PetaScreen} />
      <Tab.Screen name="notifikasi" component={NotifikasiScreen} />
      <Tab.Screen name="profil" component={ProfilScreen} />
    </Tab.Navigator>
  );
}
