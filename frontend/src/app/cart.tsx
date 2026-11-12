import { useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../components/ui/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DestinationState } from '../components/navigation/DestinationState';
import { Button } from '../components/shop/Button';
import { ProductPicture } from '../components/shop/ProductPicture';
import { Card, Checkbox, Chip, Notice, SectionTitle, Stepper } from '../components/ui/primitives';
import { Price } from '../components/ui/Price';
import { swatchColor } from '../data/colors';
import { cartErrorMessage, useCart } from '../context/CartContext';
import { useCatalog } from '../features/catalog/useCatalog';
import { confirmAction, notify } from '../lib/feedback';
import { hasSupabaseConfig } from '../lib/supabase';
import { loginTarget, productTarget } from '../navigation/routes';
import { lineLimit } from '../services/cart-adapter';
import { checkBranches } from '../services/checkout';
import { theme } from '../theme/theme';

export default function CartScreen() {
  const {
    items, count, selectedKeys, selectedItems, selectedCount, selectedTotalVnd, loading, error, userId, branches, branchId,
    updateQuantity, removeItem, removeItems, clearCart, refresh, selectBranch, toggleSelectItem, toggleSelectAll,
  } = useCart();
  const catalog = useCatalog();
  const insets = useSafeAreaInsets();
  const [editing, setEditing] = useState(false);

  const perform = (action: () => Promise<void>) => {
    void action().catch(e => notify('Không thể cập nhật giỏ hàng', cartErrorMessage(e)));
  };
  const allSelected = items.length > 0 && selectedKeys.length === items.length;
  const currentBranch = branches.find(b => b.id === branchId);
  const unavailable = selectedItems.filter(item => !item.productId || item.quantity > lineLimit(item));
  const shortHere = selectedItems.filter(item => item.quantity > item.maxAvailable);
  const fullBranches = catalog.data && shortHere.length
    ? checkBranches(catalog.data, selectedItems.map(item => ({ skuId: item.skuId, skuCode: item.skuCode, quantity: item.quantity })))
      .filter(check => check.canFulfill && check.branchId !== branchId)
      .map(check => branches.find(branch => branch.id === check.branchId)).filter(branch => branch != null)
    : [];
  // Demo mode may preview checkout; the final "Đặt hàng" there stays disabled without Supabase.
  const canCheckout = !loading && !error && selectedCount > 0 && unavailable.length === 0;

  async function removeSelected() {
    if (!selectedKeys.length) return;
    if (await confirmAction('Xóa sản phẩm', `Xóa ${selectedKeys.length} sản phẩm đã chọn khỏi giỏ hàng?`, 'Xóa', true)) {
      perform(() => removeItems([...selectedKeys]));
    }
  }
  async function removeAll() {
    if (await confirmAction('Xóa toàn bộ giỏ hàng', 'Bạn có chắc muốn xóa tất cả sản phẩm khỏi giỏ hàng?', 'Xóa hết', true)) {
      perform(clearCart);
      setEditing(false);
    }
  }

  if (hasSupabaseConfig && !userId && !loading) {
    return <ScrollView style={styles.page} contentContainerStyle={styles.centered}>
      <DestinationState icon="bag-handle-outline" title="Giỏ hàng của bạn"
        description="Đăng nhập để lưu giỏ hàng trên tài khoản và đặt hàng nhận tại cửa hàng hoặc giao tận nơi."
        actionLabel="Đăng nhập" onAction={() => router.push(loginTarget({ pathname: '/cart' }) as never)} />
    </ScrollView>;
  }

  return (
    <View style={styles.page}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: items.length ? 120 + insets.bottom : 32 }]}>
        <View style={styles.topHeader}>
          <View style={{ flex: 1 }}>
            <Text accessibilityRole="header" style={styles.title}>Giỏ hàng</Text>
            <Text style={styles.subTitle}>{count} sản phẩm{selectedCount ? ' · đã chọn ' + selectedCount : ''}</Text>
          </View>
          {items.length > 0 && <Button size="sm" variant="secondary" title={editing ? 'Xong' : 'Sửa'} icon={editing ? 'checkmark' : 'create-outline'}
            onPress={() => setEditing(value => !value)} />}
        </View>

        {!hasSupabaseConfig && <Notice tone="warning">Chế độ demo: giỏ hàng chỉ lưu trong phiên này. Đặt hàng thật cần kết nối Supabase.</Notice>}
        {loading && !items.length && <ActivityIndicator accessibilityLabel="Đang tải giỏ hàng" color={theme.colors.primary} style={{ marginVertical: 24 }} />}
        {error && <Notice tone="danger" title="Chưa đồng bộ được giỏ hàng" action={<Button size="sm" variant="danger" title="Tải lại" disabled={loading} onPress={() => perform(refresh)} />}>
          {error}
        </Notice>}

        {!loading && !error && !items.length && <DestinationState icon="bag-outline" title="Giỏ hàng đang trống"
          description="Khám phá các thiết kế tối giản và thêm món bạn thích vào giỏ nhé."
          actionLabel="Khám phá sản phẩm" onAction={() => router.push('/products')} />}

        {!!items.length && <>
          <Card>
            <SectionTitle icon="storefront-outline" title="Cửa hàng nhận hàng" right={loading ? <ActivityIndicator size="small" color={theme.colors.muted} /> : null} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.branchRow}>
              {branches.map(branch => <Chip key={branch.id} label={branch.name} selected={branch.id === branchId}
                icon={branch.id === branchId ? 'checkmark' : undefined} disabled={loading} onPress={() => perform(() => selectBranch(branch.id))} />)}
            </ScrollView>
            {!!currentBranch?.address && <Text style={styles.note}>{currentBranch.address}</Text>}
            {selectedItems.length > 0 && (shortHere.length === 0
              ? <Notice tone="success">Cửa hàng này đủ hàng cho các món đã chọn.</Notice>
              : <Notice tone="warning" title={`${shortHere.length} món không đủ hàng tại ${currentBranch?.name ?? 'cửa hàng này'}`}
                action={fullBranches.length ? <View style={styles.suggestions}>
                  {fullBranches.map(branch => <Button key={branch.id} size="sm" variant="outline" icon="swap-horizontal"
                    title={'Đổi sang ' + branch.name} onPress={() => perform(() => selectBranch(branch.id))} />)}
                </View> : undefined}>
                {fullBranches.length ? 'Các cửa hàng dưới đây có đủ tất cả món đã chọn:' : 'Bạn vẫn có thể chọn giao hàng tận nơi ở bước đặt hàng, hoặc giảm số lượng.'}
              </Notice>)}
          </Card>

          <View style={styles.selectRow}>
            <Checkbox checked={allSelected} label="Chọn tất cả sản phẩm" onPress={() => toggleSelectAll()} />
            <Text style={styles.selectLabel}>Chọn tất cả ({selectedKeys.length}/{items.length})</Text>
          </View>

          {items.map(item => {
            const selected = selectedKeys.includes(item.key);
            const limit = lineLimit(item);
            const gone = !item.productId || limit === 0;
            const short = !gone && item.quantity > item.maxAvailable;
            return (
              <Card key={item.key} style={[styles.itemCard, !selected && styles.itemUnselected]}>
                <View style={styles.itemRow}>
                  <Checkbox checked={selected} label={'Chọn ' + item.productName} onPress={() => toggleSelectItem(item.key)} />
                  <Pressable accessibilityRole="button" accessibilityLabel={'Xem ' + item.productName} disabled={!item.productId}
                    onPress={() => router.push(productTarget(item.productId, { origin: 'cart', variantId: item.skuId }) as never)}>
                    <ProductPicture product={catalog.data?.products.find(product => product.id === item.productId)
                      ?? { imageUrl: item.imageUrl, name: item.productName, category: item.productName }} style={styles.image} />
                  </Pressable>
                  <View style={styles.details}>
                    <View style={styles.itemTitleRow}>
                      <Text style={styles.name} numberOfLines={2}>{item.productName}</Text>
                      <Pressable accessibilityRole="button" accessibilityLabel={'Xóa ' + item.productName} hitSlop={10} disabled={loading}
                        onPress={() => perform(() => removeItem(item.key))} style={styles.deleteButton}>
                        <Ionicons name="trash-outline" size={17} color={theme.colors.subtle} />
                      </Pressable>
                    </View>
                    <View style={styles.variantPill}>
                      <View style={[styles.dot, { backgroundColor: swatchColor(item.color) }]} />
                      <Text style={styles.variant}>{item.color}, {item.size}</Text>
                    </View>
                    <View style={styles.priceStepRow}>
                      <Price value={item.unitPriceVnd} size={15} />
                      {gone ? <Text style={styles.goneText}>Hết hàng</Text>
                        : <Stepper value={item.quantity} max={Math.max(item.quantity, limit)} disabled={loading} label={'số lượng ' + item.productName}
                          onChange={value => perform(() => updateQuantity(item.key, value))} />}
                    </View>
                  </View>
                </View>
                {short && <Text style={styles.shortText}>
                  <Ionicons name="warning-outline" size={13} color={theme.colors.warning} /> {currentBranch?.name ?? 'Cửa hàng'} chỉ còn {item.maxAvailable} sản phẩm
                </Text>}
                {!short && !gone && item.quantity >= limit && <Text style={styles.limitText}>Đã đạt số lượng tối đa có thể mua ({limit}).</Text>}
              </Card>
            );
          })}
        </>}
      </ScrollView>

      {!!items.length && (
        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
          {editing ? <View style={styles.bottomRow}>
            <Button variant="secondary" title="Xóa tất cả" icon="trash-outline" disabled={loading} onPress={() => { void removeAll(); }} style={{ flex: 1 }} />
            <Button variant="danger" title={`Xóa đã chọn (${selectedKeys.length})`} disabled={loading || selectedKeys.length === 0}
              onPress={() => { void removeSelected(); }} style={{ flex: 1 }} />
          </View> : <View style={styles.bottomRow}>
            <Checkbox checked={allSelected} label="Chọn tất cả sản phẩm" onPress={() => toggleSelectAll()} />
            <Text style={styles.allLabel}>Tất cả</Text>
            <View style={styles.totalBox}>
              <Text style={styles.bottomLabel}>Tổng cộng</Text>
              <Price value={selectedTotalVnd} size={18} />
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={'Thanh toán ' + selectedCount + ' sản phẩm'} disabled={!canCheckout}
              onPress={() => router.push('/checkout')} style={({ pressed }) => [styles.buyButton, !canCheckout && styles.buyDisabled,
                pressed && { backgroundColor: theme.colors.primaryPressed }]}>
              <Text style={styles.buyText}>Thanh toán ({selectedCount})</Text>
            </Pressable>
          </View>}
          {!editing && unavailable.length > 0 && <Text style={styles.blockText}>Bỏ chọn hoặc sửa {unavailable.length} món hết hàng để đặt.</Text>}
          {!editing && !selectedCount && <Text style={styles.blockText}>Chọn ít nhất một sản phẩm để đặt hàng.</Text>}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.colors.background },
  centered: { flexGrow: 1, justifyContent: 'center' },
  content: { padding: 8, gap: 8 },
  topHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 6, paddingTop: 4 },
  title: { fontSize: 20, fontWeight: '700', color: theme.colors.ink },
  subTitle: { fontSize: 12, color: theme.colors.muted, marginTop: 2 },
  note: { fontSize: 12, color: theme.colors.muted, lineHeight: 17 },
  branchRow: { gap: 8, paddingRight: 8 },
  suggestions: { gap: 8, alignItems: 'flex-start' },
  selectRow: { flexDirection: 'row', alignItems: 'center', gap: 0, backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, paddingRight: 12 },
  selectLabel: { fontSize: 14, fontWeight: '600', color: theme.colors.ink },
  itemCard: { padding: 12, paddingLeft: 2, gap: 8 },
  itemUnselected: { opacity: 0.65 },
  itemRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  image: { width: 84, height: 84, borderRadius: theme.radius.md },
  details: { flex: 1, gap: 6, minWidth: 0 },
  itemTitleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  name: { flex: 1, fontSize: 13, lineHeight: 18, color: theme.colors.ink },
  deleteButton: { padding: 2 },
  variantPill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: theme.colors.soft,
    borderRadius: 4, paddingHorizontal: 6, paddingVertical: 3 },
  dot: { width: 9, height: 9, borderRadius: 5, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.borderStrong },
  variant: { fontSize: 11, color: theme.colors.muted },
  priceStepRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 2 },
  goneText: { color: theme.colors.danger, fontWeight: '600', fontSize: 12 },
  shortText: { marginLeft: 42, color: theme.colors.warning, fontSize: 12 },
  limitText: { marginLeft: 42, color: theme.colors.muted, fontSize: 11 },
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: theme.colors.surface, paddingLeft: 2, paddingRight: 10, paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.border, gap: 4, ...theme.shadow.raised },
  bottomRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  allLabel: { fontSize: 13, color: theme.colors.text, marginLeft: -6 },
  totalBox: { flex: 1, alignItems: 'flex-end', marginRight: 4 },
  bottomLabel: { fontSize: 11, color: theme.colors.muted },
  buyButton: { height: 44, paddingHorizontal: 16, borderRadius: theme.radius.md, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center' },
  buyDisabled: { opacity: 0.4 },
  buyText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  blockText: { fontSize: 11, color: theme.colors.warning, textAlign: 'right' },
});
