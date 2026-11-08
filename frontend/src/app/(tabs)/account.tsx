import { useState } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/shop/Button';
import { useAuth } from '../../context/AuthContext';
import { authErrorMessage } from '../../services/auth-service';
import { theme } from '../../theme/theme';

export default function AccountScreen() {
  const { user, profile, initializing, profileLoading, error, refreshProfile, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  async function logout() {
    if (signingOut) return;
    setSigningOut(true);
    try { await signOut(); }
    catch (e) { Alert.alert('Không thể đăng xuất', authErrorMessage(e)); }
    finally { setSigningOut(false); }
  }
  return <ScrollView style={styles.screen} contentContainerStyle={styles.page}>
    <Text style={styles.title}>Tài khoản</Text>
    {initializing ? <><ActivityIndicator color={theme.colors.primary} /><Text style={styles.note}>Đang khôi phục phiên đăng nhập…</Text></>
      : user ? <>
        {profile ? <View style={styles.card}>
          <Text style={styles.name}>{profile.full_name}</Text>
          <Text style={styles.note}>{user.email}</Text>
          {profile.phone ? <Text style={styles.note}>{profile.phone}</Text> : null}
          <Text style={styles.note}>{profile.role === 'admin' ? 'Quản trị viên' : profile.role === 'manager' ? 'Quản lý cửa hàng' : 'Khách hàng'}</Text>
        </View> : profileLoading ? <ActivityIndicator color={theme.colors.primary} /> : null}
        {error ? <><Text accessibilityRole="alert" style={styles.error}>{error}</Text>
          <Button title="Tải lại hồ sơ" variant="outline" loading={profileLoading} onPress={() => { void refreshProfile(); }} /></> : null}
        <Text style={styles.note}>Giỏ hàng và đơn hàng được lưu trên tài khoản của bạn.</Text>
        <Button title="Giỏ hàng của tôi" disabled={signingOut} onPress={() => router.push('/cart')} />
        <Button title="Đăng xuất" variant="outline" loading={signingOut} onPress={logout} />
      </> : <>
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        <Text style={styles.note}>Đăng nhập để lưu giỏ hàng và đặt hàng nhận tại cửa hàng.</Text>
        <Button title="Đăng nhập" onPress={() => router.push('/auth/login')} />
        <Button title="Đăng ký tài khoản" variant="outline" onPress={() => router.push('/auth/register')} />
      </>}
    <Button title="Về trang chủ" variant="outline" disabled={signingOut} onPress={() => router.replace('/')} />
  </ScrollView>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  page: { flexGrow: 1, padding: 28, justifyContent: 'center', gap: 16 },
  title: { fontSize: 24, fontWeight: '800', color: theme.colors.ink },
  name: { fontSize: 20, fontWeight: '700', color: theme.colors.ink },
  card: { padding: 18, gap: 8, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, backgroundColor: theme.colors.surface },
  note: { color: theme.colors.muted, lineHeight: 22 },
  error: { color: theme.colors.primary, lineHeight: 22 },
});
