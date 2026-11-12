import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TopToolbar } from '../components/navigation/TopToolbar';
import { AuthProvider } from '../context/AuthContext';
import { CartProvider } from '../context/CartContext';
import { RecentViewProvider } from '../context/RecentViewContext';
import { theme } from '../theme/theme';

export const unstable_settings = { anchor: '(tabs)' };
export default function RootLayout() {
  return <SafeAreaProvider><AuthProvider><CartProvider><RecentViewProvider>
    <StatusBar style="dark" />
    <Stack screenOptions={{ header: () => <TopToolbar />, gestureEnabled: false, contentStyle: { backgroundColor: theme.colors.background } }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="products/index" /><Stack.Screen name="products/[id]" />
      <Stack.Screen name="cart" /><Stack.Screen name="checkout" /><Stack.Screen name="checkout/success" />
      <Stack.Screen name="auth/callback" options={{ headerShown: false }} /><Stack.Screen name="chatbot" /><Stack.Screen name="auth/login" /><Stack.Screen name="auth/register" />
    </Stack>
  </RecentViewProvider></CartProvider></AuthProvider></SafeAreaProvider>;
}
