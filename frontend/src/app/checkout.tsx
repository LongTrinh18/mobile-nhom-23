import { useRef, useState } from 'react';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { placeBuyNowOrder } from '../api/orderApi';
import { TopToolbar } from '../components/navigation/TopToolbar';
import { Button } from '../components/shop/Button';
import { Input } from '../components/shop/Input';
import { cartErrorMessage, useCart } from '../context/CartContext';
import { useCatalog } from '../features/catalog/useCatalog';
import { hasSupabaseConfig, supabase } from '../lib/supabase';
import { loginTarget, routeContext, type AppTarget } from '../navigation/routes';
import { getCatalog } from '../services/catalog-service';
import { validateOrderItems } from '../services/cart-adapter';
import { buyNowItem, parseCheckoutIntent } from '../services/product-purchase';
import { theme } from '../theme/theme';
import { formatVnd, type CartItem } from '../types/shop';

export default function CheckoutScreen() {
  const params = useLocalSearchParams();
  const intent = parseCheckoutIntent(params);
  const direct = intent.kind === 'buy-now';
  const catalog = useCatalog();
  const cart = useCart();
  const [branchId, setBranchId] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const submitting = useRef(false);
  const nameError = !name.trim() ? 'Vui lòng nhập họ và tên người nhận.' : '';
  const normalizedPhone = phone.replace(/\s/g, '');
  const phoneError = !/^(0|\+84)\d{9}$/.test(normalizedPhone) ? 'Số điện thoại không hợp lệ (ví dụ: 0912345678).' : '';
  let preview: CartItem | null = null;
  let previewError: string | null = null;
  if (direct && catalog.data) {
    try { preview = buyNowItem(catalog.data, intent.draft, branchId); }
    catch (e) { previewError = cartErrorMessage(e); }
  }
  const items = direct ? preview ? [preview] : [] : cart.items;
  const branches = direct ? catalog.data?.branches ?? [] : cart.branches;
  const selectedBranch = direct ? branchId : cart.branchId;
  const count = items.reduce((total, item) => total + item.quantity, 0);
  const totalVnd = items.reduce((total, item) => total + item.unitPriceVnd * item.quantity, 0);
  const loading = placing || cart.loading || (direct && catalog.loading);
  const error = localError ?? previewError ?? (direct ? catalog.error : cart.error);
  const invalidStock = items.some(item => item.quantity > item.maxAvailable);
  const destination: AppTarget = { pathname: '/checkout', params: routeContext(params) };

  async function confirmOrder() {
    setSubmitted(true);
    if (submitting.current || loading || intent.kind === 'invalid' || !items.length || nameError || phoneError || !selectedBranch || invalidStock) return;
    submitting.current = true; setPlacing(true); setLocalError(null);
    const itemCount = count;
    const pickupName = items[0].branchName;
    try {
      const customer = { customerName: name.trim(), customerPhone: normalizedPhone, note: note.trim() || undefined };
      let result;
      if (intent.kind === 'buy-now') {
        if (!supabase) throw new Error('Đặt hàng cần kết nối Supabase.');
        const identity = await supabase.auth.getUser();
        if (identity.error || !identity.data.user) throw new Error('Bạn cần đăng nhập để đặt hàng.');
        const owner = identity.data.user.id;
        const freshCatalog = await getCatalog();
        const freshItem = buyNowItem(freshCatalog, intent.draft, selectedBranch);
        validateOrderItems([freshItem]);
        const current = await supabase.auth.getSession();
        if (current.data.session?.user.id !== owner) throw new Error('Tài khoản đã thay đổi. Vui lòng thử lại.');
        result = await placeBuyNowOrder({ ...customer, branchId: selectedBranch,
          items: [{ variantId: freshItem.skuId, quantity: freshItem.quantity }] });
        // Refresh stock independently; a successful purchase remains successful if refreshing the cart fails.
        void cart.refresh().catch(() => {});
      } else result = await cart.submitOrder(customer);
      router.replace({ pathname: '/checkout/success', params: {
        orderId: result.order_id, orderCode: result.order_code, totalVnd: String(result.total_amount),
        name: name.trim(), phone: normalizedPhone, branchName: pickupName, itemCount: String(itemCount),
      } });
    } catch (e) { const message = cartErrorMessage(e); setLocalError(message); Alert.alert('Chưa đặt được hàng', message); }
    finally { submitting.current = false; setPlacing(false); }
  }
  async function chooseBranch(id: string) {
    setLocalError(null);
    if (direct) setBranchId(id);
    else { try { await cart.selectBranch(id); } catch (e) { setLocalError(cartErrorMessage(e)); } }
  }

  return <ScrollView style={styles.page} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Stack.Screen options={{ header: () => <TopToolbar backDisabled={placing} /> }} />
    <Text style={styles.title}>{direct ? 'Đặt sản phẩm đang xem' : 'Xác nhận đơn nhận tại cửa hàng'}</Text>
    {intent.kind === 'invalid' ? <Text style={styles.error}>Thông tin mua hàng không hợp lệ. Vui lòng chọn lại sản phẩm.</Text>
      : hasSupabaseConfig && !cart.userId ? <Button title="Đăng nhập để đặt hàng" onPress={() => router.push(loginTarget(destination))} />
      : direct && catalog.loading ? <Text>Đang tải sản phẩm...</Text>
      : !items.length ? <View style={styles.card}>
        <Text style={error ? styles.error : undefined}>{error ?? 'Giỏ hàng đang trống.'}</Text>
        {direct && catalog.error && <Button title="Thử lại" onPress={catalog.retry} />}
        <Button title="Xem sản phẩm" onPress={() => router.dismissTo('/products')} />
      </View> : <>
        {direct && <Text style={styles.note}>Đơn này chỉ gồm SKU và số lượng bạn đã chọn. Các sản phẩm trong giỏ hàng được giữ nguyên.</Text>}
        <View style={styles.card}>
          <Text style={styles.name}>Chọn cửa hàng nhận hàng</Text>
          {branches.map(branch => <Button key={branch.id} title={(selectedBranch === branch.id ? '✓ ' : '') + branch.name}
            variant={selectedBranch === branch.id ? 'primary' : 'outline'} disabled={loading} onPress={() => { void chooseBranch(branch.id); }} />)}
          {!selectedBranch && <Text style={styles.note}>Vui lòng chọn nơi nhận hàng để kiểm tra tồn kho.</Text>}
          {selectedBranch && invalidStock ? <Text style={styles.error}>Không đủ hàng tại cửa hàng đã chọn. Vui lòng đổi cửa hàng hoặc giảm số lượng.</Text> : null}
          <Input label="Họ và tên người nhận *" value={name} onChangeText={setName} error={submitted ? nameError : undefined} />
          <Input label="Số điện thoại *" keyboardType="phone-pad" value={phone} onChangeText={setPhone} error={submitted ? phoneError : undefined} />
          <Input label="Ghi chú (không bắt buộc)" value={note} onChangeText={setNote} />
        </View>
        <View style={styles.card}>
          <Text style={styles.name}>Kiểm tra sản phẩm ({count})</Text>
          {items.map(item => <View key={item.key} style={styles.line}>
            <Text>{item.productName} · {item.size}/{item.color} × {item.quantity}</Text>
            <Text>{formatVnd(item.unitPriceVnd * item.quantity)}</Text>
          </View>)}
          <Text style={styles.name}>Tạm tính: {formatVnd(totalVnd)}</Text>
          <Text>Thanh toán tại cửa hàng khi nhận hàng. Giá và tồn kho được xác nhận khi tạo đơn.</Text>
          {error && <Text style={styles.error}>{error}</Text>}
          {!hasSupabaseConfig && <Text style={styles.note}>Đặt hàng cần kết nối Supabase.</Text>}
          <Button title="Xác nhận đặt hàng" loading={loading} disabled={!hasSupabaseConfig || !selectedBranch || invalidStock || !!previewError}
            onPress={confirmOrder} />
        </View>
      </>}
  </ScrollView>;
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.colors.background }, content: { padding: 18, paddingBottom: 48, gap: 16 },
  title: { fontSize: 24, fontWeight: '800', color: theme.colors.ink }, name: { fontSize: 16, fontWeight: '700', color: theme.colors.ink },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 18, gap: 14 }, line: { gap: 6, paddingVertical: 10, borderBottomWidth: 1, borderColor: theme.colors.border },
  error: { color: theme.colors.danger, lineHeight: 20 }, note: { color: theme.colors.muted, lineHeight: 21 },
});
