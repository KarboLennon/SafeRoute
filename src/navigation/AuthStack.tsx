import { createNativeStackNavigator } from '@react-navigation/native-stack';
import DaftarScreen from '../screens/DaftarScreen';
import MasukScreen from '../screens/MasukScreen';

export type AuthStackParamList = {
  Masuk: undefined;
  Daftar: undefined;
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

export default function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Masuk" component={MasukScreen} />
      <Stack.Screen name="Daftar" component={DaftarScreen} />
    </Stack.Navigator>
  );
}
