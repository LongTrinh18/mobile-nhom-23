import { useState } from 'react';
import { router } from 'expo-router';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/shop/Button';
import { Input } from '../components/shop/Input';
import { useCart } from '../context/CartContext';
import { theme } from '../theme/theme';
import { formatVnd } from '../types/shop';

export default function CartScreen() {
  const { items, count, totalVnd, updateQuantity, removeItem, clearCart } = useCart();
  const [voucherCode, setVoucherCode] = useState('');
  const [appliedVoucher, setAppliedVoucher] = useState<{ code: string; discountVnd: number } | null>(null);
  const [voucherError, setVoucherError] = useState('');

  // Calculate Shipping fee & Discounts
  const shippingFee = totalVnd > 500000 || totalVnd === 0 ? 0 : 30000;
  const discountVnd = appliedVoucher ? appliedVoucher.discountVnd : 0;
  const grandTotalVnd = Math.max(0, totalVnd + shippingFee - discountVnd);

  function handleApplyVoucher() {
    setVoucherError('');
    const code = voucherCode.trim().toUpperCase();
    if (!code) {
      setVoucherError('Vui lòng nhập mã giảm giá.');
      return;
    }
    if (code === 'UNIQLO10') {
      const discount = Math.round(totalVnd * 0.1);
      setAppliedVoucher({ code: 'UNIQLO10 (Giảm 10%)', discountVnd: discount });
      Alert.alert('Áp dụng mã thành công', `Đã giảm 10% (${formatVnd(discount)}) cho đơn hàng.`);
    } else if (code === 'FREESHIP') {
      setAppliedVoucher({ code: 'FREESHIP (Miễn phí vận chuyển)', discountVnd: shippingFee });
      Alert.alert('Áp dụng mã thành công', 'Đã áp dụng mã miễn phí vận chuyển.');
    } else {
      setVoucherError('Mã giảm giá không hợp lệ. Thử: UNIQLO10 hoặc FREESHIP');
    }
  }

  function handleConfirmClearCart() {
    Alert.alert('Xóa giỏ hàng', 'Bạn có chắc chắn muốn xóa toàn bộ sản phẩm khỏi giỏ hàng?', [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Xóa tất cả', style: 'destructive', onPress: clearCart },
    ]);
  }

  function handleConfirmRemoveItem(key: string, name: string) {
    Alert.alert('Xóa sản phẩm', `Bạn có muốn xóa "${name}" khỏi giỏ hàng?`, [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Xóa', style: 'destructive', onPress: () => removeItem(key) },
    ]);
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>Giỏ hàng của bạn</Text>
            <Text style={styles.subtitle}>{count} sản phẩm · Kiểm tra tồn kho theo chi nhánh</Text>
          </View>
          {items.length > 0 && (
            <Pressable onPress={handleConfirmClearCart} style={styles.clearCartBtn}>
              <Text style={styles.clearCartText}>Xóa tất cả</Text>
            </Pressable>
          )}
        </View>

        {!items.length ? (
          /* Empty State */
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconBg}>
              <Text style={styles.emptyIcon}>🛍️</Text>
            </View>
            <Text style={styles.emptyTitle}>Giỏ hàng của bạn đang trống</Text>
            <Text style={styles.emptySubtitle}>Hãy khám phá các sản phẩm thời trang chất lượng từ UNIQLO và chọn kích thước, màu sắc phù hợp nhé!</Text>
            <Button title="Khám phá sản phẩm ngay →" onPress={() => router.push('/products')} style={{ marginTop: 20 }} />
          </View>
        ) : (
          <>
            {/* List Cart Items */}
            {items.map(item => {
              const itemTotal = item.unitPriceVnd * item.quantity;
              const isMaxStock = item.quantity >= item.maxAvailable;

              return (
                <View key={item.key} style={styles.itemCard}>
                  {/* Thumbnail */}
                  <View style={styles.imageBox}>
                    {item.imageUrl ? (
                      <Image source={{ uri: item.imageUrl }} style={styles.productImage} resizeMode="cover" />
                    ) : (
                      <View style={styles.placeholderImg}>
                        <Text style={styles.emoji}>👕</Text>
                      </View>
                    )}
                  </View>

                  {/* Info Details */}
                  <View style={styles.itemDetails}>
                    <View style={styles.itemHeader}>
                      <Text style={styles.itemName} numberOfLines={2}>{item.productName}</Text>
                      <Pressable onPress={() => handleConfirmRemoveItem(item.key, item.productName)} hitSlop={8}>
                        <Text style={styles.deleteText}>✕</Text>
                      </Pressable>
                    </View>

                    {/* Variant Badges */}
                    <View style={styles.badgeRow}>
                      <View style={styles.badge}><Text style={styles.badgeText}>Size: {item.size}</Text></View>
                      <View style={styles.badge}><Text style={styles.badgeText}>Màu: {item.color}</Text></View>
                    </View>

                    <Text style={styles.branchText}>🏬 {item.branchName}</Text>
                    <Text style={styles.skuText}>SKU: {item.skuCode}</Text>

                    {/* Price & Quantity Controls */}
                    <View style={styles.priceAndQtyRow}>
                      <View>
                        <Text style={styles.unitPrice}>{formatVnd(item.unitPriceVnd)}</Text>
                        <Text style={styles.itemTotal}>Tổng: {formatVnd(itemTotal)}</Text>
                      </View>

                      <View style={styles.quantityStepper}>
                        <Pressable
                          style={styles.stepBtn}
                          onPress={() => {
                            if (item.quantity === 1) {
                              handleConfirmRemoveItem(item.key, item.productName);
                            } else {
                              updateQuantity(item.key, item.quantity - 1);
                            }
                          }}
                        >
                          <Text style={styles.stepBtnText}>−</Text>
                        </Pressable>

                        <Text style={styles.qtyValue}>{item.quantity}</Text>

                        <Pressable
                          style={[styles.stepBtn, isMaxStock && styles.stepBtnDisabled]}
                          disabled={isMaxStock}
                          onPress={() => updateQuantity(item.key, item.quantity + 1)}
                        >
                          <Text style={[styles.stepBtnText, isMaxStock && styles.stepBtnTextDisabled]}>+</Text>
                        </Pressable>
                      </View>
                    </View>

                    {isMaxStock && (
                      <Text style={styles.stockNotice}>⚠️ Đã đạt giới hạn tồn kho ({item.maxAvailable} sản phẩm tại chi nhánh này)</Text>
                    )}
                  </View>
                </View>
              );
            })}

            {/* Voucher Section */}
            <View style={styles.cardSection}>
              <Text style={styles.sectionTitle}>Mã giảm giá / Voucher</Text>
              <View style={styles.voucherInputRow}>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Input
                    placeholder="Mã giảm giá (ví dụ: UNIQLO10)"
                    value={voucherCode}
                    onChangeText={setVoucherCode}
                    autoCapitalize="characters"
                    error={voucherError}
                  />
                </View>
                <Button title="Áp dụng" onPress={handleApplyVoucher} variant="outline" style={{ height: 46, minHeight: 46 }} />
              </View>

              {appliedVoucher && (
                <View style={styles.appliedTag}>
                  <Text style={styles.appliedText}>✓ Đã áp dụng: {appliedVoucher.code}</Text>
                  <Pressable onPress={() => { setAppliedVoucher(null); setVoucherCode(''); }}>
                    <Text style={styles.removeVoucher}>Xóa</Text>
                  </Pressable>
                </View>
              )}
            </View>

            {/* Order Summary */}
            <View style={styles.cardSection}>
              <Text style={styles.sectionTitle}>Tóm tắt đơn hàng</Text>

              <View style={styles.summaryLine}>
                <Text style={styles.summaryLabel}>Tạm tính tiền hàng</Text>
                <Text style={styles.summaryValue}>{formatVnd(totalVnd)}</Text>
              </View>

              <View style={styles.summaryLine}>
                <Text style={styles.summaryLabel}>Phí vận chuyển dự kiến</Text>
                <Text style={styles.summaryValue}>
                  {shippingFee === 0 ? <Text style={styles.freeText}>MIỄN PHÍ</Text> : formatVnd(shippingFee)}
                </Text>
              </View>

              {discountVnd > 0 && (
                <View style={styles.summaryLine}>
                  <Text style={styles.summaryLabel}>Giảm giá Voucher</Text>
                  <Text style={styles.discountValue}>−{formatVnd(discountVnd)}</Text>
                </View>
              )}

              <View style={styles.divider} />

              <View style={styles.summaryLine}>
                <Text style={styles.grandTotalLabel}>Tổng thanh toán</Text>
                <Text style={styles.grandTotalValue}>{formatVnd(grandTotalVnd)}</Text>
              </View>

              <Text style={styles.noteText}>* Giá đã bao gồm thuế VAT. Đơn hàng từ 500.000₫ được miễn phí giao hàng toàn quốc.</Text>
            </View>
          </>
        )}
      </ScrollView>

      {/* Fixed Bottom Checkout Bar */}
      {items.length > 0 && (
        <View style={styles.bottomBar}>
          <View style={styles.bottomBarPrice}>
            <Text style={styles.bottomBarLabel}>Tổng cộng</Text>
            <Text style={styles.bottomBarTotal}>{formatVnd(grandTotalVnd)}</Text>
          </View>
          <Button
            title="Tiến hành đặt hàng →"
            onPress={() => router.push('/checkout')}
            style={{ flex: 1, marginLeft: 16 }}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  screen: { flex: 1 },
  content: { padding: 16, paddingBottom: 110 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18, marginTop: 6 },
  title: { fontSize: 24, fontWeight: '800', color: theme.colors.ink },
  subtitle: { fontSize: 12, color: theme.colors.muted, marginTop: 4 },
  clearCartBtn: { paddingVertical: 6, paddingHorizontal: 10, backgroundColor: '#FEE2E2', borderRadius: 8 },
  clearCartText: { color: theme.colors.danger, fontSize: 12, fontWeight: '700' },

  emptyCard: { backgroundColor: '#fff', padding: 28, borderRadius: 16, alignItems: 'center', marginTop: 20 },
  emptyIconBg: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  emptyIcon: { fontSize: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: theme.colors.ink, marginBottom: 8 },
  emptySubtitle: { fontSize: 13, color: theme.colors.muted, textAlign: 'center', lineHeight: 20 },

  itemCard: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: theme.colors.border },
  imageBox: { width: 88, height: 110, borderRadius: 10, overflow: 'hidden', backgroundColor: '#F3F4F6', marginRight: 12 },
  productImage: { width: '100%', height: '100%' },
  placeholderImg: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emoji: { fontSize: 32 },

  itemDetails: { flex: 1 },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  itemName: { fontSize: 14, fontWeight: '700', color: theme.colors.ink, flex: 1, paddingRight: 8 },
  deleteText: { color: '#9CA3AF', fontSize: 16, fontWeight: '700', padding: 2 },

  badgeRow: { flexDirection: 'row', gap: 6, marginVertical: 6 },
  badge: { backgroundColor: '#F3F4F6', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 11, fontWeight: '600', color: theme.colors.ink },

  branchText: { fontSize: 11, color: theme.colors.primary, fontWeight: '600' },
  skuText: { fontSize: 10, color: theme.colors.muted, marginTop: 2 },

  priceAndQtyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 10 },
  unitPrice: { fontSize: 12, color: theme.colors.muted },
  itemTotal: { fontSize: 15, fontWeight: '800', color: theme.colors.primary, marginTop: 2 },

  quantityStepper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8, backgroundColor: '#FAFAFA' },
  stepBtn: { width: 32, height: 32, justifyContent: 'center', alignItems: 'center' },
  stepBtnDisabled: { opacity: 0.3 },
  stepBtnText: { fontSize: 16, fontWeight: '700', color: theme.colors.ink },
  stepBtnTextDisabled: { color: theme.colors.muted },
  qtyValue: { minWidth: 26, textAlign: 'center', fontWeight: '700', fontSize: 14, color: theme.colors.ink },

  stockNotice: { fontSize: 11, color: '#B45309', marginTop: 8, backgroundColor: '#FEF3C7', padding: 6, borderRadius: 6 },

  cardSection: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: theme.colors.border },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: theme.colors.ink, marginBottom: 12 },

  voucherInputRow: { flexDirection: 'row', alignItems: 'center' },
  appliedTag: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ECFDF5', padding: 10, borderRadius: 8, marginTop: 8 },
  appliedText: { fontSize: 12, color: '#047857', fontWeight: '700' },
  removeVoucher: { fontSize: 12, color: theme.colors.danger, fontWeight: '700' },

  summaryLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  summaryLabel: { fontSize: 13, color: theme.colors.muted },
  summaryValue: { fontSize: 14, fontWeight: '600', color: theme.colors.ink },
  freeText: { color: '#047857', fontWeight: '800', fontSize: 13 },
  discountValue: { fontSize: 14, fontWeight: '700', color: theme.colors.primary },

  divider: { height: 1, backgroundColor: theme.colors.border, marginVertical: 10 },
  grandTotalLabel: { fontSize: 15, fontWeight: '800', color: theme.colors.ink },
  grandTotalValue: { fontSize: 18, fontWeight: '900', color: theme.colors.primary },
  noteText: { fontSize: 11, color: theme.colors.muted, marginTop: 10, lineHeight: 16 },

  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', paddingHorizontal: 18, paddingVertical: 14, borderTopWidth: 1, borderTopColor: theme.colors.border, flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: -3 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 10 },
  bottomBarPrice: { justifyContent: 'center' },
  bottomBarLabel: { fontSize: 11, color: theme.colors.muted },
  bottomBarTotal: { fontSize: 18, fontWeight: '900', color: theme.colors.primary, marginTop: 2 },
});
