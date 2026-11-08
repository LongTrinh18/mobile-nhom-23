import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/shop/Button';
import { theme } from '../../theme/theme';
import { formatVnd } from '../../types/shop';

export default function OrderSuccessScreen() {
  const params = useLocalSearchParams<{ orderId?: string; orderCode?: string; name?: string; phone?: string;
    branchName?: string; totalVnd?: string; itemCount?: string }>();
  const validOrder = Boolean(params.orderId && params.orderCode);
  return <ScrollView style={styles.page} contentContainerStyle={styles.content}>
    <View style={styles.card}>
      <Text style={styles.title}>{validOrder ? 'Đặt hàng thành công!' : 'Chưa có thông tin đơn hàng'}</Text>
      {validOrder && <>
        <Text style={styles.name}>Mã đơn hàng: {params.orderCode}</Text>
        <Text>Đơn hàng đang chờ cửa hàng xác nhận. Vui lòng chờ thông báo sẵn sàng trước khi đến nhận.</Text>
        <Text>Người nhận: {params.name}</Text>
        <Text>Số điện thoại: {params.phone}</Text>
        <Text>Chi nhánh nhận hàng: {params.branchName}</Text>
        <Text>Số lượng: {params.itemCount}</Text>
        <Text style={styles.name}>Tổng tiền: {formatVnd(Number(params.totalVnd ?? 0))}</Text>
        <Text>Thanh toán tại cửa hàng khi nhận hàng.</Text>
      </>}
      <Button title="Tiếp tục mua sắm →" onPress={() => router.dismissTo('/')} />
      <Button title="Xem đơn hàng" variant="outline" onPress={() => router.dismissTo('/orders')} />
    </View>
  </ScrollView>;
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: 18, paddingBottom: 48 },
  card: { backgroundColor: '#fff', padding: 20, borderRadius: 12, gap: 18 },
  title: { fontSize: 24, fontWeight: '800', color: theme.colors.ink },
  name: { fontSize: 16, fontWeight: '700', color: theme.colors.ink },
});
