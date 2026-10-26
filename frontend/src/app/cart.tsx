/** Temporary working cart for N6 integration. Person C owns final cart UX (C04). */
import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { Button } from '../components/shop/Button';
import { useCart } from '../context/CartContext';
import { theme } from '../theme/theme';
import { formatVnd } from '../types/shop';

export default function CartScreen() {
  const { items, count, totalVnd, updateQuantity, removeItem } = useCart();
  return <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
    <Text style={styles.title}>Giỏ hàng của bạn</Text>
    <Text style={styles.subtitle}>{count} sản phẩm · Lưu tạm trên ứng dụng</Text>
    {!items.length ? <View style={styles.empty}>
      <Text style={styles.emptyIcon}>🛍️</Text>
      <Text style={styles.emptyTitle}>Chưa có sản phẩm trong giỏ</Text>
      <Button title="Tiếp tục mua sắm" onPress={() => router.push('/products')} style={{ marginTop: 16 }} />
    </View> : <>
      {items.map(item => <View key={item.key} style={styles.item}>
        <View style={styles.placeholder}><Text style={styles.emoji}>👕</Text></View>
        <View style={styles.info}>
          <Text style={styles.name}>{item.productName}</Text>
          <Text style={styles.muted}>{item.size} · {item.color}</Text>
          <Text style={styles.muted}>{item.branchName}</Text>
          <Text style={styles.muted}>SKU: {item.skuCode}</Text>
          <Text style={styles.price}>{formatVnd(item.unitPriceVnd)}</Text>
          <View style={styles.actions}>
            <Pressable style={styles.qtyButton} onPress={() => updateQuantity(item.key, item.quantity - 1)}>
              <Text style={styles.qtyLabel}>−</Text>
            </Pressable>
            <Text style={styles.qtyLabel}>{item.quantity}</Text>
            <Pressable style={styles.qtyButton} onPress={() => updateQuantity(item.key, item.quantity + 1)}>
              <Text style={styles.qtyLabel}>+</Text>
            </Pressable>
            <Pressable onPress={() => removeItem(item.key)} style={{ marginLeft: 'auto' }}><Text style={styles.remove}>Xóa</Text></Pressable>
          </View>
        </View>
      </View>)}
      <View style={styles.summary}>
        <View style={styles.totalRow}><Text style={styles.totalLabel}>Tạm tính</Text><Text style={styles.total}>{formatVnd(totalVnd)}</Text></View>
        <Text style={styles.muted}>Chưa bao gồm phí vận chuyển. Chưa giữ hàng trong kho.</Text>
        <Button title="Tiến hành đặt hàng" onPress={() => router.push('/checkout')} style={{ marginTop: 18 }}/>
      </View>
    </>}
  </ScrollView>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: 18, paddingBottom: 48 },
  title: { fontWeight: '800', fontSize: 24, color: theme.colors.ink },
  subtitle: { marginTop: 6, color: theme.colors.muted, marginBottom: 22 },
  empty: { alignItems: 'center', padding: 30, backgroundColor: '#fff', borderRadius: 14 },
  emptyIcon: { fontSize: 54, marginBottom: 12 },
  emptyTitle: { fontSize: 17, fontWeight: '700', textAlign: 'center' },
  item: { flexDirection: 'row', padding: 14, borderRadius: 14, backgroundColor: '#fff', marginBottom: 12 },
  placeholder: { width: 84, height: 108, borderRadius: 8, backgroundColor: '#EFEDE9', justifyContent: 'center', alignItems: 'center' },
  emoji: { fontSize: 32 },
  info: { flex: 1, marginLeft: 12 },
  name: { color: theme.colors.ink, fontWeight: '700', fontSize: 14, marginBottom: 4 },
  muted: { color: theme.colors.muted, fontSize: 12, marginTop: 3 },
  price: { color: theme.colors.primary, fontWeight: '800', marginTop: 5 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 10 },
  qtyButton: { borderWidth: 1, borderColor: theme.colors.border, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 7 },
  qtyLabel: { fontWeight: '700', color: theme.colors.ink, fontSize: 15 },
  remove: { color: theme.colors.danger, fontSize: 12, fontWeight: '700' },
  summary: { backgroundColor: '#fff', padding: 18, borderRadius: 14, marginTop: 10 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  totalLabel: { fontWeight: '700', color: theme.colors.ink },
  total: { color: theme.colors.primary, fontSize: 19, fontWeight: '800' },
});
