import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TopToolbar } from '../../components/navigation/TopToolbar';import { theme } from '../../theme/theme';

export const unstable_settings = { anchor: 'index' };

export default function MainTabsLayout() {
  const insets = useSafeAreaInsets();
  return <Tabs backBehavior="initialRoute" screenOptions={{
    header: () => <TopToolbar />,
    tabBarActiveTintColor: theme.colors.primary, tabBarInactiveTintColor: theme.colors.muted,
    tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
    tabBarStyle: { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border,
      height: 62 + Math.max(insets.bottom, 8), paddingTop: 6, paddingBottom: Math.max(insets.bottom, 8) },
    tabBarHideOnKeyboard: true,
  }}>
    <Tabs.Screen name="index" options={{ title: 'Trang chủ', tabBarAccessibilityLabel: 'Trang chủ',
      tabBarIcon: ({ focused }) => <Ionicons name={focused ? 'home' : 'home-outline'} size={23} color={focused ? theme.colors.primary : theme.colors.muted} /> }} />
    <Tabs.Screen name="orders" options={{ title: 'Đơn hàng', tabBarAccessibilityLabel: 'Đơn hàng',
      tabBarIcon: ({ focused }) => <Ionicons name={focused ? 'receipt' : 'receipt-outline'} size={23} color={focused ? theme.colors.primary : theme.colors.muted} /> }} />
    <Tabs.Screen name="notifications" options={{ title: 'Thông báo', tabBarAccessibilityLabel: 'Thông báo',
      tabBarIcon: ({ focused }) => <Ionicons name={focused ? 'notifications' : 'notifications-outline'} size={23} color={focused ? theme.colors.primary : theme.colors.muted} /> }} />
    <Tabs.Screen name="account" options={{ title: 'Tôi', tabBarAccessibilityLabel: 'Tôi, tài khoản',
      tabBarIcon: ({ focused }) => <Ionicons name={focused ? 'person' : 'person-outline'} size={23} color={focused ? theme.colors.primary : theme.colors.muted} /> }} />
  </Tabs>;
}
