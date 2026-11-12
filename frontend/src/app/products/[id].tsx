import { useEffect, useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProductToolbar } from '../../components/navigation/ProductToolbar';
import { CatalogStatus } from '../../components/shop/CatalogStatus';
import { Tag } from '../../components/shop/ProductCard';
import { ProductPicture } from '../../components/shop/ProductPicture';
import { Badge, Stepper } from '../../components/ui/primitives';
import { Price } from '../../components/ui/Price';
import { Text } from '../../components/ui/Text';
import { cartErrorMessage, useCart } from '../../context/CartContext';
import { useRecentView } from '../../context/RecentViewContext';
import { swatchColor, swatchNeedsBorder } from '../../data/colors';
import { discountPercent } from '../../data/home-sections';
import { useCatalog } from '../../features/catalog/useCatalog';
import { notify } from '../../lib/feedback';
import { hasSupabaseConfig } from '../../lib/supabase';
import { browseTarget, firstParam, loginTarget, productTarget, routeContext, type AppTarget, type RouteParams } from '../../navigation/routes';
import { variantPurchaseLimit } from '../../services/product-purchase';
import { theme } from '../../theme/theme';

function Option({ label, selected, available, onPress, disabled, color }: {
  label: string; selected: boolean; available: boolean; onPress: () => void; disabled?: boolean; color?: string;
}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label + (available ? '' : ', hết hàng')}
    accessibilityState={{ selected, disabled }} disabled={disabled} onPress={onPress}
    style={[styles.option, selected && styles.optionOn, !available && !selected && styles.optionOff]}>
    {color && <View style={[styles.optionDot, { backgroundColor: color }, swatchNeedsBorder(color) && styles.dotBorder]} />}
    <Text style={[styles.optionText, selected && styles.optionTextOn, !available && !selected && styles.optionTextOff]}>{label}</Text>
  </Pressable>;
}

export default function ProductDetailScreen() {
  const params = useLocalSearchParams();
  const id = firstParam(params.id);
  return <ProductDetailContent key={id} id={id} params={params} />;
}
function ProductDetailContent({ id, params }: { id: string; params: RouteParams }) {
  const catalog = useCatalog();
  const { data, loading, error, retry } = catalog;
  const { addItem, items, count, loading: cartLoading, userId } = useCart();
  const { addRecentItem } = useRecentView();
  const insets = useSafeAreaInsets();
  const product = data?.products.find(item => item.id === id);
  const [skuId, setSkuId] = useState(firstParam(params.variantId));
  const requestedQuantity = Number(firstParam(params.quantity));
  const [quantity, setQuantity] = useState(Number.isInteger(requestedQuantity) && requestedQuantity >= 1 && requestedQuantity <= 10 ? requestedQuantity : 1);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [showStores, setShowStores] = useState(false);

  useEffect(() => {
    if (product) addRecentItem(product);
  }, [product, addRecentItem]);

  const variant = product?.variants.find(item => item.id === skuId) ?? product?.variants[0];
  const size = variant?.size ?? '', color = variant?.color ?? '';
  const sizes = [...new Set(product?.variants.map(item => item.size) ?? [])];
  const colors = [...new Set(product?.variants.map(item => item.color) ?? [])];
  const limitOf = (variantId: string) => data ? variantPurchaseLimit(data, variantId) : 0;
  const sizeAvailable = (value: string) => product?.variants.some(item => item.size === value && item.color === color && limitOf(item.id) > 0)
    ?? false;
  const colorAvailable = (value: string) => product?.variants.some(item => item.color === value && limitOf(item.id) > 0) ?? false;
  const limit = variant ? limitOf(variant.id) : 0;
  const inCart = items.find(item => item.skuId === variant?.id)?.quantity ?? 0;
  const addRemaining = Math.max(0, limit - inCart);
  const effectiveQuantity = Math.min(quantity, Math.max(1, limit));
  const busy = adding || cartLoading;
  const discount = product ? discountPercent(product) : 0;
  const storeStock = data && variant ? data.branches.map(branch => ({ branch,
    quantity: Math.max(0, data.stock.find(row => row.skuId === variant.id && row.branchId === branch.id)?.quantity ?? 0) })) : [];
  const storesWithStock = storeStock.filter(row => row.quantity > 0).length;
  const canAdd = !busy && Boolean(variant) && limit > 0 && effectiveQuantity <= addRemaining;
  const canBuy = !busy && Boolean(variant) && limit > 0;

  function choose(nextColor: string, nextSize: string) {
    if (!product) return;
    const next = product.variants.find(item => item.color === nextColor && item.size === nextSize)
      ?? product.variants.find(item => item.color === nextColor) ?? product.variants.find(item => item.size === nextSize);
    if (next) { setSkuId(next.id); setQuantity(1); setAdded(false); }
  }
  async function add() {
    if (!product || !variant || !canAdd) return;
    if (hasSupabaseConfig && !userId) {
      router.push(loginTarget(productTarget(id, { ...routeContext(params), variantId: variant.id, quantity: String(effectiveQuantity) })) as never);
      return;
    }
    setAdding(true); setAdded(false);
    try {
      await addItem({ productId: product.id, productName: product.name, skuId: variant.id, skuCode: variant.sku,
        size: variant.size, color: variant.color, unitPriceVnd: product.priceVnd, imageUrl: product.imageUrl }, effectiveQuantity);
      setAdded(true);
    } catch (e) { notify('Chưa thêm được sản phẩm', cartErrorMessage(e)); }
    finally { setAdding(false); }
  }
  function buy() {
    if (!product || !variant || !canBuy) return;
    const destination: AppTarget = { pathname: '/checkout', params: { ...routeContext(params), mode: 'buy-now',
      productId: product.id, variantId: variant.id, quantity: String(effectiveQuantity) } };
    router.push((hasSupabaseConfig && !userId ? loginTarget(destination) : destination) as never);
  }
  return <View style={styles.screen}>
    <Stack.Screen options={{ header: () => <ProductToolbar product={product} /> }} />
    {loading || error || !data ? <CatalogStatus loading={loading} error={error} retry={retry} />
      : !product ? <View style={styles.missing}>
        <Ionicons name="search-outline" size={48} color={theme.colors.subtle} />
        <Text style={styles.name}>Sản phẩm không còn bán</Text>
        <Pressable accessibilityRole="button" onPress={() => router.dismissTo(browseTarget(params) as never)}><Text style={styles.link}>Xem sản phẩm khác</Text></Pressable>
      </View> : <>
        <ScrollView contentContainerStyle={styles.content}>
          <ProductPicture product={product} style={styles.picture} />

          <View style={[styles.block, styles.priceBlock]}>
            <View style={styles.priceRow}>
              <Price value={product.priceVnd} size={26} />
              {discount > 0 && <Price value={product.basePriceVnd!} size={13} weight="500" color={theme.colors.subtle} strike />}
              {discount > 0 && <Tag label={'-' + discount + '%'} />}
            </View>
            <Text accessibilityRole="header" style={styles.name}>{product.name}</Text>
            <View style={styles.tagRow}>
              <Tag tone="success" label={limit > 0 ? 'Còn hàng tại ' + storesWithStock + ' cửa hàng' : 'Tạm hết hàng'} />
              <Tag tone="neutral" label="Trả tiền khi nhận" />
              <Tag tone="neutral" label="Freeship đơn >500K" />
            </View>
          </View>

          <View style={styles.block}>
            <View style={styles.blockHeader}>
              <Text style={styles.blockTitle}>Phân loại</Text>
              <Text style={styles.selectedText}>Đã chọn: {color} · {size}</Text>
            </View>
            <Text style={styles.label}>Màu sắc</Text>
            <View style={styles.options}>{colors.map(value => <Option key={value} label={value} color={swatchColor(value)}
              selected={color === value} available={colorAvailable(value)} disabled={busy} onPress={() => choose(value, size)} />)}</View>
            <Text style={styles.label}>Kích thước</Text>
            <View style={styles.options}>{sizes.map(value => <Option key={value} label={value}
              selected={size === value} available={sizeAvailable(value)} disabled={busy} onPress={() => choose(color, value)} />)}</View>
            <View style={styles.quantityRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Số lượng</Text>
                <Text style={styles.meta}>{limit > 0 ? 'Tối đa ' + limit + (inCart ? ' · giỏ đã có ' + inCart : '') : 'Phiên bản này đã hết hàng'}</Text>
              </View>
              <Stepper value={effectiveQuantity} max={Math.max(1, limit)} disabled={busy || limit <= 0} onChange={value => { setQuantity(value); setAdded(false); }} />
            </View>
          </View>

          <View style={styles.block}>
            <Pressable accessibilityRole="button" accessibilityState={{ expanded: showStores }} onPress={() => setShowStores(value => !value)} style={styles.stockHeader}>
              <Ionicons name="storefront-outline" size={20} color={theme.colors.ink} />
              <View style={{ flex: 1 }}>
                <Text style={styles.blockTitle}>Tồn kho tại cửa hàng</Text>
                <Text style={styles.meta}>Nhận tại cửa hàng miễn phí, giữ hàng 3 ngày</Text>
              </View>
              <Text style={styles.storeCount}>{storesWithStock}/{storeStock.length}</Text>
              <Ionicons name={showStores ? 'chevron-up' : 'chevron-down'} size={18} color={theme.colors.muted} />
            </Pressable>
            {showStores && storeStock.map(({ branch, quantity: amount }) => <View key={branch.id} style={styles.storeRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.storeName}>{branch.name}</Text>
                {!!branch.address && <Text style={styles.meta} numberOfLines={1}>{branch.address}</Text>}
              </View>
              <Badge label={amount > 0 ? 'Còn ' + amount : 'Hết hàng'} tone={amount > 0 ? (amount < 3 ? 'warning' : 'success') : 'danger'} />
            </View>)}
          </View>

          {!!product.description && <View style={styles.block}>
            <Text style={styles.blockTitle}>Mô tả sản phẩm</Text>
            <Text style={styles.description}>{product.description}</Text>
            {!!variant && <Text style={styles.meta}>Mã SKU: {variant.sku}</Text>}
          </View>}
          {data.source === 'mock' && <Text style={styles.mock}>Đang xem dữ liệu mẫu (chưa kết nối Supabase).</Text>}
        </ScrollView>
        <View style={[styles.actions, { paddingBottom: Math.max(insets.bottom, 8) }]}>
          {added && <View accessibilityLiveRegion="polite" style={styles.added}>
            <Ionicons name="checkmark-circle" size={16} color="#fff" />
            <Text style={styles.addedText}>Đã thêm vào giỏ hàng</Text>
            <Pressable accessibilityRole="button" onPress={() => router.navigate('/cart')} hitSlop={8}><Text style={styles.addedLink}>Xem giỏ ›</Text></Pressable>
          </View>}
          <View style={styles.actionRow}>
            <Pressable accessibilityRole="button" accessibilityLabel={'Giỏ hàng, ' + count + ' sản phẩm'} onPress={() => router.navigate('/cart')} style={styles.iconAction}>
              <Ionicons name="bag-handle-outline" size={22} color={theme.colors.ink} />
              <Text style={styles.iconLabel}>Giỏ hàng</Text>
              {count > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{count > 99 ? '99+' : count}</Text></View>}
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Hỏi trợ lý" onPress={() => router.push({ pathname: '/chatbot', params: { productId: product.id } })} style={styles.iconAction}>
              <Ionicons name="chatbubble-ellipses-outline" size={22} color={theme.colors.ink} />
              <Text style={styles.iconLabel}>Tư vấn</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Thêm vào giỏ hàng" disabled={!canAdd} accessibilityState={{ disabled: !canAdd }}
              onPress={add} style={({ pressed }) => [styles.action, styles.addAction, !canAdd && styles.disabled, pressed && styles.pressed]}>
              {adding ? <ActivityIndicator color={theme.colors.primary} /> : <Text style={styles.addText}>Thêm vào giỏ</Text>}
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Mua ngay" disabled={!canBuy} accessibilityState={{ disabled: !canBuy }}
              onPress={buy} style={({ pressed }) => [styles.action, styles.buyAction, !canBuy && styles.disabled, pressed && { backgroundColor: theme.colors.primaryPressed }]}>
              <Text style={styles.buyText}>{limit > 0 ? 'Mua ngay' : 'Hết hàng'}</Text>
            </Pressable>
          </View>
        </View>
      </>}
  </View>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background }, content: { paddingBottom: 16, gap: 8 },
  missing: { padding: 32, gap: 14, alignItems: 'center' }, link: { color: theme.colors.primary, fontWeight: '600', fontSize: 14 },
  picture: { width: '100%', aspectRatio: 1 },
  block: { backgroundColor: theme.colors.surface, padding: 14, gap: 10 },
  priceBlock: { marginTop: -8, gap: 8 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', columnGap: 8, rowGap: 4 },
  name: { fontSize: 16, lineHeight: 23, fontWeight: '600', color: theme.colors.ink },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  blockHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  blockTitle: { fontSize: 15, fontWeight: '700', color: theme.colors.ink },
  selectedText: { fontSize: 12, color: theme.colors.muted, flexShrink: 1, textAlign: 'right' },
  label: { fontSize: 13, fontWeight: '600', color: theme.colors.text },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: { minHeight: 36, minWidth: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 12,
    borderRadius: theme.radius.sm, borderWidth: 1, borderColor: theme.colors.soft, backgroundColor: theme.colors.soft },
  optionOn: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primarySoft },
  optionOff: { opacity: 0.55, borderStyle: 'dashed', borderColor: theme.colors.borderStrong, backgroundColor: theme.colors.surface },
  optionDot: { width: 14, height: 14, borderRadius: 7 },
  dotBorder: { borderWidth: 1, borderColor: theme.colors.borderStrong },
  optionText: { fontSize: 13, color: theme.colors.ink },
  optionTextOn: { color: theme.colors.primary, fontWeight: '600' },
  optionTextOff: { color: theme.colors.subtle, textDecorationLine: 'line-through' },
  quantityRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: theme.colors.soft },
  meta: { color: theme.colors.muted, fontSize: 12, lineHeight: 17, marginTop: 2 },
  stockHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 40 },
  storeCount: { fontSize: 13, fontWeight: '700', color: theme.colors.success },
  storeRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: theme.colors.soft },
  storeName: { fontSize: 14, fontWeight: '600', color: theme.colors.ink },
  description: { color: theme.colors.text, fontSize: 14, lineHeight: 22 },
  mock: { textAlign: 'center', color: theme.colors.warning, fontSize: 12, padding: 8 },
  actions: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.border, paddingHorizontal: 10, paddingTop: 8,
    backgroundColor: theme.colors.surface, gap: 8 },
  added: { position: 'absolute', left: 12, right: 12, top: -46, flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(22,24,35,0.88)', paddingHorizontal: 12, height: 38, borderRadius: theme.radius.md },
  addedText: { flex: 1, color: '#fff', fontWeight: '500', fontSize: 13 },
  addedLink: { color: '#fff', fontWeight: '700', fontSize: 13 },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconAction: { width: 50, alignItems: 'center', gap: 1 },
  iconLabel: { fontSize: 10, color: theme.colors.text },
  badge: { position: 'absolute', right: 4, top: -4, minWidth: 16, height: 16, paddingHorizontal: 3, borderRadius: 8, backgroundColor: theme.colors.primary,
    alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },
  action: { flex: 1, height: 46, borderRadius: theme.radius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  addAction: { backgroundColor: theme.colors.primarySoft }, buyAction: { backgroundColor: theme.colors.primary },
  addText: { color: theme.colors.primary, fontSize: 14, fontWeight: '700' }, buyText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  disabled: { opacity: 0.4 }, pressed: { opacity: 0.8 },
});
