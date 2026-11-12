import { useRef, useState } from 'react';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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

  const [fulfillmentType, setFulfillmentType] = useState<'pickup' | 'delivery'>('pickup');
  const [branchId, setBranchId] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [note, setNote] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const submitting = useRef(false);

  const nameError = !name.trim() ? 'Vui lòng nhập họ và tên người nhận.' : '';
  const normalizedPhone = phone.replace(/\s/g, '');
  const phoneError = !/^(0|\+84)\d{9}$/.test(normalizedPhone) ? 'Số điện thoại chưa hợp lệ (ví dụ: 0912345678).' : '';
  const addressError = fulfillmentType === 'delivery' && !address.trim() ? 'Vui lòng nhập địa chỉ giao hàng chi tiết.' : '';

  let preview: CartItem | null = null;
  let previewError: string | null = null;

  if (direct && catalog.data) {
    try { preview = buyNowItem(catalog.data, intent.draft, branchId); }
    catch (e) { previewError = cartErrorMessage(e); }
  }

  const items = direct ? (preview ? [preview] : []) : (cart.selectedItems.length > 0 ? cart.selectedItems : cart.items);
  const branches = direct ? catalog.data?.branches ?? [] : cart.branches;
  const selectedBranch = direct ? branchId : cart.branchId;

  const count = items.reduce((total, item) => total + item.quantity, 0);
  const subtotalVnd = items.reduce((total, item) => total + item.unitPriceVnd * item.quantity, 0);
  const shippingFee = fulfillmentType === 'delivery' ? (subtotalVnd > 500000 || subtotalVnd === 0 ? 0 : 30000) : 0;
  const grandTotalVnd = subtotalVnd + shippingFee;

  const loading = placing || cart.loading || (direct && catalog.loading);
  const error = localError ?? previewError ?? (direct ? catalog.error : cart.error);
  const invalidStock = items.some(item => item.quantity > item.maxAvailable);
  const destination: AppTarget = { pathname: '/checkout', params: routeContext(params) };

  async function confirmOrder() {
    setSubmitted(true);
    if (submitting.current || loading || intent.kind === 'invalid' || !items.length || nameError || phoneError || addressError) return;
    if (fulfillmentType === 'pickup' && !selectedBranch) {
      Alert.alert('Chưa chọn chi nhánh', 'Vui lòng chọn chi nhánh cửa hàng để nhận hàng.');
      return;
    }
    if (invalidStock) {
      Alert.alert('Không đủ tồn kho', 'Một số sản phẩm không đủ tồn kho tại chi nhánh đã chọn. Vui lòng kiểm tra lại.');
      return;
    }

    submitting.current = true;
    setPlacing(true);
    setLocalError(null);

    const itemCount = count;
    const currentBranchObj = branches.find(b => b.id === selectedBranch);
    const pickupName = currentBranchObj ? currentBranchObj.name : 'Chi nhánh UNIQLO';
    const idempotencyKey = `idemp-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    try {
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

        result = await placeBuyNowOrder({
          customerName: name.trim(),
          customerPhone: normalizedPhone,
          fulfillmentType,
          idempotencyKey,
          branchId: fulfillmentType === 'pickup' ? selectedBranch : undefined,
          deliveryAddress: fulfillmentType === 'delivery' ? address.trim() : undefined,
          note: note.trim() || undefined,
          items: [{ variantId: freshItem.skuId, quantity: freshItem.quantity }],
        });
        void cart.refresh().catch(() => {});
      } else {
        result = await cart.submitOrder({
          customerName: name.trim(),
          customerPhone: normalizedPhone,
          fulfillmentType,
          idempotencyKey,
          branchId: fulfillmentType === 'pickup' ? selectedBranch : undefined,
          deliveryAddress: fulfillmentType === 'delivery' ? address.trim() : undefined,
          note: note.trim() || undefined,
        });
      }

      router.replace({
        pathname: '/checkout/success',
        params: {
          orderId: result.order_id,
          orderCode: result.order_code,
          fulfillmentType,
          totalVnd: String(result.total_amount),
          name: name.trim(),
          phone: normalizedPhone,
          address: fulfillmentType === 'delivery' ? address.trim() : pickupName,
          branchName: pickupName,
          itemCount: String(itemCount),
        },
      });
    } catch (e) {
      const message = cartErrorMessage(e);
      setLocalError(message);
      Alert.alert('Chưa đặt được hàng', message);
    } finally {
      submitting.current = false;
      setPlacing(false);
    }
  }

  async function chooseBranch(id: string) {
    setLocalError(null);
    if (direct) setBranchId(id);
    else {
      try { await cart.selectBranch(id); }
      catch (e) { setLocalError(cartErrorMessage(e)); }
    }
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ header: () => <TopToolbar backDisabled={placing} /> }} />
      <Text style={styles.title}>{direct ? 'Đặt sản phẩm đang xem' : 'Xác nhận & Thanh toán đơn hàng'}</Text>

      {intent.kind === 'invalid' ? (
        <Text style={styles.error}>Thông tin mua hàng không hợp lệ. Vui lòng chọn lại sản phẩm.</Text>
      ) : hasSupabaseConfig && !cart.userId ? (
        <Button title="Đăng nhập để đặt hàng" onPress={() => router.push(loginTarget(destination) as any)} />
      ) : direct && catalog.loading ? (
        <Text>Đang tải sản phẩm...</Text>
      ) : !items.length ? (
        <View style={styles.card}>
          <Text style={error ? styles.error : undefined}>{error ?? 'Giỏ hàng đang trống.'}</Text>
          {direct && catalog.error && <Button title="Thử lại" onPress={catalog.retry} />}
          <Button title="Xem sản phẩm" onPress={() => router.dismissTo('/products')} />
        </View>
      ) : (
        <>
          {/* Step 1: Fulfillment Type Selection (Chọn hình thức nhận hàng) */}
          <View style={styles.card}>
            <Text style={styles.sectionHeader}>🚚 1. Phương thức nhận hàng</Text>
            <View style={styles.fulfillmentRow}>
              <Pressable
                style={[styles.fulfillmentTab, fulfillmentType === 'pickup' && styles.fulfillmentTabActive]}
                onPress={() => setFulfillmentType('pickup')}
              >
                <Text style={[styles.fulfillmentText, fulfillmentType === 'pickup' && styles.fulfillmentTextActive]}>
                  🏬 Nhận tại cửa hàng
                </Text>
                <Text style={styles.subtext}>Miễn phí vận chuyển</Text>
              </Pressable>

              <Pressable
                style={[styles.fulfillmentTab, fulfillmentType === 'delivery' && styles.fulfillmentTabActive]}
                onPress={() => setFulfillmentType('delivery')}
              >
                <Text style={[styles.fulfillmentText, fulfillmentType === 'delivery' && styles.fulfillmentTextActive]}>
                  🛵 Giao hàng tận nơi
                </Text>
                <Text style={styles.subtext}>Freeship cho đơn &gt; 500k</Text>
              </Pressable>
            </View>
          </View>

          {/* Branch Selection (for pickup mode or branch stock check) */}
          {fulfillmentType === 'pickup' && (
            <View style={styles.card}>
              <Text style={styles.sectionHeader}>📍 Chọn chi nhánh nhận hàng</Text>
              <Text style={styles.note}>Chọn cửa hàng UNIQLO thuận tiện nhất cho bạn đến lấy sản phẩm:</Text>
              {branches.map(branch => (
                <Pressable
                  key={branch.id}
                  style={[styles.branchCard, selectedBranch === branch.id && styles.branchCardSelected]}
                  onPress={() => { void chooseBranch(branch.id); }}
                >
                  <View style={styles.radioDot}>
                    {selectedBranch === branch.id && <View style={styles.radioDotInner} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.branchName}>{branch.name}</Text>
                    {branch.address && <Text style={styles.branchAddr}>{branch.address}</Text>}
                  </View>
                </Pressable>
              ))}
              {!selectedBranch && <Text style={styles.error}>Vui lòng chọn chi nhánh cửa hàng để kiểm tra tồn kho.</Text>}
              {selectedBranch && invalidStock ? (
                <Text style={styles.error}>⚠️ Không đủ hàng tại cửa hàng đã chọn. Vui lòng đổi cửa hàng hoặc giảm số lượng.</Text>
              ) : null}
            </View>
          )}

          {/* Customer & Address Details Form */}
          <View style={styles.card}>
            <Text style={styles.sectionHeader}>👤 2. Thông tin người nhận</Text>

            <Input
              label="Họ và tên người nhận *"
              placeholder="Nguyễn Văn A"
              value={name}
              onChangeText={setName}
              error={submitted ? nameError : undefined}
            />

            <Input
              label="Số điện thoại liên hệ *"
              placeholder="0912345678"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
              error={submitted ? phoneError : undefined}
            />

            {fulfillmentType === 'delivery' && (
              <Input
                label="Địa chỉ giao hàng chi tiết *"
                placeholder="Số nhà, Tên đường, Phường/Xã, Quận/Huyện, Tỉnh/Thành phố"
                multiline
                value={address}
                onChangeText={setAddress}
                error={submitted ? addressError : undefined}
              />
            )}

            <Input
              label="Ghi chú đơn hàng (không bắt buộc)"
              placeholder="Ví dụ: Giao giờ hành chính, gọi trước khi giao..."
              value={note}
              onChangeText={setNote}
            />
          </View>

          {/* Payment Method Section */}
          <View style={styles.card}>
            <Text style={styles.sectionHeader}>💳 3. Phương thức thanh toán</Text>
            <View style={styles.paymentBox}>
              <Text style={styles.paymentTitle}>💵 Thanh toán khi nhận hàng (COD)</Text>
              <Text style={styles.paymentSub}>
                {fulfillmentType === 'pickup'
                  ? 'Thanh toán trực tiếp bằng tiền mặt hoặc thẻ tại quầy thu ngân cửa hàng.'
                  : 'Thanh toán bằng tiền mặt cho shipper khi nhận được hàng.'}
              </Text>
            </View>
          </View>

          {/* Items Review & Subtotal */}
          <View style={styles.card}>
            <Text style={styles.sectionHeader}>📋 4. Tóm tắt sản phẩm ({count})</Text>

            {items.map(item => (
              <View key={item.key} style={styles.line}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>{item.productName}</Text>
                  <Text style={styles.itemMeta}>Size: {item.size} · Màu: {item.color} · SKU: {item.skuCode}</Text>
                  <Text style={styles.itemBranch}>🏬 Chi nhánh: {item.branchName}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.itemQty}>x{item.quantity}</Text>
                  <Text style={styles.itemPrice}>{formatVnd(item.unitPriceVnd * item.quantity)}</Text>
                </View>
              </View>
            ))}

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Tạm tính tiền hàng:</Text>
              <Text style={styles.summaryVal}>{formatVnd(subtotalVnd)}</Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Phí vận chuyển:</Text>
              <Text style={styles.summaryVal}>
                {fulfillmentType === 'pickup' ? <Text style={styles.freeText}>MIỄN PHÍ (Nhận tại shop)</Text> : shippingFee === 0 ? <Text style={styles.freeText}>MIỄN PHÍ</Text> : formatVnd(shippingFee)}
              </Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.summaryRow}>
              <Text style={styles.grandTotalLabel}>Tổng thanh toán:</Text>
              <Text style={styles.grandTotalVal}>{formatVnd(grandTotalVnd)}</Text>
            </View>

            {error && <Text style={styles.error}>{error}</Text>}
            {!hasSupabaseConfig && <Text style={styles.note}>Đặt hàng cần kết nối Supabase.</Text>}

            <Button
              title={placing ? 'Đang khởi tạo đơn hàng...' : `Xác nhận đặt hàng (${formatVnd(grandTotalVnd)})`}
              loading={loading}
              disabled={!hasSupabaseConfig || (fulfillmentType === 'pickup' && !selectedBranch) || invalidStock || !!previewError}
              onPress={confirmOrder}
              style={{ marginTop: 14 }}
            />
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: 16, paddingBottom: 50, gap: 14 },
  title: { fontSize: 22, fontWeight: '800', color: theme.colors.ink },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, gap: 12, borderWidth: 1, borderColor: theme.colors.border },
  sectionHeader: { fontSize: 15, fontWeight: '800', color: theme.colors.ink },

  fulfillmentRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  fulfillmentTab: { flex: 1, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: '#FAFAFA', alignItems: 'center' },
  fulfillmentTabActive: { borderColor: theme.colors.primary, backgroundColor: '#FEF2F2' },
  fulfillmentText: { fontSize: 13, fontWeight: '700', color: theme.colors.ink },
  fulfillmentTextActive: { color: theme.colors.primary },
  subtext: { fontSize: 10, color: theme.colors.muted, marginTop: 2 },

  branchCard: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: '#FAFAFA', gap: 10 },
  branchCardSelected: { borderColor: theme.colors.primary, backgroundColor: '#FEF2F2' },
  radioDot: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: theme.colors.primary, justifyContent: 'center', alignItems: 'center' },
  radioDotInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.primary },
  branchName: { fontSize: 13, fontWeight: '700', color: theme.colors.ink },
  branchAddr: { fontSize: 11, color: theme.colors.muted, marginTop: 2 },

  paymentBox: { backgroundColor: '#FAFAFA', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: theme.colors.border },
  paymentTitle: { fontSize: 13, fontWeight: '700', color: theme.colors.ink },
  paymentSub: { fontSize: 11, color: theme.colors.muted, marginTop: 4, lineHeight: 16 },

  line: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderColor: '#F3F4F6' },
  itemName: { fontSize: 13, fontWeight: '700', color: theme.colors.ink },
  itemMeta: { fontSize: 11, color: theme.colors.muted, marginTop: 2 },
  itemBranch: { fontSize: 11, color: theme.colors.primary, marginTop: 2 },
  itemQty: { fontSize: 11, color: theme.colors.muted },
  itemPrice: { fontSize: 13, fontWeight: '700', color: theme.colors.ink, marginTop: 2 },

  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { fontSize: 13, color: theme.colors.muted },
  summaryVal: { fontSize: 13, fontWeight: '600', color: theme.colors.ink },
  freeText: { color: '#047857', fontWeight: '800', fontSize: 12 },

  divider: { height: 1, backgroundColor: theme.colors.border, marginVertical: 6 },
  grandTotalLabel: { fontSize: 15, fontWeight: '800', color: theme.colors.ink },
  grandTotalVal: { fontSize: 18, fontWeight: '900', color: theme.colors.primary },

  error: { color: theme.colors.danger, fontSize: 12, lineHeight: 18 },
  note: { color: theme.colors.muted, fontSize: 12, lineHeight: 18 },
});
