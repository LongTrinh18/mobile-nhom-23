import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/shop/Button';
import { Input } from '../../components/shop/Input';
import { hasSupabaseConfig, supabase } from '../../lib/supabase';
import { theme } from '../../theme/theme';
import { authErrorMessage, userAuthError } from '../../services/auth-service';
import { firstParam, safeReturnTarget, targetUrl } from '../../navigation/routes';

export default function RegisterScreen() {
  const params = useLocalSearchParams();
  const returnTo = targetUrl(safeReturnTarget(firstParam(params.returnTo)));
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const nameError = !fullName.trim() ? 'Vui lòng nhập Họ và tên' : '';
  const emailError = !email.trim() ? 'Vui lòng nhập Email' : !/\S+@\S+\.\S+/.test(email) ? 'Email chưa hợp lệ' : '';
  const passwordError = !password ? 'Vui lòng nhập Mật khẩu' : password.length < 6 ? 'Mật khẩu tối thiểu 6 ký tự' : '';
  const confirmError = !confirmPassword ? 'Vui lòng nhập lại Mật khẩu' : confirmPassword !== password ? 'Mật khẩu xác nhận không khớp' : '';

  async function handleRegister() {
    setSubmitted(true);
    if (nameError || emailError || passwordError || confirmError) return;

    setLoading(true);
    try {
      if (!supabase) throw userAuthError('Chưa cấu hình kết nối Supabase Auth.');
      {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { full_name: fullName.trim() } },
        });
        if (error) {
          Alert.alert('Đăng ký thất bại', authErrorMessage(error));
          setLoading(false);
          return;
        }
      }
      // Email confirmation may be required by Supabase.
      Alert.alert('Đăng ký thành công', 'Vui lòng kiểm tra email xác nhận (nếu có), sau đó đăng nhập.', [
        { text: 'Chuyển sang Đăng nhập', onPress: () => router.dismissTo({ pathname: '/auth/login', params: { returnTo } }) },
      ]);
    } catch (err: unknown) {
      const message = authErrorMessage(err);
      Alert.alert('Lỗi đăng ký', message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Text style={styles.logo}>UNIQLO</Text>
        <Text style={styles.title}>Tạo tài khoản mới</Text>
        <Text style={styles.subtitle}>Đăng ký tài khoản để quản lý đơn hàng và nhận ưu đãi riêng.</Text>
      </View>

      <Input
        label="Họ và tên"
        placeholder="Nguyễn Văn A"
        value={fullName}
        onChangeText={setFullName}
        error={submitted ? nameError : undefined}
      />

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

      <Input
        label="Xác nhận mật khẩu"
        placeholder="••••••••"
        secureTextEntry
        autoCapitalize="none"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        error={submitted ? confirmError : undefined}
      />

      <Button title="Đăng ký tài khoản" onPress={handleRegister} loading={loading} disabled={!hasSupabaseConfig} style={{ marginTop: 8 }} />

      {!hasSupabaseConfig && (
        <Text style={styles.demoNotice}>Chưa cấu hình kết nối Supabase Auth.</Text>
      )}

      <View style={styles.footerRow}>
        <Text style={styles.footerText}>Đã có tài khoản?</Text>
        <Pressable onPress={() => router.dismissTo({ pathname: '/auth/login', params: { returnTo } })}>
          <Text style={styles.linkText}> Đăng nhập ngay</Text>
        </Pressable>
      </View>
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
});
