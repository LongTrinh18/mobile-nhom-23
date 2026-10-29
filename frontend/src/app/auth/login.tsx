import { useState } from 'react';
import { router } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/shop/Button';
import { Input } from '../../components/shop/Input';
import { hasSupabaseConfig, supabase } from '../../lib/supabase';
import { theme } from '../../theme/theme';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const emailError = !email.trim() ? 'Vui lòng nhập Email' : !/\S+@\S+\.\S+/.test(email) ? 'Email chưa hợp lệ' : '';
  const passwordError = !password ? 'Vui lòng nhập Mật khẩu' : password.length < 6 ? 'Mật khẩu tối thiểu 6 ký tự' : '';

  async function handleLogin() {
    setSubmitted(true);
    if (emailError || passwordError) return;

    setLoading(true);
    try {
      if (hasSupabaseConfig && supabase) {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) {
          Alert.alert('Đăng nhập thất bại', error.message);
          setLoading(false);
          return;
        }
      }
      // Demo / Success login flow
      Alert.alert('Đăng nhập thành công', `Chào mừng ${email.trim()}!`, [
        { text: 'OK', onPress: () => router.replace('/account') },
      ]);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Có lỗi xảy ra khi đăng nhập.';
      Alert.alert('Lỗi đăng nhập', message);
    } finally {
      setLoading(false);
    }
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

      <Button title="Đăng nhập" onPress={handleLogin} loading={loading} style={{ marginTop: 8 }} />

      {!hasSupabaseConfig && (
        <Text style={styles.demoNotice}>DEMO · Chưa kết nối Supabase Auth. Bạn có thể thử đăng nhập bằng bất kỳ email/mật khẩu nào hợp lệ.</Text>
      )}

      <View style={styles.footerRow}>
        <Text style={styles.footerText}>Chưa có tài khoản?</Text>
        <Pressable onPress={() => router.push('/auth/register')}>
          <Text style={styles.linkText}> Đăng ký ngay</Text>
        </Pressable>
      </View>

      <Pressable onPress={() => router.replace('/')} style={styles.skipButton}>
        <Text style={styles.skipText}>Bỏ qua & Về trang chủ →</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
