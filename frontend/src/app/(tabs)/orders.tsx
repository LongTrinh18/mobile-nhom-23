import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getOrders } from '../../api/orderApi';
import type { OrderStatus } from '../../api/types';
import { DestinationState } from '../../components/navigation/DestinationState';
import { Button } from '../../components/shop/Button';
import { cartErrorMessage, useCart } from '../../context/CartContext';
import { theme } from '../../theme/theme';
import { formatVnd } from '../../types/shop';
import { loginTarget } from '../../navigation/routes';

type Orders = Awaited<ReturnType<typeof getOrders>>;
const statuses: Record<OrderStatus, string> = { pending: 'Chờ xác nhận', confirmed: 'Đã xác nhận', ready_for_pickup: 'Sẵn sàng nhận hàng',
  completed: 'Hoàn thành', cancelled: 'Đã hủy', expired: 'Hết hạn nhận hàng' };
export default function OrdersScreen() {
  const { userId, loading: authLoading } = useCart();
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ owner: string; request: number; orders: Orders; error: string | null } | null>(null);
  useFocusEffect(useCallback(() => {
    let active = true;
    if (!userId) return;
    void getOrders().then(orders => {
      if (active) setResult({ owner: userId, request: attempt, orders: orders.filter(order => order.user_id === userId), error: null });
    }).catch(error => {
      if (active) setResult({ owner: userId, request: attempt, orders: [], error: cartErrorMessage(error) });
    });
    return () => { active = false; };
  }, [userId, attempt]));
  const current = result?.owner === userId && result.request === attempt ? result : null;
  const loading = authLoading || Boolean(userId && !current);
  return <ScrollView style={styles.page} contentContainerStyle={styles.content}>
    <Text accessibilityRole="header" style={styles.title}>Đơn hàng của tôi</Text>
    {loading ? <ActivityIndicator accessibilityLabel="Đang tải đơn hàng" color={theme.colors.primary} style={{ marginTop: 40 }} />
      : !userId ? <DestinationState icon="receipt-outline" title="Theo dõi đơn hàng của bạn"
        description="Đăng nhập để xem đơn hàng và trạng thái nhận hàng tại cửa hàng."
        actionLabel="Đăng nhập" onAction={() => router.push(loginTarget({ pathname: '/orders' }))} />
      : current?.error ? <DestinationState icon="cloud-offline-outline" title="Chưa tải được đơn hàng" description={current.error}
        actionLabel="Thử lại" onAction={() => { setResult(null); setAttempt(n => n + 1); }} />
      : !current?.orders.length ? <DestinationState icon="bag-outline" title="Bạn chưa có đơn hàng"
        description="Đơn hàng đã đặt sẽ xuất hiện tại đây để bạn theo dõi."
        actionLabel="Khám phá sản phẩm" onAction={() => router.navigate('/products')} />
      : <View style={styles.list}>
        {current.orders.map(order => <View key={order.id} style={styles.card}>
          <View style={styles.row}><Text style={styles.code}>{order.order_code}</Text><Text style={styles.status}>{statuses[order.status]}</Text></View>
          <Text style={styles.note}>{new Date(order.created_at).toLocaleDateString('vi-VN')}</Text>
          <Text>Nhận tại: {order.branch?.name ?? 'Cửa hàng'}</Text><Text style={styles.total}>{formatVnd(order.total_amount)}</Text>
        </View>)}
        <Button title="Tải lại đơn hàng" variant="outline" onPress={() => { setResult(null); setAttempt(n => n + 1); }} />
      </View>}
  </ScrollView>;
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.colors.background }, content: { paddingTop: 24, paddingBottom: 32 },
  title: { marginHorizontal: 20, fontSize: 24, fontWeight: '800', color: theme.colors.ink }, list: { padding: 20, gap: 14 },
  card: { padding: 18, borderRadius: 12, backgroundColor: theme.colors.surface, gap: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  code: { fontWeight: '700', fontSize: 16, color: theme.colors.ink }, status: { color: theme.colors.primary, fontWeight: '600', fontSize: 12 },
  note: { color: theme.colors.muted, fontSize: 12 }, total: { color: theme.colors.ink, fontWeight: '700', fontSize: 17 },
});
