import { useState } from 'react';
import { router } from 'expo-router';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/shop/Button';
import { Input } from '../components/shop/Input';
import { useCart } from '../context/CartContext';
import { theme } from '../theme/theme';
import { formatVnd } from '../types/shop';

export default function CheckoutScreen() {
  const { items, count, totalVnd, clearCart } = useCart();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [note, setNote] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'bank' | 'momo'>('cod');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const nameError = !name.trim() ? 'Vui lòng nhập họ và tên người nhận.' : '';
  const phoneError = !/^(0|\+84)\d{9}$/.test(phone.replace(/\s/g, '')) ? 'Số điện thoại không hợp lệ (ví dụ: 0912345678).' : '';
  const addressError = !address.trim() ? 'Vui lòng nhập địa chỉ giao hàng chi tiết.' : '';

  const shippingFee = totalVnd > 500000 || totalVnd === 0 ? 0 : 30000;
  const grandTotalVnd = totalVnd + shippingFee;

  function handleConfirmOrder() {
    setSubmitted(true);
    if (!items.length || nameError || phoneError || addressError) return;

    setLoading(true);
    setTimeout(() => {
      const orderId = `#UQ-${Math.floor(100000 + Math.random() * 900000)}`;

      // Save order info and clear cart
      clearCart();
      setLoading(false);

      // Navigate to Order Success Screen
      router.replace({
        pathname: '/checkout/success',
        params: {
          orderId,
          name: name.trim(),
          phone: phone.trim(),
          address: address.trim(),
          paymentMethod,
          totalVnd: String(grandTotalVnd),
          itemCount: String(count),
        },
      });
    }, 800);
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Xác nhận & Thanh toán</Text>
        <Text style={styles.subtitle}>Điền thông tin nhận hàng và chọn phương thức thanh toán COD</Text>
      </View>

      {!items.length ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Giỏ hàng của bạn đang trống</Text>
          <Text style={styles.emptySubtitle}>Vui lòng chọn sản phẩm vào giỏ hàng trước khi tiến hành thanh toán.</Text>
          <Button title="← Quay lại danh mục" onPress={() => router.push('/products')} style={{ marginTop: 16 }} />
        </View>
      ) : (
        <>
          {/* Step 1: Shipping Address Form */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>📍 1. Thông tin giao hàng</Text>

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

            <Input
              label="Địa chỉ giao hàng chi tiết *"
              placeholder="Số nhà, Tên đường, Phường/Xã, Quận/Huyện, Tỉnh/Thành phố"
              multiline
              value={address}
              onChangeText={setAddress}
              error={submitted ? addressError : undefined}
            />

            <Input
              label="Ghi chú giao hàng (Không bắt buộc)"
              placeholder="Ví dụ: Giao giờ hành chính, gọi điện trước khi giao"
              value={note}
              onChangeText={setNote}
            />
          </View>

          {/* Step 2: Payment Method Selection */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>💳 2. Phương thức thanh toán</Text>

            {/* COD Option */}
            <Pressable
              style={[styles.paymentOption, paymentMethod === 'cod' && styles.paymentOptionSelected]}
              onPress={() => setPaymentMethod('cod')}
            >
              <View style={styles.radioCircle}>
                {paymentMethod === 'cod' && <View style={styles.radioInner} />}
              </View>
              <View style={styles.paymentInfo}>
                <View style={styles.paymentTitleRow}>
                  <Text style={styles.paymentTitle}>💵 Thanh toán khi nhận hàng (COD)</Text>
                  <View style={styles.recommendedTag}><Text style={styles.recommendedText}>Khuyên dùng</Text></View>
                </View>
                <Text style={styles.paymentDesc}>Thanh toán bằng tiền mặt cho nhân viên giao hàng khi nhận được sản phẩm.</Text>
              </View>
            </Pressable>

            {/* Bank Transfer Option */}
            <Pressable
              style={[styles.paymentOption, paymentMethod === 'bank' && styles.paymentOptionSelected]}
              onPress={() => setPaymentMethod('bank')}
            >
              <View style={styles.radioCircle}>
                {paymentMethod === 'bank' && <View style={styles.radioInner} />}
              </View>
              <View style={styles.paymentInfo}>
                <Text style={styles.paymentTitle}>🏦 Chuyển khoản Ngân hàng / QR Code</Text>
                <Text style={styles.paymentDesc}>Quét mã VietQR bằng ứng dụng Ngân hàng để hoàn tất thanh toán.</Text>
              </View>
            </Pressable>

            {/* MoMo / E-Wallet Option */}
            <Pressable
              style={[styles.paymentOption, paymentMethod === 'momo' && styles.paymentOptionSelected]}
              onPress={() => setPaymentMethod('momo')}
            >
              <View style={styles.radioCircle}>
                {paymentMethod === 'momo' && <View style={styles.radioInner} />}
              </View>
              <View style={styles.paymentInfo}>
                <Text style={styles.paymentTitle}>📲 Ví điện tử MoMo / ZaloPay</Text>
                <Text style={styles.paymentDesc}>Thanh toán nhanh qua ứng dụng Ví điện tử MoMo hoặc ZaloPay.</Text>
              </View>
            </Pressable>
          </View>

          {/* Step 3: Order Items Summary */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>🛍️ 3. Kiểm tra sản phẩm ({count})</Text>

            {items.map(item => (
              <View key={item.key} style={styles.itemRow}>
                {item.imageUrl ? (
                  <Image source={{ uri: item.imageUrl }} style={styles.itemImage} />
                ) : (
                  <View style={styles.itemPlaceholder}>
                    <Text style={{ fontSize: 20 }}>👕</Text>
                  </View>
                )}
                <View style={styles.itemDetails}>
                  <Text style={styles.itemName} numberOfLines={1}>{item.productName}</Text>
                  <Text style={styles.itemMeta}>Size: {item.size} · Màu: {item.color}</Text>
                  <Text style={styles.itemBranch}>🏬 {item.branchName}</Text>
                  <View style={styles.itemPriceRow}>
                    <Text style={styles.itemQty}>x{item.quantity}</Text>
                    <Text style={styles.itemTotal}>{formatVnd(item.unitPriceVnd * item.quantity)}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>

          {/* Step 4: Final Summary & Place Order */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>📋 Tóm tắt thanh toán</Text>

            <View style={styles.summaryLine}>
              <Text style={styles.summaryLabel}>Tạm tính tiền hàng</Text>
              <Text style={styles.summaryValue}>{formatVnd(totalVnd)}</Text>
            </View>

            <View style={styles.summaryLine}>
              <Text style={styles.summaryLabel}>Phí giao hàng</Text>
              <Text style={styles.summaryValue}>
                {shippingFee === 0 ? <Text style={styles.freeText}>MIỄN PHÍ</Text> : formatVnd(shippingFee)}
              </Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.summaryLine}>
              <Text style={styles.grandTotalLabel}>Tổng thanh toán (COD)</Text>
              <Text style={styles.grandTotalValue}>{formatVnd(grandTotalVnd)}</Text>
            </View>

            <Text style={styles.noticeText}>
              Bằng việc bấm nút Đặt hàng, bạn đồng ý xác nhận đơn hàng với hình thức {paymentMethod === 'cod' ? 'Thanh toán COD khi nhận hàng' : 'Thanh toán trực tuyến'}.
            </Text>

            <Button
              title={loading ? 'Đang khởi tạo đơn hàng...' : `Xác nhận đặt hàng (${formatVnd(grandTotalVnd)})`}
              onPress={handleConfirmOrder}
              loading={loading}
              style={{ marginTop: 18 }}
            />
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: 16, paddingBottom: 50 },

  header: { marginTop: 6, marginBottom: 18 },
  title: { fontSize: 24, fontWeight: '800', color: theme.colors.ink },
  subtitle: { fontSize: 13, color: theme.colors.muted, marginTop: 4 },

  emptyCard: { backgroundColor: '#fff', padding: 24, borderRadius: 16, alignItems: 'center', marginTop: 10 },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: theme.colors.ink },
  emptySubtitle: { fontSize: 13, color: theme.colors.muted, textAlign: 'center', marginTop: 6 },

  sectionCard: { backgroundColor: '#fff', borderRadius: 16, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: theme.colors.border },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: theme.colors.ink, marginBottom: 14 },

  paymentOption: { flexDirection: 'row', alignItems: 'flex-start', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, marginBottom: 10, backgroundColor: '#FAFAFA' },
  paymentOptionSelected: { borderColor: theme.colors.primary, backgroundColor: '#FEF2F2' },
  radioCircle: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: theme.colors.primary, justifyContent: 'center', alignItems: 'center', marginTop: 2, marginRight: 12 },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: theme.colors.primary },

  paymentInfo: { flex: 1 },
  paymentTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  paymentTitle: { fontSize: 14, fontWeight: '700', color: theme.colors.ink },
  paymentDesc: { fontSize: 12, color: theme.colors.muted, marginTop: 4, lineHeight: 18 },

  recommendedTag: { backgroundColor: '#DC2626', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  recommendedText: { color: '#fff', fontSize: 10, fontWeight: '700' },

  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  itemImage: { width: 50, height: 62, borderRadius: 8, marginRight: 12, backgroundColor: '#F3F4F6' },
  itemPlaceholder: { width: 50, height: 62, borderRadius: 8, marginRight: 12, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  itemDetails: { flex: 1 },
  itemName: { fontSize: 13, fontWeight: '700', color: theme.colors.ink },
  itemMeta: { fontSize: 11, color: theme.colors.muted, marginTop: 2 },
  itemBranch: { fontSize: 11, color: theme.colors.primary, marginTop: 2 },
  itemPriceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  itemQty: { fontSize: 12, color: theme.colors.muted, fontWeight: '600' },
  itemTotal: { fontSize: 13, fontWeight: '800', color: theme.colors.ink },

  summaryLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  summaryLabel: { fontSize: 13, color: theme.colors.muted },
  summaryValue: { fontSize: 14, fontWeight: '600', color: theme.colors.ink },
  freeText: { color: '#047857', fontWeight: '800', fontSize: 13 },

  divider: { height: 1, backgroundColor: theme.colors.border, marginVertical: 10 },
  grandTotalLabel: { fontSize: 15, fontWeight: '800', color: theme.colors.ink },
  grandTotalValue: { fontSize: 18, fontWeight: '900', color: theme.colors.primary },
  noticeText: { fontSize: 11, color: theme.colors.muted, marginTop: 12, lineHeight: 17 },
});
