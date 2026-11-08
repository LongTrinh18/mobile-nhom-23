import { useEffect, useState } from 'react';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/shop/Button';
import { authErrorMessage, completeGoogleLogin, googleCallbackUrl } from '../../services/auth-service';
import { theme } from '../../theme/theme';
import { useLogicalBack } from '../../navigation/useLogicalBack';

// On web the opener performs the exchange; this popup only returns its URL.
const browserCompletion = WebBrowser.maybeCompleteAuthSession();
export default function AuthCallbackScreen() {
  const params = useLocalSearchParams();
  const [error, setError] = useState<string | null>(null);
  const query = new URLSearchParams();
  for (const key of ['code', 'sb_flow_id', 'error']) {
    const value = params[key];
    if (typeof value === 'string') query.set(key, value);
  }
  const callback = googleCallbackUrl() + '?' + query.toString();
  useLogicalBack(!error);
  useEffect(() => {
    if (Platform.OS === 'web' && browserCompletion.type === 'success') return;
    let active = true;
    void completeGoogleLogin(callback).then(destination => {
      if (active) router.dismissTo(destination);
    }).catch(e => { if (active) setError(authErrorMessage(e)); });
    return () => { active = false; };
  }, [callback]);
  return <View style={styles.page}>
    <Stack.Screen options={{ headerShown: false }} />
    {error ? <><Text accessibilityRole="alert" style={styles.note}>{error}</Text>
      <Button title="Về đăng nhập" onPress={() => router.replace('/auth/login')} /></>
      : <><ActivityIndicator color={theme.colors.primary} /><Text style={styles.note}>Đang hoàn tất đăng nhập…</Text></>}
  </View>;
}
const styles = StyleSheet.create({ page: { flex: 1, padding: 28, justifyContent: 'center', gap: 18, backgroundColor: theme.colors.background }, note: { color: theme.colors.ink, textAlign: 'center', lineHeight: 24 } });
