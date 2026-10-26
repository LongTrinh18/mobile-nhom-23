/** Person C owns account screens in C03. This is only a temporary route. */
import { router } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { Button } from '../components/shop/Button';
import { theme } from '../theme/theme';

export default function AccountScreen() {
  return <View style={styles.page}>
    <Text style={styles.icon}>👤</Text>
    <Text style={styles.title}>Tài khoản</Text>
    <Text style={styles.sub}>Màn hình đăng nhập, đăng ký và hồ sơ sẽ được người C phát triển trong C03.</Text>
    <Text style={styles.note}>Bản N1–N7: chưa kết nối Supabase Auth.</Text>
    <Button title="Về trang chủ" onPress={() => router.replace('/')} style={{ marginTop: 22 }}/>
  </View>;
}
const styles = StyleSheet.create({
  page: { flex: 1, padding: 28, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background },
  icon: { fontSize: 58 },
  title: { marginTop: 12, fontSize: 23, fontWeight: '800', color: theme.colors.ink },
  sub: { marginTop: 12, textAlign: 'center', color: theme.colors.muted, lineHeight: 22 },
  note: { marginTop: 14, fontWeight: '700', color: theme.colors.primary },
});
