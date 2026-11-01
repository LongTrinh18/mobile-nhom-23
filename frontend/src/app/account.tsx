import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/shop/Button';
import { theme } from '../theme/theme';

export default function AccountScreen() {
  return (
    <View style={styles.page}>
      <Text style={styles.icon}>👤</Text>
      <Text style={styles.title}>Tài khoản</Text>
      <Text style={styles.sub}>Đăng nhập hoặc đăng ký tài khoản để quản lý đơn hàng và lưu thông tin nhận hàng.</Text>

      <View style={styles.actions}>
        <Button title="Đăng nhập" onPress={() => router.push('/auth/login')} style={styles.btn} />
        <Button title="Đăng ký tài khoản" variant="outline" onPress={() => router.push('/auth/register')} style={styles.btn} />
      </View>

      <Button title="Về trang chủ" variant="outline" onPress={() => router.replace('/')} style={{ marginTop: 24, width: '100%' }} />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, padding: 28, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background },
  icon: { fontSize: 58 },
  title: { marginTop: 12, fontSize: 24, fontWeight: '800', color: theme.colors.ink },
  sub: { marginTop: 10, textAlign: 'center', color: theme.colors.muted, lineHeight: 22, maxWidth: 300 },
  actions: { width: '100%', marginTop: 28, gap: 12 },
  btn: { width: '100%' },
});
