import { useState } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/shop/Button';
import { cartErrorMessage, useCart } from '../context/CartContext';
import { useCatalog } from '../features/catalog/useCatalog';
import { hasSupabaseConfig } from '../lib/supabase';
import { findAlternativeBranches, getStock } from '../services/catalog-service';
import { theme } from '../theme/theme';
import { formatVnd } from '../types/shop';

export default function CartScreen() {
  const {
    items, count, selectedKeys, selectedCount, selectedTotalVnd, loading, error, userId, branches, branchId,
    updateQuantity, removeItem, clearCart, refresh, selectBranch, toggleSelectItem, toggleSelectAll,
  } = useCart();

  const catalog = useCatalog();
  const [isEditMode, setIsEditMode] = useState(false);
  const [voucherCode, setVoucherCode] = useState('');
  const [appliedVoucher, setAppliedVoucher] = useState<{ code: string; discountVnd: number } | null>(null);

  const perform = (action: () => Promise<void>) => {
    void action().catch(e => Alert.alert('Không thể cập nhật giỏ hàng', cartErrorMessage(e)));
  };

  const allSelected = items.length > 0 && selectedKeys.length === items.length;
  const currentBranchObj = branches.find(b => b.id === branchId);
  const currentBranchName = currentBranchObj ? currentBranchObj.name : 'Chi nhánh hiện tại';

  // Identify items that are out of stock or missing stock at the current branch
  const stockIssueItems = items.filter(item => item.quantity > item.maxAvailable);
  const invalidStock = stockIssueItems.length > 0;

  // Find alternative branches that can fulfill ALL selected items in the cart
  const alternativeBranchSuggestions = catalog.data
    ? branches
      .filter(b => b.id !== branchId)
      .map(b => {
        const canFulfillAll = items.every(item => getStock(catalog.data!, item.skuId, b.id) >= item.quantity);
        return {
          branchId: b.id,
          branchName: b.name,
          canFulfillAll,
        };
      })
      .filter(b => b.canFulfillAll)
    : [];

  const discountVnd = appliedVoucher ? appliedVoucher.discountVnd : 0;
  const grandTotalVnd = Math.max(0, selectedTotalVnd - discountVnd);

  function handleApplyVoucher() {
    const code = voucherCode.trim().toUpperCase();
    if (!code) {
      Alert.alert('Mã giảm giá', 'Vui lòng nhập mã giảm giá.');
      return;
    }
    if (code === 'UNIQLO10') {
      const discount = Math.round(selectedTotalVnd * 0.1);
      setAppliedVoucher({ code: 'UNIQLO10 (Giảm 10%)', discountVnd: discount });
      Alert.alert('Thành công', `Đã áp dụng mã giảm 10% (${formatVnd(discount)}).`);
    } else if (code === 'FREESHIP') {
      setAppliedVoucher({ code: 'FREESHIP (Miễn phí ship)', discountVnd: 30000 });
      Alert.alert('Thành công', 'Đã áp dụng mã miễn phí vận chuyển.');
    } else {
      Alert.alert('Lỗi', 'Mã giảm giá không hợp lệ. Gợi ý: UNIQLO10 hoặc FREESHIP');
    }
  }

  function handleRemoveSelected() {
    if (selectedKeys.length === 0) {
      Alert.alert('Thông báo', 'Vui lòng chọn ít nhất 1 sản phẩm để xóa.');
      return;
    }
    Alert.alert('Xóa sản phẩm đã chọn', `Xóa ${selectedKeys.length} sản phẩm đã chọn khỏi giỏ hàng?`, [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: () => {
          perform(async () => {
            for (const key of selectedKeys) {
              await removeItem(key);
            }
          });
        },
      },
    ]);
  }

  if (hasSupabaseConfig && !userId && !loading) {
    return (
      <View style={styles.loginRequiredPage}>
        <Text style={styles.icon}>🛒</Text>
        <Text style={styles.title}>Giỏ hàng của bạn</Text>
        <Text style={styles.note}>Vui lòng đăng nhập để lưu và đồng bộ giỏ hàng trên tài khoản của bạn.</Text>
        <Button title="Đăng nhập ngay" onPress={() => router.push('/auth/login' as any)} style={{ marginTop: 16, width: '100%' }} />
      </View>
    );
  }

  return (
    <View style={styles.mainContainer}>
      <ScrollView style={styles.page} contentContainerStyle={styles.content}>
        {/* Top Header */}
        <View style={styles.topHeader}>
          <View>
            <Text style={styles.title}>Giỏ hàng Shopee Style ({count})</Text>
            <Text style={styles.subTitleText}>Chọn các sản phẩm cần mua và tiến hành đặt hàng</Text>
          </View>
          {items.length > 0 && (
            <Pressable onPress={() => setIsEditMode(!isEditMode)} style={styles.editToggleBtn}>
              <Text style={styles.editToggleText}>{isEditMode ? 'Hoàn tất' : 'Sửa giỏ'}</Text>
            </Pressable>
          )}
        </View>

        {!hasSupabaseConfig && (
          <Text style={styles.warning}>DEMO · Giỏ hàng lưu tạm phiên này. Đặt hàng chính thức cần kết nối Supabase.</Text>
        )}

        {loading && <ActivityIndicator accessibilityLabel="Đang đồng bộ giỏ hàng" color={theme.colors.primary} style={{ marginVertical: 12 }} />}

        {error && (
          <View style={styles.card}>
            <Text style={styles.warning}>{error}</Text>
            <Button title="Tải lại giỏ hàng" disabled={loading} onPress={() => perform(refresh)} />
          </View>
        )}

        {!loading && !error && !items.length && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>🛍️</Text>
            <Text style={styles.emptyTitle}>Giỏ hàng của bạn đang trống</Text>
            <Text style={styles.emptySub}>Khám phá các sản phẩm thời trang phong cách tối giản từ UNIQLO nhé!</Text>
            <Button title="Khám phá sản phẩm ngay →" onPress={() => router.push('/products')} style={{ marginTop: 16 }} />
          </View>
        )}

        {!!items.length && (
          <>
            {/* Shopee-style Branch Selection */}
            <View style={styles.card}>
              <Text style={styles.cardSectionTitle}>🏬 Chi nhánh nhận hàng</Text>
              <Text style={styles.note}>Giỏ hàng kiểm tra tồn kho tại chi nhánh được chọn:</Text>
              <View style={styles.branchWrap}>
                {branches.map(branch => (
                  <Pressable
                    key={branch.id}
                    disabled={loading}
                    onPress={() => perform(() => selectBranch(branch.id))}
                    style={[styles.branchChip, branch.id === branchId && styles.branchChipActive]}
                  >
                    <Text style={[styles.branchChipText, branch.id === branchId && styles.branchChipTextActive]}>
                      {branch.id === branchId ? '✓ ' : ''}{branch.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Out-of-stock / Missing Stock Alert & Alternative Branch Recommendation */}
            {invalidStock && (
              <View style={styles.stockAlertCard}>
                <Text style={styles.stockAlertTitle}>⚠️ Phát hiện sản phẩm thiếu hàng tại {currentBranchName}</Text>
                {stockIssueItems.map(item => {
                  const missingCount = item.quantity - item.maxAvailable;
                  return (
                    <Text key={item.key} style={styles.stockAlertText}>
                      • <Text style={{ fontWeight: '700' }}>{item.productName}</Text> ({item.size}/{item.color}): Cần {item.quantity} nhưng chi nhánh chỉ còn {item.maxAvailable} (Thiếu {missingCount} sản phẩm).
                    </Text>
                  );
                })}

                {/* Alternative Branch Suggestion List */}
                {alternativeBranchSuggestions.length > 0 ? (
                  <View style={styles.suggestionBox}>
                    <Text style={styles.suggestionTitle}>💡 Gợi ý chi nhánh khác có ĐỦ TẤT CẢ HÀNG trong giỏ:</Text>
                    {alternativeBranchSuggestions.map(alt => (
                      <Pressable
                        key={alt.branchId}
                        style={styles.suggestionBranchBtn}
                        onPress={() => perform(() => selectBranch(alt.branchId))}
                      >
                        <Text style={styles.suggestionBranchBtnText}>
                          📍 Đổi giỏ sang: <Text style={{ fontWeight: '800' }}>{alt.branchName}</Text> (Đủ hàng) →
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.noBranchHint}>💡 Mẹo: Bạn có thể giảm số lượng hoặc đổi chi nhánh khác có sẵn từng món.</Text>
                )}
              </View>
            )}

            {/* Shopee-style Select All Bar */}
            <View style={[styles.card, styles.selectToolbar]}>
              <Pressable onPress={() => toggleSelectAll()} style={styles.checkboxRow}>
                <View style={[styles.checkbox, allSelected && styles.checkboxActive]}>
                  {allSelected && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={styles.selectLabel}>
                  Chọn tất cả ({selectedKeys.length}/{items.length} sản phẩm)
                </Text>
              </Pressable>
            </View>

            {/* Item List with Checkboxes & Per-Item Branch Suggestions */}
            {items.map(item => {
              const isSelected = selectedKeys.includes(item.key);
              const isMaxStock = item.quantity >= item.maxAvailable;
              const isStockMissing = item.quantity > item.maxAvailable;

              // Find alternative branches specifically for this item if missing stock
              const itemAlternativeBranches = catalog.data && isStockMissing
                ? findAlternativeBranches(catalog.data, item.skuId, item.quantity, branchId)
                : [];

              return (
                <View key={item.key} style={[styles.card, !isSelected && styles.cardUnselected, isStockMissing && styles.cardMissingStock]}>
                  <View style={styles.row}>
                    {/* Item Checkbox */}
                    <Pressable onPress={() => toggleSelectItem(item.key)} style={styles.itemCheckboxArea} hitSlop={6}>
                      <View style={[styles.checkbox, isSelected && styles.checkboxActive]}>
                        {isSelected && <Text style={styles.checkmark}>✓</Text>}
                      </View>
                    </Pressable>

                    {/* Image Thumbnail */}
                    {item.imageUrl ? (
                      <Image source={{ uri: item.imageUrl }} style={styles.image} resizeMode="cover" />
                    ) : (
                      <View style={styles.imageMock}><Text style={{ fontSize: 28 }}>👕</Text></View>
                    )}

                    {/* Details */}
                    <View style={styles.details}>
                      <View style={styles.itemTitleRow}>
                        <Text style={styles.name} numberOfLines={2}>{item.productName}</Text>
                        <Pressable onPress={() => perform(() => removeItem(item.key))} hitSlop={8}>
                          <Text style={styles.deleteIconText}>✕</Text>
                        </Pressable>
                      </View>

                      <View style={styles.badgeRow}>
                        <View style={styles.badge}><Text style={styles.badgeText}>Size: {item.size}</Text></View>
                        <View style={styles.badge}><Text style={styles.badgeText}>Màu: {item.color}</Text></View>
                      </View>

                      <Text style={styles.note}>SKU: {item.skuCode}</Text>
                      <Text style={styles.priceText}>
                        {formatVnd(item.unitPriceVnd)} × {item.quantity} = <Text style={styles.totalItemPrice}>{formatVnd(item.unitPriceVnd * item.quantity)}</Text>
                      </Text>
                    </View>
                  </View>

                  {/* Quantity Stepper */}
                  <View style={styles.rowActions}>
                    <Text style={styles.stepperLabel}>Số lượng:</Text>
                    <View style={styles.stepperGroup}>
                      <Pressable
                        style={[styles.stepBtn, (loading || item.quantity <= 1) && styles.stepBtnDisabled]}
                        disabled={loading || item.quantity <= 1}
                        onPress={() => perform(() => updateQuantity(item.key, item.quantity - 1))}
                      >
                        <Text style={styles.stepBtnText}>−</Text>
                      </Pressable>

                      <Text style={styles.qtyText}>{item.quantity}</Text>

                      <Pressable
                        style={[styles.stepBtn, (loading || isMaxStock) && styles.stepBtnDisabled]}
                        disabled={loading || isMaxStock}
                        onPress={() => perform(() => updateQuantity(item.key, item.quantity + 1))}
                      >
                        <Text style={styles.stepBtnText}>+</Text>
                      </Pressable>
                    </View>
                  </View>

                  {/* Stock Warnings & Per-Item Branch Suggestions */}
                  {isStockMissing ? (
                    <View style={styles.itemMissingBox}>
                      <Text style={styles.itemMissingText}>
                        ⚠️ Không đủ hàng tại {currentBranchName}: Chỉ có {item.maxAvailable} sản phẩm (Cần {item.quantity}).
                      </Text>
                      {itemAlternativeBranches.length > 0 && (
                        <View style={styles.altBranchItemGroup}>
                          <Text style={styles.altBranchHeader}>💡 Gợi ý chi nhánh khác có sẵn:</Text>
                          {itemAlternativeBranches.slice(0, 2).map(alt => (
                            <Pressable
                              key={alt.branchId}
                              style={styles.altBranchItemBtn}
                              onPress={() => perform(() => selectBranch(alt.branchId))}
                            >
                              <Text style={styles.altBranchItemBtnText}>
                                🏬 Đổi sang <Text style={{ fontWeight: '800' }}>{alt.branchName}</Text> (Có sẵn {alt.availableQuantity} sp) →
                              </Text>
                            </Pressable>
                          ))}
                        </View>
                      )}
                    </View>
                  ) : isMaxStock ? (
                    <Text style={styles.stockLimitNote}>ℹ️ Đã đạt giới hạn tồn kho tối đa tại chi nhánh này ({item.maxAvailable}).</Text>
                  ) : null}
                </View>
              );
            })}

            {/* Voucher Section */}
            <View style={styles.card}>
              <Text style={styles.cardSectionTitle}>🏷️ Mã giảm giá / Voucher</Text>
              <View style={styles.voucherRow}>
                <View style={{ flex: 1 }}>
                  <Pressable style={styles.voucherInputBox}>
                    <Text style={styles.voucherInputText}>{voucherCode || 'Nhập mã (UNIQLO10 / FREESHIP)'}</Text>
                  </Pressable>
                </View>
                <Button title="Nhập mã" variant="outline" onPress={() => {
                  Alert.prompt
                    ? Alert.prompt('Nhập mã giảm giá', 'Nhập UNIQLO10 (giảm 10%) hoặc FREESHIP', text => {
                      if (text) { setVoucherCode(text); handleApplyVoucher(); }
                    })
                    : setVoucherCode('UNIQLO10');
                }} />
              </View>
              {appliedVoucher && (
                <View style={styles.appliedTag}>
                  <Text style={styles.appliedText}>✓ {appliedVoucher.code}</Text>
                  <Pressable onPress={() => { setAppliedVoucher(null); setVoucherCode(''); }}>
                    <Text style={styles.removeVoucherText}>Xóa</Text>
                  </Pressable>
                </View>
              )}
            </View>

            {/* Batch Options Card */}
            <View style={styles.card}>
              <Text style={styles.cardSectionTitle}>⚙️ Tùy chọn giỏ hàng</Text>
              <Button title="Tải lại giỏ hàng" variant="outline" disabled={loading} onPress={() => perform(refresh)} />
              <Button
                title="Xóa toàn bộ giỏ hàng"
                variant="outline"
                disabled={loading}
                onPress={() => {
                  Alert.alert('Xóa toàn bộ', 'Bạn có chắc muốn xóa tất cả sản phẩm khỏi giỏ hàng?', [
                    { text: 'Hủy', style: 'cancel' },
                    { text: 'Xóa sạch', style: 'destructive', onPress: () => perform(clearCart) },
                  ]);
                }}
              />
            </View>
          </>
        )}
      </ScrollView>

      {/* Shopee-style Sticky Bottom Bar */}
      {!!items.length && (
        <View style={styles.stickyBottomBar}>
          {/* Check All Checkbox */}
          <Pressable onPress={() => toggleSelectAll()} style={styles.bottomCheckboxRow}>
            <View style={[styles.checkbox, allSelected && styles.checkboxActive]}>
              {allSelected && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.bottomCheckText}>Tất cả ({selectedKeys.length})</Text>
          </Pressable>

          {/* Total Price & Checkout / Delete Action */}
          {!isEditMode ? (
            <View style={styles.bottomCheckoutRight}>
              <View style={styles.bottomPriceGroup}>
                <Text style={styles.bottomTotalLabel}>Tổng thanh toán:</Text>
                <Text style={styles.bottomTotalVnd}>{formatVnd(grandTotalVnd)}</Text>
              </View>

              <Button
                title={`Mua hàng (${selectedCount})`}
                disabled={loading || !!error || invalidStock || !hasSupabaseConfig || selectedCount === 0}
                onPress={() => router.push('/checkout')}
                style={styles.buyButton}
              />
            </View>
          ) : (
            <View style={styles.bottomEditRight}>
              <Button
                title={`Xóa (${selectedKeys.length})`}
                variant="outline"
                disabled={loading || selectedKeys.length === 0}
                onPress={handleRemoveSelected}
                style={styles.deleteSelectedBtn}
              />
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: theme.colors.background },
  page: { flex: 1 },
  content: { padding: 16, paddingBottom: 110, gap: 14 },
  loginRequiredPage: { flex: 1, padding: 28, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background },
  icon: { fontSize: 56 },
  topHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, marginBottom: 8 },
  title: { fontSize: 22, fontWeight: '800', color: theme.colors.ink },
  subTitleText: { fontSize: 12, color: theme.colors.muted, marginTop: 2 },
  editToggleBtn: { paddingVertical: 6, paddingHorizontal: 12, backgroundColor: '#E5E7EB', borderRadius: 16 },
  editToggleText: { fontSize: 13, fontWeight: '700', color: theme.colors.ink },

  emptyCard: { backgroundColor: '#fff', padding: 28, borderRadius: 16, alignItems: 'center', marginTop: 20 },
  emptyIcon: { fontSize: 44, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: theme.colors.ink },
  emptySub: { fontSize: 13, color: theme.colors.muted, textAlign: 'center', marginTop: 6 },

  card: { backgroundColor: '#fff', padding: 16, borderRadius: 14, gap: 10, borderWidth: 1, borderColor: theme.colors.border },
  cardUnselected: { opacity: 0.65, backgroundColor: '#FAFAFA' },
  cardMissingStock: { borderColor: '#F59E0B', borderWidth: 1.5 },
  cardSectionTitle: { fontSize: 15, fontWeight: '800', color: theme.colors.ink },

  branchWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  branchChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: '#FAFAFA' },
  branchChipActive: { backgroundColor: theme.colors.ink, borderColor: theme.colors.ink },
  branchChipText: { fontSize: 12, fontWeight: '600', color: theme.colors.ink },
  branchChipTextActive: { color: '#fff' },

  stockAlertCard: { backgroundColor: '#FEF3C7', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#F59E0B', gap: 8 },
  stockAlertTitle: { fontSize: 14, fontWeight: '800', color: '#B45309' },
  stockAlertText: { fontSize: 12, color: '#92400E', lineHeight: 18 },
  suggestionBox: { marginTop: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#FDE68A', gap: 8 },
  suggestionTitle: { fontSize: 13, fontWeight: '800', color: '#B45309' },
  suggestionBranchBtn: { backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#F59E0B' },
  suggestionBranchBtnText: { fontSize: 12, color: theme.colors.ink, fontWeight: '600' },
  noBranchHint: { fontSize: 11, color: '#B45309', marginTop: 4 },

  itemMissingBox: { marginTop: 10, backgroundColor: '#FEF3C7', padding: 10, borderRadius: 8, gap: 6 },
  itemMissingText: { fontSize: 12, color: '#B45309', fontWeight: '600' },
  altBranchItemGroup: { marginTop: 4, gap: 6 },
  altBranchHeader: { fontSize: 11, fontWeight: '800', color: '#B45309' },
  altBranchItemBtn: { backgroundColor: '#fff', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: '#F59E0B' },
  altBranchItemBtnText: { fontSize: 11, color: theme.colors.ink, fontWeight: '600' },

  selectToolbar: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkbox: { width: 22, height: 22, borderRadius: 4, borderWidth: 2, borderColor: theme.colors.muted, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  checkboxActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  checkmark: { color: '#fff', fontSize: 13, fontWeight: '800' },
  selectLabel: { fontSize: 14, fontWeight: '700', color: theme.colors.ink },
  itemCheckboxArea: { paddingRight: 6, justifyContent: 'center' },

  name: { fontSize: 15, fontWeight: '700', color: theme.colors.ink, flex: 1 },
  deleteIconText: { fontSize: 16, fontWeight: '700', color: '#9CA3AF', paddingLeft: 8 },
  itemTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },

  badgeRow: { flexDirection: 'row', gap: 6, marginVertical: 3 },
  badge: { backgroundColor: '#F3F4F6', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  badgeText: { fontSize: 11, fontWeight: '600', color: theme.colors.ink },

  note: { fontSize: 12, color: theme.colors.muted, lineHeight: 18 },
  warning: { color: '#9B3815', backgroundColor: '#FFF3D8', padding: 10, borderRadius: 8, fontSize: 12, lineHeight: 18 },
  stockLimitNote: { color: '#B45309', fontSize: 11, marginTop: 4 },

  priceText: { fontSize: 12, color: theme.colors.muted, marginTop: 4 },
  totalItemPrice: { fontWeight: '800', color: theme.colors.primary, fontSize: 14 },
  row: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  rowActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  stepperLabel: { fontSize: 12, color: theme.colors.muted },
  stepperGroup: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: theme.colors.border, borderRadius: 6, backgroundColor: '#FAFAFA' },
  stepBtn: { width: 32, height: 32, justifyContent: 'center', alignItems: 'center' },
  stepBtnDisabled: { opacity: 0.3 },
  stepBtnText: { fontSize: 16, fontWeight: '700', color: theme.colors.ink },
  qtyText: { fontWeight: '700', fontSize: 14, minWidth: 28, textAlign: 'center', color: theme.colors.ink },

  details: { flex: 1, gap: 2 },
  image: { width: 68, height: 90, borderRadius: 8 },
  imageMock: { width: 68, height: 90, borderRadius: 8, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },

  voucherRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  voucherInputBox: { height: 42, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8, justifyContent: 'center', paddingHorizontal: 12, backgroundColor: '#FAFAFA' },
  voucherInputText: { fontSize: 13, color: theme.colors.muted },
  appliedTag: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ECFDF5', padding: 8, borderRadius: 6, marginTop: 6 },
  appliedText: { fontSize: 12, color: '#047857', fontWeight: '700' },
  removeVoucherText: { fontSize: 12, color: theme.colors.danger, fontWeight: '700' },

  stickyBottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 68, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: theme.colors.border, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', shadowColor: '#000', shadowOffset: { width: 0, height: -3 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 12 },
  bottomCheckboxRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bottomCheckText: { fontSize: 13, fontWeight: '700', color: theme.colors.ink },
  bottomCheckoutRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bottomPriceGroup: { alignItems: 'flex-end' },
  bottomTotalLabel: { fontSize: 10, color: theme.colors.muted },
  bottomTotalVnd: { fontSize: 16, fontWeight: '900', color: theme.colors.primary },
  buyButton: { minWidth: 120, height: 44 },
  bottomEditRight: { flexDirection: 'row', alignItems: 'center' },
  deleteSelectedBtn: { minWidth: 100, height: 42 },
});
