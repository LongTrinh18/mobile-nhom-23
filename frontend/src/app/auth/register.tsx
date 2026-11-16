import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../../components/ui/Text';
import { Button } from '../../components/shop/Button';
import { Input } from '../../components/shop/Input';
import { Notice } from '../../components/ui/primitives';
import { useAuth } from '../../context/AuthContext';
import { hasSupabaseConfig, supabase } from '../../lib/supabase';
import { theme } from '../../theme/theme';
import { authErrorMessage, userAuthError } from '../../services/auth-service';
import { firstParam, safeReturnTarget, targetUrl } from '../../navigation/routes';

export default function RegisterScreen() {
  const params = useLocalSearchParams();
  const destination = safeReturnTarget(firstParam(params.returnTo));
  const returnTo = targetUrl(destination);
  const { refreshProfile } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [failure, setFailure] = useState('');

  const nameError = fullName.trim().length < 2 ? 'Vui lòng nhập họ và tên' : '';
  const emailError = !email.trim() ? 'Vui lòng nhập email' : !/^\S+@\S+\.\S+$/.test(email.trim()) ? 'Email chưa hợp lệ' : '';
  const passwordError = !password ? 'Vui lòng nhập mật khẩu' : password.length < 6 ? 'Mật khẩu tối thiểu 6 ký tự' : '';
  const confirmError = !confirmPassword ? 'Vui lòng nhập lại mật khẩu' : confirmPassword !== password ? 'Mật khẩu xác nhận không khớp' : '';

  async function handleRegister() {
    setSubmitted(true);
    if (nameError || emailError || passwordError || confirmError || loading) return;
    setLoading(true); setFailure('');
    try {
      if (!supabase) throw userAuthError('Chưa cấu hình kết nối Supabase Auth.');
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(), password, options: { data: { full_name: fullName.trim() } },
      });
      if (error) throw error;
      if (data.session) {
        // Email confirmation is off: the account is already signed in.
        await refreshProfile();
        router.dismissTo(destination);
      } else {
        router.dismissTo({ pathname: '/auth/login', params: { returnTo, email: email.trim(), registered: '1' } });
      }
    } catch (err: unknown) {
      setFailure(authErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text accessibilityRole="header" style={styles.title}>Tạo tài khoản</Text>
          <Text style={styles.subtitle}>Chỉ mất 30 giây để lưu giỏ hàng và theo dõi đơn.</Text>
        </View>
        {!!failure && <Notice tone="danger" title="Đăng ký thất bại">{failure}</Notice>}
        <View style={styles.form}>
          <Input label="Họ và tên" placeholder="Nguyễn Văn A" icon="person-outline" autoComplete="name" textContentType="name" autoCapitalize="words"
            value={fullName} onChangeText={setFullName} error={submitted ? nameError : undefined} />
          <Input label="Email" placeholder="example@email.com" keyboardType="email-address" autoCapitalize="none" icon="mail-outline"
            autoComplete="email" textContentType="emailAddress" value={email} onChangeText={setEmail} error={submitted ? emailError : undefined} />
          <Input label="Mật khẩu" placeholder="Tối thiểu 6 ký tự" secureTextEntry autoCapitalize="none" icon="lock-closed-outline"
            autoComplete="new-password" textContentType="newPassword" value={password} onChangeText={setPassword} error={submitted ? passwordError : undefined} />
          <Input label="Nhập lại mật khẩu" placeholder="Nhập lại mật khẩu" secureTextEntry autoCapitalize="none" icon="lock-closed-outline"
            autoComplete="new-password" textContentType="newPassword" returnKeyType="go" onSubmitEditing={() => { void handleRegister(); }}
            value={confirmPassword} onChangeText={setConfirmPassword} error={submitted ? confirmError : undefined} />
          <Button title="Tạo tài khoản" onPress={() => { void handleRegister(); }} loading={loading} disabled={!hasSupabaseConfig} />
        </View>
        {!hasSupabaseConfig && <Notice tone="warning">Chưa cấu hình kết nối Supabase Auth.</Notice>}
        <View style={styles.footerRow}>
          <Text style={styles.footerText}>Đã có tài khoản?</Text>
          <Pressable accessibilityRole="link" hitSlop={8} onPress={() => router.dismissTo({ pathname: '/auth/login', params: { returnTo } })}>
            <Text style={styles.linkText}>Đăng nhập</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: 20, paddingBottom: 48, gap: 16 },
  header: { marginTop: 16, gap: 8 },
  title: { fontSize: 26, fontWeight: '900', color: theme.colors.ink },
  subtitle: { fontSize: 14, color: theme.colors.muted, lineHeight: 20 },
  form: { gap: 14, backgroundColor: theme.colors.surface, padding: 16, borderRadius: theme.radius.lg, ...theme.shadow.card },
  footerRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 },
  footerText: { fontSize: 14, color: theme.colors.muted },
  linkText: { fontSize: 14, fontWeight: '800', color: theme.colors.primary },
});
