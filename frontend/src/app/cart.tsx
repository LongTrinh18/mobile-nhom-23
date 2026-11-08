import { router } from 'expo-router';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/shop/Button';
import { cartErrorMessage, useCart } from '../context/CartContext';
import { hasSupabaseConfig } from '../lib/supabase';
import { theme } from '../theme/theme';
import { formatVnd } from '../types/shop';
import { loginTarget } from '../navigation/routes';

export default function CartScreen() {
  const { items, count, totalVnd, loading, error, userId, branches, branchId,
    updateQuantity, removeItem, clearCart, refresh, selectBranch } = useCart();
  const perform = (action: () => Promise<void>) => {
    void action().catch(e => Alert.alert('Không thể cập nhật giỏ hàng', cartErrorMessage(e)));
  };
  const invalidStock = items.some(item => item.quantity > item.maxAvailable);

  if (hasSupabaseConfig && !userId && !loading) return <View style={styles.page}>
    <Text style={styles.title}>Giỏ hàng của bạn</Text>
    <Text style={styles.note}>Đăng nhập để lưu và khôi phục giỏ hàng trên tài khoản của bạn.</Text>
    <Button title="Đăng nhập" onPress={() => router.push(loginTarget({ pathname: '/cart' }))} />
  </View>;

  return <ScrollView style={styles.page} contentContainerStyle={styles.content}>
    <Text style={styles.title}>Giỏ hàng của bạn ({count})</Text>
    {!hasSupabaseConfig && <Text style={styles.warning}>DEMO · Giỏ hàng chỉ lưu trong phiên này. Đặt hàng cần kết nối Supabase.</Text>}
    {loading && <ActivityIndicator accessibilityLabel="Đang đồng bộ giỏ hàng" color={theme.colors.primary} />}
    {error && <View style={styles.card}><Text style={styles.warning}>{error}</Text>
      <Button title="Tải lại giỏ hàng" disabled={loading} onPress={() => perform(refresh)} /></View>}
    {!loading && !error && !items.length && <View style={styles.card}>
      <Text style={styles.name}>Giỏ hàng đang trống</Text>
      <Button title="Khám phá sản phẩm →" onPress={() => router.push('/products')} />
    </View>}
    {!!items.length && <>
      <View style={styles.card}>
        <Text style={styles.name}>Chi nhánh nhận hàng cho toàn bộ giỏ</Text>
        <Text style={styles.note}>Giỏ hàng được lưu theo SKU. Chọn chi nhánh để kiểm tra tồn kho trước khi đặt.</Text>
        {branches.map(branch => <Button key={branch.id} title={(branch.id === branchId ? '✓ ' : '') + branch.name}
          variant={branch.id === branchId ? 'primary' : 'outline'} disabled={loading}
          onPress={() => perform(() => selectBranch(branch.id))} />)}
      </View>
      {items.map(item => <View key={item.key} style={styles.card}>
        <View style={styles.row}>
          {item.imageUrl && <Image source={{ uri: item.imageUrl }} style={styles.image} />}
          <View style={styles.details}>
            <Text style={styles.name}>{item.productName}</Text>
            <Text>Size: {item.size} · Màu: {item.color}</Text>
            <Text style={styles.note}>{item.branchName} · SKU: {item.skuCode}</Text>
            <Text>{formatVnd(item.unitPriceVnd)} × {item.quantity} = {formatVnd(item.unitPriceVnd * item.quantity)}</Text>
          </View>
        </View>
        <View style={styles.row}>
          <Button title="−" variant="outline" disabled={loading || item.quantity <= 1}
            onPress={() => perform(() => updateQuantity(item.key, item.quantity - 1))} />
          <Text accessibilityLabel="Số lượng">{item.quantity}</Text>
          <Button title="+" variant="outline" disabled={loading || item.quantity >= item.maxAvailable}
            onPress={() => perform(() => updateQuantity(item.key, item.quantity + 1))} />
          <Button title="Xóa" variant="outline" disabled={loading} onPress={() => perform(() => removeItem(item.key))} />
        </View>
        <Text style={item.quantity > item.maxAvailable ? styles.warning : styles.note}>
          {item.quantity > item.maxAvailable ? 'Không đủ hàng: hãy giảm số lượng, xóa sản phẩm hoặc đổi chi nhánh.' : 'Có thể đặt tối đa: ' + item.maxAvailable}
        </Text>
      </View>)}
      <View style={styles.card}>
        <Text style={styles.name}>Tạm tính: {formatVnd(totalVnd)}</Text>
        <Text style={styles.note}>Nhận và thanh toán tại cửa hàng. Giá và tồn kho được kiểm tra lại khi đặt hàng.</Text>
        <Button title="Tiến hành đặt hàng →" disabled={loading || !!error || invalidStock || !hasSupabaseConfig}
          onPress={() => router.push('/checkout')} />
        <Button title="Tải lại giỏ hàng" variant="outline" disabled={loading} onPress={() => perform(refresh)} />
        <Button title="Xóa tất cả" variant="outline" disabled={loading} onPress={() => {
          Alert.alert('Xóa giỏ hàng', 'Xóa toàn bộ sản phẩm khỏi giỏ hàng?', [
            { text: 'Hủy', style: 'cancel' },
            { text: 'Xóa tất cả', style: 'destructive', onPress: () => perform(clearCart) },
          ]);
        }} />
      </View>
    </>}
  </ScrollView>;
}
const styles = StyleSheet.create({
  page: { flex: 1, padding: 18, backgroundColor: theme.colors.background },
  content: { paddingBottom: 48, gap: 14 },
  title: { fontSize: 24, fontWeight: '800', color: theme.colors.ink, marginBottom: 14 },
  card: { backgroundColor: '#fff', padding: 16, borderRadius: 12, gap: 12, borderWidth: 1, borderColor: theme.colors.border },
  name: { fontSize: 16, fontWeight: '700', color: theme.colors.ink },
  note: { color: theme.colors.muted, lineHeight: 20, marginVertical: 6 },
  warning: { color: '#9B3815', backgroundColor: '#FFF3D8', padding: 10, lineHeight: 20 },
  row: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  details: { flex: 1, gap: 5 },
  image: { width: 65, height: 85, borderRadius: 8 },
});
