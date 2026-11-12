import { useEffect, useRef, useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../../components/ui/Text';
import { Button } from '../../components/shop/Button';
import { Input } from '../../components/shop/Input';
import { Notice } from '../../components/ui/primitives';
import { hasSupabaseConfig, supabase } from '../../lib/supabase';
import { theme } from '../../theme/theme';
import { useAuth } from '../../context/AuthContext';
import { authErrorMessage, loadMyProfile, LoginCancelled, signInWithGoogle, userAuthError } from '../../services/auth-service';
import { firstParam, safeReturnTarget, targetUrl } from '../../navigation/routes';

export default function LoginScreen() {
  const params = useLocalSearchParams();
  const destination = safeReturnTarget(firstParam(params.returnTo));
  const [email, setEmail] = useState(firstParam(params.email));
  const [password, setPassword] = useState('');
  const { initializing, refreshProfile } = useAuth();
  const [loading, setLoading] = useState<'password' | 'google' | null>(null);
  const [notice, setNotice] = useState(firstParam(params.registered) === '1' ? 'Đăng ký thành công. Hãy xác nhận email (nếu được yêu cầu) rồi đăng nhập.' : '');
  const [failure, setFailure] = useState('');
  const busy = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const [submitted, setSubmitted] = useState(false);

  const emailError = !email.trim() ? 'Vui lòng nhập email' : !/^\S+@\S+\.\S+$/.test(email.trim()) ? 'Email chưa hợp lệ' : '';
  const passwordError = !password ? 'Vui lòng nhập mật khẩu' : password.length < 6 ? 'Mật khẩu tối thiểu 6 ký tự' : '';

  async function handleLogin() {
    setSubmitted(true);
    if (emailError || passwordError || busy.current) return;
    busy.current = true; setLoading('password'); setNotice(''); setFailure('');
    try {
      if (!supabase) throw userAuthError('Chưa cấu hình kết nối Supabase Auth.');
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      await loadMyProfile();
      await refreshProfile();
      if (mounted.current) router.dismissTo(destination);
    } catch (error) {
      if (mounted.current) setFailure(authErrorMessage(error));
    } finally { busy.current = false; if (mounted.current) setLoading(null); }
  }
  async function handleGoogleLogin() {
    if (busy.current) return;
    busy.current = true; setLoading('google'); setNotice(''); setFailure('');
    try {
      const target = await signInWithGoogle(destination);
      await refreshProfile();
      if (mounted.current) router.dismissTo(target);
    } catch (error) {
      if (mounted.current) {
        if (error instanceof LoginCancelled) setNotice('Bạn đã huỷ đăng nhập Google.');
        else setFailure(authErrorMessage(error));
      }
    } finally { busy.current = false; if (mounted.current) setLoading(null); }
  }
  const disabled = Boolean(loading) || initializing || !hasSupabaseConfig;

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={styles.logo}><Text style={styles.logoText}>UNI{'\n'}QLO</Text></View>
          <Text accessibilityRole="header" style={styles.title}>Chào mừng trở lại</Text>
          <Text style={styles.subtitle}>Đăng nhập để đặt hàng, theo dõi đơn và lưu giỏ hàng.</Text>
        </View>

        {!!notice && <Notice tone="info">{notice}</Notice>}
        {!!failure && <Notice tone="danger" title="Đăng nhập thất bại">{failure}</Notice>}

        <View style={styles.form}>
          <Input label="Email" placeholder="example@email.com" keyboardType="email-address" autoCapitalize="none" icon="mail-outline"
            autoComplete="email" textContentType="emailAddress" returnKeyType="next"
            value={email} onChangeText={setEmail} error={submitted ? emailError : undefined} />
          <Input label="Mật khẩu" placeholder="Tối thiểu 6 ký tự" secureTextEntry autoCapitalize="none" icon="lock-closed-outline"
            autoComplete="current-password" textContentType="password" returnKeyType="go" onSubmitEditing={() => { void handleLogin(); }}
            value={password} onChangeText={setPassword} error={submitted ? passwordError : undefined} />
          <Button title="Đăng nhập" onPress={() => { void handleLogin(); }} loading={loading === 'password'} disabled={disabled} />
        </View>

        <View style={styles.separatorRow}><View style={styles.line} /><Text style={styles.separator}>hoặc</Text><View style={styles.line} /></View>
        <Button title="Tiếp tục với Google" icon="logo-google" variant="outline" onPress={() => { void handleGoogleLogin(); }}
          loading={loading === 'google'} disabled={disabled} />

        {!hasSupabaseConfig && <Notice tone="warning">Chưa cấu hình Supabase Auth. Vui lòng kiểm tra file .env của ứng dụng.</Notice>}

        <View style={styles.footerRow}>
          <Text style={styles.footerText}>Chưa có tài khoản?</Text>
          <Pressable accessibilityRole="link" disabled={Boolean(loading)} hitSlop={8}
            onPress={() => router.push({ pathname: '/auth/register', params: { returnTo: targetUrl(destination) } })}>
            <Text style={styles.linkText}>Đăng ký ngay</Text>
          </Pressable>
        </View>
        <Pressable accessibilityRole="button" disabled={Boolean(loading)} onPress={() => router.dismissTo('/')} style={styles.skipButton}>
          <Text style={styles.skipText}>Để sau, xem sản phẩm trước</Text>
          <Ionicons name="arrow-forward" size={15} color={theme.colors.muted} />
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: 20, paddingBottom: 48, gap: 16 },
  header: { marginTop: 16, gap: 8 },
  logo: { width: 56, height: 56, backgroundColor: theme.colors.primary, borderRadius: 4, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  logoText: { color: '#fff', fontSize: 14, lineHeight: 16, fontWeight: '900', textAlign: 'center', letterSpacing: 0.5 },
  title: { fontSize: 26, fontWeight: '900', color: theme.colors.ink },
  subtitle: { fontSize: 14, color: theme.colors.muted, lineHeight: 20 },
  form: { gap: 14, backgroundColor: theme.colors.surface, padding: 16, borderRadius: theme.radius.lg, ...theme.shadow.card },
  separatorRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  line: { flex: 1, height: 1, backgroundColor: theme.colors.border },
  separator: { color: theme.colors.muted, fontSize: 13 },
  footerRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 4 },
  footerText: { fontSize: 14, color: theme.colors.muted },
  linkText: { fontSize: 14, fontWeight: '800', color: theme.colors.primary },
  skipButton: { flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', minHeight: theme.touch },
  skipText: { fontSize: 13, color: theme.colors.muted, fontWeight: '600' },
});
