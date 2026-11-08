import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TopToolbar } from '../../components/navigation/TopToolbar';
import { theme } from '../../theme/theme';

export default function MainTabsLayout() {
  const insets = useSafeAreaInsets();
  return <Tabs initialRouteName="index" backBehavior="initialRoute" screenOptions={{
    header: () => <TopToolbar />,
    tabBarActiveTintColor: theme.colors.primary, tabBarInactiveTintColor: theme.colors.muted,
    tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
    tabBarStyle: { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border,
      height: 60 + Math.max(insets.bottom, 8), paddingTop: 6, paddingBottom: Math.max(insets.bottom, 8) },
    tabBarHideOnKeyboard: true,
  }}>
    <Tabs.Screen name="index" options={{ title: 'Trang chủ', tabBarAccessibilityLabel: 'Trang chủ',
      tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'home' : 'home-outline'} size={23} color={color} /> }} />
    <Tabs.Screen name="orders" options={{ title: 'Đơn hàng', tabBarAccessibilityLabel: 'Đơn hàng',
      tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'receipt' : 'receipt-outline'} size={23} color={color} /> }} />
    <Tabs.Screen name="notifications" options={{ title: 'Thông báo', tabBarAccessibilityLabel: 'Thông báo',
      tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'notifications' : 'notifications-outline'} size={23} color={color} /> }} />
    <Tabs.Screen name="account" options={{ title: 'Tôi', tabBarAccessibilityLabel: 'Tôi, tài khoản',
      tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'person' : 'person-outline'} size={23} color={color} /> }} />
  </Tabs>;
}
