import { useEffect } from 'react';
import {
  BeVietnamPro_400Regular, BeVietnamPro_500Medium, BeVietnamPro_600SemiBold, BeVietnamPro_700Bold, useFonts,
} from '@expo-google-fonts/be-vietnam-pro';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TopToolbar } from '../components/navigation/TopToolbar';
import { AuthProvider } from '../context/AuthContext';
import { CartProvider } from '../context/CartContext';
import { RecentViewProvider } from '../context/RecentViewContext';
import { theme } from '../theme/theme';

void SplashScreen.preventAutoHideAsync().catch(() => {});

export const unstable_settings = { anchor: '(tabs)' };
export default function RootLayout() {
  // The native splash stays up until fonts are ready (or failed: then the system font is used).
  // Always render the navigator: returning null here makes Expo Router drop deep links such as
  // shared product URLs and the Google sign-in callback.
  const [fontsLoaded, fontError] = useFonts({ BeVietnamPro_400Regular, BeVietnamPro_500Medium, BeVietnamPro_600SemiBold, BeVietnamPro_700Bold });
  const ready = fontsLoaded || Boolean(fontError);
  useEffect(() => { if (ready) void SplashScreen.hideAsync().catch(() => {}); }, [ready]);
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
