import { useEffect, useRef, useState, type ComponentProps } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../components/ui/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getVouchers } from '../api/catalogApi';
import { placeOrder } from '../api/orderApi';
import type { PlaceOrderResult } from '../api/types';
import { DestinationState } from '../components/navigation/DestinationState';
import { TopToolbar } from '../components/navigation/TopToolbar';
import { Button } from '../components/shop/Button';
import { Input } from '../components/shop/Input';
import { ProductPicture } from '../components/shop/ProductPicture';
import { Badge, Card, Chip, Divider, Notice, Row, SectionTitle } from '../components/ui/primitives';
import { Price } from '../components/ui/Price';
import { useAuth } from '../context/AuthContext';
import { cartErrorMessage, useCart } from '../context/CartContext';
import { useCatalog } from '../features/catalog/useCatalog';
import { notify } from '../lib/feedback';
import { hasSupabaseConfig } from '../lib/supabase';
import { uuidv4 } from '../lib/uuid';
import { loginTarget, routeContext, type AppTarget } from '../navigation/routes';
import {
  checkBranches, normalizePhone, normalizeVoucherCode, orderSignature, quoteOrder, validateCustomer, voucherProblem,
  type FulfillmentType, type VoucherRule,
} from '../services/checkout';
import { buyNowItem, parseCheckoutIntent } from '../services/product-purchase';
import { theme } from '../theme/theme';
import { formatVnd, type CartItem } from '../types/shop';

type IconName = ComponentProps<typeof Ionicons>['name'];
const demoVouchers: VoucherRule[] = [
  { code: 'UNIQLO10', description: 'Giảm 10% tiền hàng', discount_type: 'percent', discount_value: 10, applies_to: 'all' },
  { code: 'FREESHIP', description: 'Miễn phí giao hàng', discount_type: 'free_shipping', discount_value: 0, applies_to: 'delivery' },
];

function useVouchers() {
  const [state, setState] = useState<{ list: VoucherRule[]; loaded: boolean }>({ list: hasSupabaseConfig ? [] : demoVouchers, loaded: !hasSupabaseConfig });
  useEffect(() => {
    if (!hasSupabaseConfig) return;
    let active = true;
    getVouchers().then(list => { if (active) setState({ list, loaded: true }); })
      .catch(() => { if (active) setState({ list: [], loaded: true }); });
    return () => { active = false; };
  }, []);
  return state;
}

function FulfillmentOption({ icon, title, subtitle, selected, onPress }: { icon: IconName; title: string; subtitle: string; selected: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="radio" accessibilityState={{ checked: selected }} onPress={onPress}
    style={({ pressed }) => [styles.option, selected && styles.optionOn, pressed && { opacity: 0.85 }]}>
    <Ionicons name={icon} size={24} color={selected ? theme.colors.primary : theme.colors.ink} />
    <Text style={[styles.optionTitle, selected && { color: theme.colors.primary }]}>{title}</Text>
    <Text style={styles.optionSub}>{subtitle}</Text>
  </Pressable>;
}

export default function CheckoutScreen() {
  const params = useLocalSearchParams();
  const intent = parseCheckoutIntent(params);
  const direct = intent.kind === 'buy-now';
  const catalog = useCatalog();
  const cart = useCart();
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();
  const vouchers = useVouchers();

  const [type, setType] = useState<FulfillmentType>('pickup');
  const [pickedBranch, setPickedBranch] = useState('');
  // null = not edited yet, so the profile can fill the field once it loads
  const [name, setName] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [address, setAddress] = useState('');
  const [note, setNote] = useState('');
  const [voucherInput, setVoucherInput] = useState('');
  const [voucherCode, setVoucherCode] = useState<string | null>(null);
  const [voucherError, setVoucherError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const attempt = useRef<{ signature: string; key: string } | null>(null);

  const nameValue = name ?? profile?.full_name ?? '';
  const phoneValue = phone ?? profile?.phone ?? '';
  const data = catalog.data;

  let lines: CartItem[] = [];
  let previewError: string | null = null;
  if (direct && data) {
    try { lines = [buyNowItem(data, intent.draft, '')]; }
    catch (e) { previewError = cartErrorMessage(e); }
  } else if (!direct) lines = cart.selectedItems;

  const branches = data?.branches ?? cart.branches;
  const checks = data ? checkBranches(data, lines.map(line => ({ skuId: line.skuId, skuCode: line.skuCode, quantity: line.quantity }))) : [];
  const checkOf = (id: string) => checks.find(check => check.branchId === id);
  const preferred = !direct && cart.branchId && checkOf(cart.branchId)?.canFulfill ? cart.branchId : checks.find(check => check.canFulfill)?.branchId;
  const branchId = pickedBranch || preferred || cart.branchId || '';
  const branch = branches.find(item => item.id === branchId);
  const branchCheck = checkOf(branchId);
  const anyBranchCanFulfill = checks.some(check => check.canFulfill);

  const voucher = voucherCode ? vouchers.list.find(item => item.code === voucherCode) : undefined;
  const voucherIssue = voucherCode ? voucherProblem(voucher, type) : null;
  const subtotal = lines.reduce((total, item) => total + item.unitPriceVnd * item.quantity, 0);
  const quote = quoteOrder(subtotal, type, voucherIssue ? null : voucher);
  const itemCount = lines.reduce((total, item) => total + item.quantity, 0);
  const errors = validateCustomer({ name: nameValue, phone: phoneValue, address, type });
  const stockProblem = type === 'pickup'
    ? (branchCheck && !branchCheck.canFulfill ? 'Cửa hàng này không đủ hàng. Hãy chọn cửa hàng khác hoặc giao tận nơi.' : !branchId ? 'Vui lòng chọn cửa hàng nhận hàng.' : '')
    : (data && lines.length && !anyBranchCanFulfill ? 'Không cửa hàng nào đủ hàng cho cả đơn. Hãy giảm số lượng hoặc bỏ bớt món.' : '');
  const busy = placing || cart.loading;
  const destination: AppTarget = { pathname: '/checkout', params: routeContext(params) };

  function applyVoucher(raw = voucherInput) {
    const code = normalizeVoucherCode(raw);
    setVoucherInput(code);
    if (!code) { setVoucherError('Nhập mã giảm giá để áp dụng.'); return; }
    // A delivery-only code is kept (with a warning) so switching to delivery applies it; it is never sent for pickup.
    if (!vouchers.list.some(item => item.code === code)) { setVoucherError(voucherProblem(undefined, type) ?? ''); setVoucherCode(null); return; }
    setVoucherError(''); setVoucherCode(code);
  }

  async function confirmOrder() {
    setSubmitted(true);
    if (placing || busy || intent.kind === 'invalid' || !lines.length) return;
    const firstError = errors.name || errors.phone || errors.address || stockProblem;
    if (firstError) { notify('Chưa thể đặt hàng', firstError); return; }

    const usableVoucher = voucher && !voucherIssue ? voucher.code : undefined;
    const orderLines = lines.map(line => ({ skuId: line.skuId, skuCode: line.skuCode, quantity: line.quantity }));
    const signature = orderSignature({ type, branchId, address, voucher: usableVoucher, lines: orderLines });
    // Re-sending the same order re-uses its key, so a retry after a timeout never creates a second order.
    if (attempt.current?.signature !== signature) attempt.current = { signature, key: uuidv4() };
    const customer = {
      customerName: nameValue.trim(),
      customerPhone: normalizePhone(phoneValue),
      fulfillmentType: type,
      idempotencyKey: attempt.current.key,
      branchId: type === 'pickup' ? branchId : undefined,
      deliveryAddress: type === 'delivery' ? address.trim() : undefined,
      voucherCode: usableVoucher,
      note: note.trim() || undefined,
    };
    setPlacing(true); setLocalError(null);
    try {
      const result: PlaceOrderResult = intent.kind === 'buy-now'
        ? await placeOrder({ ...customer, fulfillmentType: type, items: orderLines.map(line => ({ variantId: line.skuId, quantity: line.quantity })) })
        : await cart.submitOrder({ ...customer, keys: lines.map(line => line.key) });
      router.replace({ pathname: '/checkout/success', params: {
        orderId: result.order_id, orderCode: result.order_code, fulfillmentType: result.fulfillment_type ?? type,
        branchName: result.branch_name ?? branch?.name ?? '', branchAddress: result.branch_address ?? branch?.address ?? '',
        subtotal: String(result.subtotal_amount ?? quote.subtotal), discount: String(result.discount_amount ?? quote.discount),
        shipping: String(result.shipping_fee ?? quote.shipping), totalVnd: String(result.total_amount ?? quote.total),
        voucher: result.voucher_code ?? '', name: customer.customerName, phone: customer.customerPhone,
        address: customer.deliveryAddress ?? '', itemCount: String(itemCount),
      } });
    } catch (e) {
      const message = cartErrorMessage(e);
      setLocalError(message);
      notify('Chưa đặt được hàng', message);
    } finally { setPlacing(false); }
  }

  const header = <Stack.Screen options={{ header: () => <TopToolbar backDisabled={placing} /> }} />;
  if (intent.kind === 'invalid') return <View style={styles.page}>{header}
    <DestinationState icon="alert-circle-outline" title="Thông tin mua hàng không hợp lệ" description="Vui lòng chọn lại sản phẩm và số lượng."
      actionLabel="Xem sản phẩm" onAction={() => router.dismissTo('/products')} /></View>;
  if (hasSupabaseConfig && !cart.userId && !cart.loading) return <View style={styles.page}>{header}
    <DestinationState icon="person-circle-outline" title="Đăng nhập để đặt hàng" description="Đơn hàng được lưu trên tài khoản để bạn theo dõi và nhận hàng."
      actionLabel="Đăng nhập" onAction={() => router.push(loginTarget(destination) as never)} /></View>;
  if ((direct && catalog.loading) || (!direct && cart.loading && !lines.length)) return <View style={[styles.page, styles.center]}>{header}
    <ActivityIndicator color={theme.colors.primary} size="large" /></View>;
  if (!lines.length) return <View style={styles.page}>{header}
    <DestinationState icon="bag-outline" title={previewError ?? catalog.error ?? 'Chưa có sản phẩm để đặt'}
      description={direct ? 'Sản phẩm có thể đã ngừng bán. Hãy chọn sản phẩm khác.' : 'Hãy chọn sản phẩm trong giỏ hàng trước khi đặt.'}
      actionLabel={direct ? 'Xem sản phẩm' : 'Về giỏ hàng'} onAction={() => direct ? router.dismissTo('/products') : router.dismissTo('/cart')} /></View>;

  return (
    <View style={styles.page}>
      {header}
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 130 + insets.bottom }]} keyboardShouldPersistTaps="handled">
        <Text accessibilityRole="header" style={styles.title}>{direct ? 'Mua ngay' : 'Đặt hàng'}</Text>

        <Card>
          <SectionTitle step={1} title="Hình thức nhận hàng" />
          <View accessibilityRole="radiogroup" style={styles.optionRow}>
            <FulfillmentOption icon="storefront-outline" title="Nhận tại cửa hàng" subtitle="Miễn phí · giữ hàng cho bạn" selected={type === 'pickup'} onPress={() => setType('pickup')} />
            <FulfillmentOption icon="bicycle-outline" title="Giao tận nơi" subtitle="30.000 ₫ · free trên 500k" selected={type === 'delivery'} onPress={() => setType('delivery')} />
          </View>
        </Card>

        {type === 'pickup' ? <Card>
          <SectionTitle step={2} title="Chọn cửa hàng" />
          {branches.map(item => {
            const check = checkOf(item.id);
            const selected = item.id === branchId;
            return <Pressable key={item.id} accessibilityRole="radio" accessibilityState={{ checked: selected }}
              accessibilityLabel={item.name + (check?.canFulfill ? ', đủ hàng' : ', thiếu hàng')}
              onPress={() => { setPickedBranch(item.id); setLocalError(null); }} style={[styles.branch, selected && styles.branchOn]}>
              <View style={[styles.radio, selected && styles.radioOn]}>{selected && <View style={styles.radioDot} />}</View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.branchName}>{item.name}</Text>
                {!!item.address && <Text style={styles.branchAddr} numberOfLines={2}>{item.address}</Text>}
                {selected && check && !check.canFulfill && <Text style={styles.missing}>
                  Thiếu: {check.missing.map(m => `${m.skuCode} (còn ${m.available}/${m.requested})`).join(', ')}
                </Text>}
              </View>
              {check && <Badge label={check.canFulfill ? 'Đủ hàng' : 'Thiếu ' + check.missing.length + ' món'} tone={check.canFulfill ? 'success' : 'warning'} />}
            </Pressable>;
          })}
          <Text style={styles.hint}>Cửa hàng giữ hàng tối đa 3 ngày sau khi báo “Sẵn sàng nhận”.</Text>
        </Card> : <Card>
          <SectionTitle step={2} title="Địa chỉ giao hàng" />
          <Input label="Địa chỉ nhận hàng *" placeholder="Số nhà, tên đường, phường/xã, quận/huyện, TP.HCM" multiline icon="location-outline"
            value={address} onChangeText={setAddress} error={submitted ? errors.address : undefined} autoComplete="street-address" />
          {anyBranchCanFulfill || !data
            ? <Notice tone="info">Cửa hàng còn đủ hàng sẽ giao cho bạn (chỉ giao trong TP.HCM).</Notice>
            : <Notice tone="danger">Không cửa hàng nào đủ hàng cho cả đơn. Hãy giảm số lượng hoặc bỏ bớt món.</Notice>}
        </Card>}

        <Card>
          <SectionTitle step={3} title="Người nhận" />
          <Input label="Họ và tên *" placeholder="Nguyễn Văn A" icon="person-outline" autoComplete="name" textContentType="name"
            value={nameValue} onChangeText={setName} error={submitted ? errors.name : undefined} />
          <Input label="Số điện thoại *" placeholder="0912345678" keyboardType="phone-pad" icon="call-outline" autoComplete="tel" textContentType="telephoneNumber"
            maxLength={13} value={phoneValue} onChangeText={setPhone} error={submitted ? errors.phone : undefined}
            hint={type === 'pickup' ? 'Cửa hàng gọi số này khi hàng sẵn sàng.' : 'Shipper gọi số này khi giao.'} />
          <Input label="Ghi chú (không bắt buộc)" placeholder={type === 'pickup' ? 'Ví dụ: nhận sau 18h' : 'Ví dụ: gọi trước khi giao'}
            value={note} onChangeText={setNote} maxLength={200} />
        </Card>

        <Card>
          <SectionTitle icon="pricetag-outline" title="Mã giảm giá" />
          <View style={styles.voucherRow}>
            <View style={{ flex: 1 }}>
              <Input placeholder="Nhập mã" autoCapitalize="characters" value={voucherInput} returnKeyType="done"
                onChangeText={value => { setVoucherInput(value); setVoucherError(''); }} onSubmitEditing={() => applyVoucher()} />
            </View>
            <Button title="Áp dụng" variant="outline" onPress={() => applyVoucher()} disabled={!vouchers.loaded} style={styles.applyButton} />
          </View>
          {!!voucherError && <Text style={styles.error}>{voucherError}</Text>}
          {vouchers.list.length > 0 && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.voucherChips}>
            {vouchers.list.map(item => <Chip key={item.code} icon="ticket-outline" selected={voucherCode === item.code}
              label={item.code + ' · ' + item.description} onPress={() => voucherCode === item.code ? setVoucherCode(null) : applyVoucher(item.code)} />)}
          </ScrollView>}
          {voucherCode && (voucherIssue ? <Notice tone="warning">{voucherIssue}</Notice>
            : <Notice tone="success" action={<Pressable accessibilityRole="button" onPress={() => { setVoucherCode(null); setVoucherInput(''); }}>
              <Text style={styles.link}>Bỏ mã</Text></Pressable>}>{`Đã áp dụng ${voucherCode}${voucher ? ' – ' + voucher.description : ''}`}</Notice>)}
        </Card>

        <Card>
          <SectionTitle icon="bag-check-outline" title={`Sản phẩm (${itemCount})`} />
          {lines.map(item => <View key={item.key} style={styles.line}>
            <ProductPicture product={data?.products.find(product => product.id === item.productId)
              ?? { imageUrl: item.imageUrl, name: item.productName, category: item.productName }} style={styles.thumb} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.itemName} numberOfLines={2}>{item.productName}</Text>
              <Text style={styles.itemMeta}>{item.color}, {item.size}</Text>
              <View style={styles.itemPriceRow}>
                <Price value={item.unitPriceVnd} size={14} />
                <Text style={styles.itemQty}>x{item.quantity}</Text>
              </View>
            </View>
          </View>)}
        </Card>

        <Card>
          <SectionTitle icon="wallet-outline" title="Thanh toán" />
          <View style={styles.cod}>
            <Ionicons name="cash-outline" size={22} color={theme.colors.success} />
            <View style={{ flex: 1 }}>
              <Text style={styles.codTitle}>Thanh toán khi nhận hàng (COD)</Text>
              <Text style={styles.codSub}>{type === 'pickup' ? 'Trả tiền mặt hoặc thẻ tại quầy khi đến lấy hàng.' : 'Trả tiền mặt cho shipper khi nhận hàng.'}</Text>
            </View>
          </View>
          <Row label="Tạm tính" value={formatVnd(quote.subtotal)} />
          {quote.discount > 0 && <Row label={'Giảm giá (' + voucherCode + ')'} value={'−' + formatVnd(quote.discount)} valueColor={theme.colors.success} />}
          <Row label="Phí giao hàng" value={type === 'pickup' || quote.shipping === 0 ? 'Miễn phí' : formatVnd(quote.shipping)}
            valueColor={type === 'pickup' || quote.shipping === 0 ? theme.colors.success : undefined} />
          {quote.freeShipRemaining > 0 && <Text style={styles.hint}>Mua thêm {formatVnd(quote.freeShipRemaining)} để được miễn phí giao hàng.</Text>}
          <Divider />
          <Row label="Tổng thanh toán" value={formatVnd(quote.total)} strong />
          <Text style={styles.hint}>Giá và tồn kho được kiểm tra lại khi đặt hàng.</Text>
        </Card>
        {!!localError && <Notice tone="danger" title="Chưa đặt được hàng">{localError}</Notice>}
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        {!!stockProblem && <Text style={styles.blockText}>{stockProblem}</Text>}
        <View style={styles.bottomRow}>
          <View style={styles.totalBox}>
            <Text style={styles.bottomLabel} numberOfLines={1}>{type === 'pickup' ? (branch ? 'Nhận tại ' + branch.name : 'Nhận tại cửa hàng') : 'Giao tận nơi'}</Text>
            <View style={styles.totalLine}>
              <Text style={styles.totalLabel}>Tổng: </Text>
              <Price value={quote.total} size={19} />
            </View>
          </View>
          <Button title={placing ? 'Đang đặt…' : 'Đặt hàng'} loading={placing}
            disabled={!hasSupabaseConfig || busy || Boolean(stockProblem) || Boolean(previewError)} onPress={() => { void confirmOrder(); }} style={styles.orderButton} />
        </View>
        {!hasSupabaseConfig && <Text style={styles.blockText}>Chế độ demo: đặt hàng cần kết nối Supabase.</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.colors.background },
  center: { alignItems: 'center', justifyContent: 'center' },
  content: { padding: 8, gap: 8 },
  title: { fontSize: 20, fontWeight: '700', color: theme.colors.ink, paddingHorizontal: 6, paddingTop: 4 },
  optionRow: { flexDirection: 'row', gap: 8 },
  option: { flex: 1, padding: 12, gap: 3, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
  optionOn: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primarySoft },
  optionTitle: { fontSize: 14, fontWeight: '600', color: theme.colors.ink, marginTop: 4 },
  optionSub: { fontSize: 11, color: theme.colors.muted },
  branch: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border },
  branchOn: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primarySoft },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: theme.colors.borderStrong, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: theme.colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: theme.colors.primary },
  branchName: { fontSize: 14, fontWeight: '600', color: theme.colors.ink },
  branchAddr: { fontSize: 12, color: theme.colors.muted, lineHeight: 17 },
  missing: { fontSize: 12, color: theme.colors.warning, marginTop: 2 },
  hint: { fontSize: 12, color: theme.colors.muted, lineHeight: 17 },
  voucherRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  applyButton: { minHeight: 50 },
  voucherChips: { gap: 8, paddingRight: 8 },
  error: { color: theme.colors.danger, fontSize: 12 },
  link: { color: theme.colors.primary, fontWeight: '700', fontSize: 13 },
  line: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  thumb: { width: 68, height: 68, borderRadius: theme.radius.md },
  itemName: { fontSize: 13, lineHeight: 18, color: theme.colors.ink },
  itemMeta: { alignSelf: 'flex-start', fontSize: 11, color: theme.colors.muted, backgroundColor: theme.colors.soft, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  itemPriceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  itemQty: { fontSize: 13, color: theme.colors.muted },
  cod: { flexDirection: 'row', gap: 10, padding: 10, borderRadius: theme.radius.md, backgroundColor: theme.colors.successSoft, alignItems: 'center' },
  codTitle: { fontSize: 13, fontWeight: '600', color: theme.colors.ink },
  codSub: { fontSize: 12, color: theme.colors.muted, marginTop: 2 },
  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: theme.colors.surface, paddingHorizontal: 12, paddingTop: 8, gap: 4,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.border, ...theme.shadow.raised },
  bottomRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  totalBox: { flex: 1, alignItems: 'flex-end' },
  totalLine: { flexDirection: 'row', alignItems: 'baseline' },
  totalLabel: { fontSize: 13, color: theme.colors.ink },
  bottomLabel: { fontSize: 11, color: theme.colors.muted },
  orderButton: { minWidth: 120 },
  blockText: { fontSize: 11, color: theme.colors.warning },
});
