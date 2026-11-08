import { useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProductToolbar } from '../../components/navigation/ProductToolbar';
import { CatalogStatus } from '../../components/shop/CatalogStatus';
import { cartErrorMessage, useCart } from '../../context/CartContext';
import { discountPercent } from '../../data/home-sections';
import { useCatalog } from '../../features/catalog/useCatalog';
import { hasSupabaseConfig } from '../../lib/supabase';
import { browseTarget, firstParam, loginTarget, productTarget, routeContext, type AppTarget, type RouteParams } from '../../navigation/routes';
import { variantPurchaseLimit } from '../../services/product-purchase';
import { theme } from '../../theme/theme';
import { formatVnd } from '../../types/shop';

function HeroImage({ uri }: { uri?: string }) {
  const [failed, setFailed] = useState(false);
  return uri && !failed ? <Image source={{ uri }} contentFit="contain" style={styles.image} onError={() => setFailed(true)} />
    : <View style={styles.imageFallback}><Ionicons name="shirt-outline" size={72} color={theme.colors.muted} /><Text style={styles.muted}>Chưa có ảnh sản phẩm</Text></View>;
}
export default function ProductDetailScreen() {
  const params = useLocalSearchParams();
  const id = firstParam(params.id);
  return <ProductDetailContent key={id} id={id} params={params} />;
}
function ProductDetailContent({ id, params }: { id: string; params: RouteParams }) {
  const catalog = useCatalog();
  const { data, loading, error, retry } = catalog;
  const { addItem, items, loading: cartLoading, userId } = useCart();
  const insets = useSafeAreaInsets();
  const product = data?.products.find(item => item.id === id);
  const [skuId, setSkuId] = useState(firstParam(params.variantId));
  const requestedQuantity = Number(firstParam(params.quantity));
  const [quantity, setQuantity] = useState(Number.isInteger(requestedQuantity) && requestedQuantity >= 1 && requestedQuantity <= 10 ? requestedQuantity : 1);
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useState('');
  const variant = product?.variants.find(item => item.id === skuId) ?? product?.variants[0];
  const size = variant?.size ?? '', color = variant?.color ?? '';
  const sizes = [...new Set(product?.variants.map(item => item.size) ?? [])];
  const colors = [...new Set(product?.variants.filter(item => item.size === size).map(item => item.color) ?? [])];
  const limit = data && variant ? variantPurchaseLimit(data, variant.id) : 0;
  const inCart = items.find(item => item.skuId === variant?.id)?.quantity ?? 0;
  const addRemaining = Math.max(0, limit - inCart);
  const effectiveQuantity = Math.min(quantity, Math.max(1, limit));
  const busy = adding || cartLoading;
  const discount = product ? discountPercent(product) : 0;
  function chooseVariant(nextId: string) { setSkuId(nextId); setQuantity(1); setNotice(''); }
  async function add() {
    if (!product || !variant || busy || effectiveQuantity > addRemaining) return;
    if (hasSupabaseConfig && !userId) {
      router.push(loginTarget(productTarget(id, { ...routeContext(params), variantId: variant.id, quantity: String(effectiveQuantity) })));
      return;
    }
    setAdding(true); setNotice('');
    try {
      await addItem({ productId: product.id, productName: product.name, skuId: variant.id, skuCode: variant.sku,
        size: variant.size, color: variant.color, unitPriceVnd: product.priceVnd, imageUrl: product.imageUrl }, effectiveQuantity);
      setNotice('Đã thêm sản phẩm vào giỏ hàng.');
    } catch (e) { Alert.alert('Chưa thêm được sản phẩm', cartErrorMessage(e)); }
    finally { setAdding(false); }
  }
  function buy() {
    if (!product || !variant || busy || limit <= 0) return;
    const destination: AppTarget = { pathname: '/checkout', params: { ...routeContext(params), mode: 'buy-now',
      productId: product.id, variantId: variant.id, quantity: String(effectiveQuantity) } };
    router.push(hasSupabaseConfig && !userId ? loginTarget(destination) : destination);
  }
  return <View style={styles.screen}>
    <Stack.Screen options={{ header: () => <ProductToolbar product={product} /> }} />
    {loading || error || !data ? <CatalogStatus loading={loading} error={error} retry={retry} />
      : !product ? <View style={styles.missing}>
        <Text style={styles.name}>Sản phẩm không còn bán</Text>
        <Pressable accessibilityRole="button" onPress={() => router.dismissTo(browseTarget(params))}><Text style={styles.link}>Xem sản phẩm khác</Text></Pressable>
      </View> : <>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.picture}><HeroImage key={product.imageUrl ?? product.id} uri={product.imageUrl} /></View>
          <Text style={styles.category}>{product.category.toLocaleUpperCase('vi')}</Text>
          <Text accessibilityRole="header" style={styles.name}>{product.name}</Text>
          <View style={styles.priceRow}><Text style={styles.price}>{formatVnd(product.priceVnd)}</Text>
            {product.basePriceVnd != null && product.basePriceVnd > product.priceVnd && <Text style={styles.originalPrice}>{formatVnd(product.basePriceVnd)}</Text>}
            {discount > 0 && <Text style={styles.discount}>−{discount}%</Text>}
          </View>
          <Text style={styles.description}>{product.description}</Text>
          <Text style={styles.label}>Kích thước</Text>
          <View style={styles.choices}>{sizes.map(value => <Pressable key={value} accessibilityRole="button" accessibilityLabel={'Size ' + value}
            accessibilityState={{ selected: size === value, disabled: busy }} disabled={busy}
            onPress={() => { const next = product.variants.find(item => item.size === value && item.color === color) ?? product.variants.find(item => item.size === value); if (next) chooseVariant(next.id); }}
            style={[styles.choice, size === value && styles.selected]}><Text style={[styles.choiceText, size === value && styles.selectedText]}>{value}</Text></Pressable>)}</View>
          <Text style={styles.label}>Màu sắc</Text>
          <View style={styles.choices}>{colors.map(value => <Pressable key={value} accessibilityRole="button" accessibilityLabel={'Màu ' + value}
            accessibilityState={{ selected: color === value, disabled: busy }} disabled={busy}
            onPress={() => { const next = product.variants.find(item => item.size === size && item.color === value); if (next) chooseVariant(next.id); }}
            style={[styles.choice, color === value && styles.selected]}><Text style={[styles.choiceText, color === value && styles.selectedText]}>{value}</Text></Pressable>)}</View>
          <Text style={[styles.stock, limit === 0 && styles.outStock]}>{limit > 0 ? 'Còn hàng · Tối đa ' + limit + ' sản phẩm mỗi lần mua' : 'Phiên bản này hiện đã hết hàng'}</Text>
          <Text style={styles.muted}>Chọn cửa hàng nhận hàng tại giỏ hàng hoặc bước đặt hàng.</Text>
          {inCart > 0 && <Text style={styles.muted}>Giỏ đã có {inCart} sản phẩm cùng SKU · Có thể thêm {addRemaining}.</Text>}
          <Text style={styles.meta}>SKU: {variant?.sku ?? 'Chưa có phiên bản'}</Text>
          <View style={styles.quantityRow}><Text style={styles.label}>Số lượng</Text><View style={styles.counter}>
            <Pressable accessibilityRole="button" accessibilityLabel="Giảm số lượng" disabled={busy || effectiveQuantity <= 1}
              onPress={() => setQuantity(Math.max(1, effectiveQuantity - 1))} style={styles.counterButton}><Text style={styles.counterText}>−</Text></Pressable>
            <Text style={styles.quantity}>{effectiveQuantity}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Tăng số lượng" disabled={busy || effectiveQuantity >= limit}
              onPress={() => setQuantity(Math.min(limit, effectiveQuantity + 1))} style={styles.counterButton}><Text style={styles.counterText}>+</Text></Pressable>
          </View></View>
          {data.source === 'mock' && <Text style={styles.muted}>Đang xem dữ liệu mẫu.</Text>}
        </ScrollView>
        <View style={[styles.actions, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          {!!notice && <Text accessibilityLiveRegion="polite" style={styles.notice}>{notice}</Text>}
          <View style={styles.actionRow}>
            <Pressable accessibilityRole="button" accessibilityLabel="Thêm vào giỏ hàng" disabled={busy || !variant || limit <= 0 || effectiveQuantity > addRemaining}
              accessibilityState={{ disabled: busy || !variant || limit <= 0 || effectiveQuantity > addRemaining }}
              onPress={add} style={[styles.action, styles.addAction, (busy || !variant || limit <= 0 || effectiveQuantity > addRemaining) && styles.disabled]}>
              {adding ? <ActivityIndicator color={theme.colors.ink} /> : <Ionicons name="bag-add-outline" size={22} color={theme.colors.ink} />}
              <Text style={styles.addText}>Thêm vào giỏ hàng</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Mua hàng" disabled={busy || !variant || limit <= 0}
              accessibilityState={{ disabled: busy || !variant || limit <= 0 }} onPress={buy}
              style={[styles.action, styles.buyAction, (busy || !variant || limit <= 0) && styles.disabled]}>
              <Ionicons name="bag-check-outline" size={22} color="#fff" /><Text style={styles.buyText}>Mua hàng</Text>
            </Pressable>
          </View>
        </View>
      </>}
  </View>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background }, content: { padding: 18, paddingBottom: 28 },
  missing: { padding: 24, gap: 20 }, link: { color: theme.colors.primary, paddingVertical: 16, fontWeight: '700' },
  picture: { aspectRatio: 1, backgroundColor: '#F1F0ED', borderRadius: 12, overflow: 'hidden' }, image: { width: '100%', height: '100%' },
  imageFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  category: { fontSize: 11, color: theme.colors.muted, marginTop: 18, letterSpacing: 1 },
  name: { fontSize: 24, fontWeight: '800', color: theme.colors.ink, marginTop: 6 },
  priceRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginTop: 8 },
  price: { color: theme.colors.primary, fontSize: 23, fontWeight: '800' }, originalPrice: { color: theme.colors.muted, textDecorationLine: 'line-through' },
  discount: { color: theme.colors.primary, fontWeight: '700' }, description: { color: theme.colors.muted, fontSize: 14, lineHeight: 22, marginTop: 14 },
  label: { fontWeight: '700', color: theme.colors.ink, fontSize: 14, marginTop: 16, marginBottom: 10 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, choice: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 14, paddingVertical: 11, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8, backgroundColor: '#fff' },
  selected: { backgroundColor: theme.colors.ink, borderColor: theme.colors.ink }, choiceText: { fontSize: 13, fontWeight: '600', color: theme.colors.ink }, selectedText: { color: '#fff' },
  stock: { marginTop: 20, color: theme.colors.success, fontWeight: '600' }, outStock: { color: theme.colors.danger }, muted: { color: theme.colors.muted, lineHeight: 21, marginTop: 8 }, meta: { color: theme.colors.muted, fontSize: 11, marginTop: 6 },
  quantityRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }, counter: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8, backgroundColor: '#fff' },
  counterButton: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' }, counterText: { fontSize: 22, color: theme.colors.ink }, quantity: { minWidth: 32, textAlign: 'center', fontWeight: '700' },
  actions: { borderTopWidth: 1, borderTopColor: theme.colors.border, paddingHorizontal: 16, paddingTop: 12, backgroundColor: theme.colors.surface }, notice: { color: theme.colors.success, marginBottom: 10, fontSize: 12 },
  actionRow: { flexDirection: 'row', gap: 12 }, action: { flex: 1, minHeight: 58, borderRadius: 8, alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 5, paddingVertical: 9 },
  addAction: { borderWidth: 1, borderColor: theme.colors.ink }, buyAction: { backgroundColor: theme.colors.primary }, addText: { color: theme.colors.ink, fontSize: 12, fontWeight: '700', textAlign: 'center' }, buyText: { color: '#fff', fontSize: 13, fontWeight: '700' }, disabled: { opacity: 0.4 },
});
