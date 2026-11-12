import { useState, type ComponentProps } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../../components/ui/Text';
import { Button } from '../../components/shop/Button';
import { Badge, Card, Notice } from '../../components/ui/primitives';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { confirmAction, notify } from '../../lib/feedback';
import { hasSupabaseConfig } from '../../lib/supabase';
import { authErrorMessage } from '../../services/auth-service';
import { theme } from '../../theme/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];
function MenuItem({ icon, label, detail, onPress }: { icon: IconName; label: string; detail?: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.menuItem, pressed && { backgroundColor: theme.colors.soft }]}>
    <View style={styles.menuIcon}><Ionicons name={icon} size={20} color={theme.colors.ink} /></View>
    <Text style={styles.menuLabel}>{label}</Text>
    {!!detail && <Text style={styles.menuDetail}>{detail}</Text>}
    <Ionicons name="chevron-forward" size={18} color={theme.colors.subtle} />
  </Pressable>;
}

export default function AccountScreen() {
  const { user, profile, initializing, profileLoading, error, refreshProfile, signOut } = useAuth();
  const { count } = useCart();
  const [signingOut, setSigningOut] = useState(false);
  async function logout() {
    if (signingOut || !(await confirmAction('Đăng xuất', 'Bạn muốn đăng xuất khỏi thiết bị này?', 'Đăng xuất'))) return;
    setSigningOut(true);
    try { await signOut(); }
    catch (e) { notify('Không thể đăng xuất', authErrorMessage(e)); }
    finally { setSigningOut(false); }
  }
  const displayName = profile?.full_name ?? user?.email ?? '';
  const initial = displayName.trim().charAt(0).toLocaleUpperCase('vi') || '?';
  const role = profile?.role === 'admin' ? 'Quản trị viên' : profile?.role === 'manager' ? 'Quản lý cửa hàng' : 'Khách hàng';

  return <ScrollView style={styles.screen} contentContainerStyle={styles.page}>
    <Text accessibilityRole="header" style={styles.title}>Tài khoản</Text>
    {initializing ? <View style={styles.loading}><ActivityIndicator color={theme.colors.primary} /><Text style={styles.note}>Đang khôi phục phiên đăng nhập…</Text></View>
      : user ? <>
        <Card style={styles.profile}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{initial}</Text></View>
          <View style={{ flex: 1, gap: 4 }}>
            {profile ? <Text style={styles.name} numberOfLines={1}>{profile.full_name}</Text> : profileLoading ? <ActivityIndicator color={theme.colors.primary} style={{ alignSelf: 'flex-start' }} /> : null}
            <Text style={styles.note} numberOfLines={1}>{user.email}</Text>
            {profile?.phone ? <Text style={styles.note}>{profile.phone}</Text> : null}
            {profile && <Badge label={role} tone={profile.role === 'customer' ? 'neutral' : 'info'} />}
          </View>
        </Card>
        {error ? <Notice tone="danger" action={<Button size="sm" variant="danger" title="Tải lại hồ sơ" loading={profileLoading} onPress={() => { void refreshProfile(); }} />}>{error}</Notice> : null}
        <Card style={styles.menu}>
          <MenuItem icon="receipt-outline" label="Đơn hàng của tôi" onPress={() => router.navigate('/orders')} />
          <MenuItem icon="bag-handle-outline" label="Giỏ hàng" detail={count ? count + ' sản phẩm' : undefined} onPress={() => router.push('/cart')} />
          <MenuItem icon="shirt-outline" label="Mua sắm" onPress={() => router.push('/products')} />
          <MenuItem icon="chatbubbles-outline" label="Trợ lý mua sắm" onPress={() => router.push('/chatbot')} />
        </Card>
        <Button title="Đăng xuất" variant="outline" icon="log-out-outline" loading={signingOut} onPress={() => { void logout(); }} />
      </> : <>
        <Card style={styles.guest}>
          <View style={[styles.avatar, styles.guestAvatar]}><Ionicons name="person-outline" size={30} color={theme.colors.primary} /></View>
          <Text style={styles.name}>Chào bạn!</Text>
          <Text style={[styles.note, { textAlign: 'center' }]}>Đăng nhập để lưu giỏ hàng, đặt hàng nhận tại cửa hàng và theo dõi đơn.</Text>
          {error ? <Notice tone="danger">{error}</Notice> : null}
          <Button title="Đăng nhập" icon="log-in-outline" disabled={!hasSupabaseConfig} onPress={() => router.push('/auth/login')} style={styles.stretch} />
          <Button title="Tạo tài khoản mới" variant="outline" disabled={!hasSupabaseConfig} onPress={() => router.push('/auth/register')} style={styles.stretch} />
          {!hasSupabaseConfig && <Notice tone="warning">Chế độ demo: chưa kết nối Supabase nên chưa thể đăng nhập.</Notice>}
        </Card>
        <Card style={styles.menu}>
          <MenuItem icon="shirt-outline" label="Xem sản phẩm" onPress={() => router.push('/products')} />
          <MenuItem icon="bag-handle-outline" label="Giỏ hàng" onPress={() => router.push('/cart')} />
        </Card>
      </>}
  </ScrollView>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  page: { padding: 16, paddingBottom: 32, gap: 12 },
  title: { fontSize: 24, fontWeight: '800', color: theme.colors.ink },
  loading: { padding: 32, alignItems: 'center', gap: 10 },
  profile: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: theme.colors.ink, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 24, fontWeight: '800' },
  guest: { alignItems: 'center', paddingVertical: 24 },
  guestAvatar: { backgroundColor: theme.colors.primarySoft },
  stretch: { alignSelf: 'stretch' },
  name: { fontSize: 18, fontWeight: '800', color: theme.colors.ink },
  note: { color: theme.colors.muted, fontSize: 13, lineHeight: 19 },
  menu: { padding: 6, gap: 0 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 54, paddingHorizontal: 10, borderRadius: theme.radius.md },
  menuIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.colors.soft, alignItems: 'center', justifyContent: 'center' },
  menuLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: theme.colors.ink },
  menuDetail: { fontSize: 13, color: theme.colors.muted },
});
