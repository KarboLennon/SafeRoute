import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import BottomNav, { TabKey } from '../components/BottomNav';

// Menjembatani tab bar custom (gaya Figma) dengan state React Navigation.
// Nama route di navigator harus sama dengan TabKey.
export default function AppTabBar({ state, navigation }: BottomTabBarProps) {
  const active = state.routes[state.index].name as TabKey;
  return (
    <BottomNav
      active={active}
      onChange={(key) => navigation.navigate(key)}
    />
  );
}
