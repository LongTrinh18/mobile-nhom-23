import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/shop/Button';
import { theme } from '../../theme/theme';
import { formatVnd } from '../../types/shop';

export default function OrderSuccessScreen() {
  const params = useLocalSearchParams<{
    orderId?: string;
    name?: string;
    phone?: string;
    address?: string;
    paymentMethod?: string;
    totalVnd?: string;
    itemCount?: string;
  }>();

  const orderId = params.orderId ?? `#UQ-${Math.floor(100000 + Math.random() * 900000)}`;
  const totalAmount = params.totalVnd ? Number(params.totalVnd) : 0;
  const methodText = params.paymentMethod === 'cod' ? 'Thanh toán khi nhận hàng (COD)' : 'Thanh toán Online';

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.headerCard}>
        <View style={styles.iconBg}>
          <Text style={styles.icon}>🎉</Text>
        </View>
        <Text style={styles.successTitle}>Đặt hàng thành công!</Text>
        <Text style={styles.successSubtitle}>Cảm ơn bạn đã mua sắm tại UNIQLO. Đơn hàng của bạn đang được xử lý và chuẩn bị đóng gói.</Text>
        <View style={styles.orderIdBadge}>
          <Text style={styles.orderIdLabel}>Mã đơn hàng:</Text>
          <Text style={styles.orderIdValue}>{orderId}</Text>
        </View>
      </View>

      {/* Payment & Delivery Summary Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>📦 Thông tin giao hàng & Thanh toán</Text>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Người nhận:</Text>
          <Text style={styles.infoValue}>{params.name || 'Khách hàng'}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Số điện thoại:</Text>
          <Text style={styles.infoValue}>{params.phone || 'N/A'}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Địa chỉ giao hàng:</Text>
          <Text style={[styles.infoValue, { flex: 1, textAlign: 'right' }]}>{params.address || 'N/A'}</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Hình thức thanh toán:</Text>
          <View style={styles.codBadge}>
            <Text style={styles.codBadgeText}>✓ {methodText}</Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Số lượng sản phẩm:</Text>
          <Text style={styles.infoValue}>{params.itemCount || '1'} món</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Tổng tiền cần trả khi nhận:</Text>
          <Text style={styles.totalValue}>{formatVnd(totalAmount)}</Text>
        </View>
      </View>

      {/* Shipping Notice Card */}
      <View style={styles.noticeCard}>
        <Text style={styles.noticeTitle}>🚚 Thời gian giao hàng dự kiến</Text>
        <Text style={styles.noticeText}>
          • Nội thành: 1 - 2 ngày làm việc.{"\n"}
          • Ngoại thành & Tỉnh khác: 2 - 4 ngày làm việc.{"\n"}
          • Nhân viên giao hàng sẽ gọi điện cho bạn trước khi giao. Vui lòng chuẩn bị đúng số tiền <Text style={{ fontWeight: '700' }}>{formatVnd(totalAmount)}</Text> khi nhận hàng.
        </Text>
      </View>

      {/* Action Buttons */}
      <View style={styles.actions}>
        <Button title="Tiếp tục mua sắm →" onPress={() => router.replace('/')} style={{ marginBottom: 12 }} />
        <Button title="Về danh mục sản phẩm" variant="outline" onPress={() => router.replace('/products')} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: 18, paddingBottom: 50 },

  headerCard: { backgroundColor: '#fff', borderRadius: 16, padding: 24, alignItems: 'center', marginBottom: 16, borderWidth: 1, borderColor: theme.colors.border },
  iconBg: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#ECFDF5', justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  icon: { fontSize: 36 },
  successTitle: { fontSize: 22, fontWeight: '800', color: theme.colors.ink, marginBottom: 8 },
  successSubtitle: { fontSize: 13, color: theme.colors.muted, textAlign: 'center', lineHeight: 20 },
  orderIdBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginTop: 16, gap: 6 },
  orderIdLabel: { fontSize: 12, color: theme.colors.muted },
  orderIdValue: { fontSize: 13, fontWeight: '800', color: theme.colors.primary },

  card: { backgroundColor: '#fff', borderRadius: 16, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: theme.colors.border },
  cardTitle: { fontSize: 15, fontWeight: '800', color: theme.colors.ink, marginBottom: 14 },

  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  infoLabel: { fontSize: 13, color: theme.colors.muted },
  infoValue: { fontSize: 13, fontWeight: '700', color: theme.colors.ink },
  totalValue: { fontSize: 16, fontWeight: '800', color: theme.colors.primary },

  codBadge: { backgroundColor: '#FEF3C7', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  codBadgeText: { fontSize: 12, fontWeight: '700', color: '#B45309' },

  divider: { height: 1, backgroundColor: theme.colors.border, marginVertical: 10 },

  noticeCard: { backgroundColor: '#EFF6FF', borderRadius: 14, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: '#BFDBFE' },
  noticeTitle: { fontSize: 14, fontWeight: '800', color: '#1E40AF', marginBottom: 8 },
  noticeText: { fontSize: 12, color: '#1E3A8A', lineHeight: 20 },

  actions: { gap: 4 },
});
