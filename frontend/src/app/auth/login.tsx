import { useEffect, useRef, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/shop/Button';
import { Input } from '../../components/shop/Input';
import { hasSupabaseConfig, supabase } from '../../lib/supabase';
import { theme } from '../../theme/theme';
import { useAuth } from '../../context/AuthContext';
import { authErrorMessage, loadMyProfile, LoginCancelled, signInWithGoogle, userAuthError } from '../../services/auth-service';
import { firstParam, safeReturnTarget, targetUrl } from '../../navigation/routes';

export default function LoginScreen() {
  const params = useLocalSearchParams();
  const destination = safeReturnTarget(firstParam(params.returnTo));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { initializing, refreshProfile } = useAuth();
  const [loading, setLoading] = useState<'password' | 'google' | null>(null);
  const [notice, setNotice] = useState('');
  const busy = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const [submitted, setSubmitted] = useState(false);

  const emailError = !email.trim() ? 'Vui lòng nhập Email' : !/\S+@\S+\.\S+/.test(email) ? 'Email chưa hợp lệ' : '';
  const passwordError = !password ? 'Vui lòng nhập Mật khẩu' : password.length < 6 ? 'Mật khẩu tối thiểu 6 ký tự' : '';

  async function handleLogin() {
    setSubmitted(true);
    if (emailError || passwordError || busy.current) return;
    busy.current = true; setLoading('password'); setNotice('');
    try {
      if (!supabase) throw userAuthError('Chưa cấu hình kết nối Supabase Auth.');
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      await loadMyProfile();
      await refreshProfile();
      if (mounted.current) router.dismissTo(destination);
    } catch (error) {
      if (mounted.current) Alert.alert('Đăng nhập thất bại', authErrorMessage(error));
    } finally { busy.current = false; if (mounted.current) setLoading(null); }
  }
  async function handleGoogleLogin() {
    if (busy.current) return;
    busy.current = true; setLoading('google'); setNotice('');
    try {
      const target = await signInWithGoogle(destination);
      await refreshProfile();
      if (mounted.current) router.dismissTo(target);
    } catch (error) {
      if (mounted.current) {
        if (error instanceof LoginCancelled) setNotice('Bạn đã huỷ đăng nhập Google.');
        else Alert.alert('Đăng nhập Google thất bại', authErrorMessage(error));
      }
    } finally { busy.current = false; if (mounted.current) setLoading(null); }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Text style={styles.logo}>UNIQLO</Text>
        <Text style={styles.title}>Đăng nhập tài khoản</Text>
        <Text style={styles.subtitle}>Nhập Email và Mật khẩu để tiếp tục trải nghiệm dịch vụ.</Text>
      </View>

      <Input
        label="Địa chỉ Email"
        placeholder="example@email.com"
        keyboardType="email-address"
        autoCapitalize="none"
        value={email}
        onChangeText={setEmail}
        error={submitted ? emailError : undefined}
      />

      <Input
        label="Mật khẩu"
        placeholder="••••••••"
        secureTextEntry
        autoCapitalize="none"
        value={password}
        onChangeText={setPassword}
        error={submitted ? passwordError : undefined}
      />

      <Button title="Đăng nhập" onPress={handleLogin} loading={loading === 'password'} disabled={Boolean(loading) || initializing || !hasSupabaseConfig} style={{ marginTop: 8 }} />
      <Text style={styles.separator}>hoặc</Text>
      <Button title="Tiếp tục với Google" variant="outline" onPress={handleGoogleLogin}
        loading={loading === 'google'} disabled={Boolean(loading) || initializing || !hasSupabaseConfig} />
      {notice ? <Text accessibilityLiveRegion="polite" style={styles.status}>{notice}</Text> : null}

      {!hasSupabaseConfig && (
        <Text style={styles.demoNotice}>Chưa cấu hình Supabase Auth. Vui lòng kiểm tra kết nối của ứng dụng.</Text>
      )}

      <View style={styles.footerRow}>
        <Text style={styles.footerText}>Chưa có tài khoản?</Text>
        <Pressable disabled={Boolean(loading)} onPress={() => router.push({ pathname: '/auth/register', params: { returnTo: targetUrl(destination) } })}>
          <Text style={styles.linkText}> Đăng ký ngay</Text>
        </Pressable>
      </View>

      <Pressable disabled={Boolean(loading)} onPress={() => router.replace('/')} style={styles.skipButton}>
        <Text style={styles.skipText}>Bỏ qua & Về trang chủ →</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  separator: { textAlign: 'center', color: theme.colors.muted, marginVertical: 16 },
  status: { color: theme.colors.muted, lineHeight: 20, marginTop: 12 },
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: 22, paddingBottom: 50 },
  header: { marginTop: 24, marginBottom: 28 },
  logo: { fontSize: 22, fontWeight: '900', color: theme.colors.primary, letterSpacing: 1 },
  title: { fontSize: 24, fontWeight: '800', color: theme.colors.ink, marginTop: 12 },
  subtitle: { fontSize: 13, color: theme.colors.muted, marginTop: 6, lineHeight: 20 },
  demoNotice: { backgroundColor: '#FFF3D8', color: '#765115', padding: 12, borderRadius: 8, fontSize: 12, marginTop: 16, lineHeight: 18 },
  footerRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 24 },
  footerText: { fontSize: 14, color: theme.colors.muted },
  linkText: { fontSize: 14, fontWeight: '700', color: theme.colors.primary },
  skipButton: { marginTop: 20, alignItems: 'center' },
  skipText: { fontSize: 13, color: theme.colors.muted, fontWeight: '600' },
});
