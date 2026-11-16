import { useCallback, useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../../components/ui/Text';
import { canCustomerCancel, cancelOrder, getOrderDetail, getOrders, type OrderListItem } from '../../api/orderApi';
import type { OrderDetail, OrderStatus } from '../../api/types';
import { DestinationState } from '../../components/navigation/DestinationState';
import { Button } from '../../components/shop/Button';
import { Badge, Card, Chip, Divider, Notice, Row } from '../../components/ui/primitives';
import { cartErrorMessage, useCart } from '../../context/CartContext';
import { confirmAction, notify } from '../../lib/feedback';
import { loginTarget } from '../../navigation/routes';
import { theme } from '../../theme/theme';
import { formatVnd } from '../../types/shop';

type Tone = 'info' | 'warning' | 'danger' | 'success' | 'neutral';
const statusInfo: Record<OrderStatus, { label: string; tone: Tone }> = {
  pending: { label: 'Chờ xác nhận', tone: 'warning' },
  confirmed: { label: 'Đã xác nhận', tone: 'info' },
  ready_for_pickup: { label: 'Sẵn sàng nhận', tone: 'success' },
  shipping: { label: 'Đang giao', tone: 'info' },
  delivered: { label: 'Đã giao', tone: 'success' },
  delivery_failed: { label: 'Giao thất bại', tone: 'danger' },
  completed: { label: 'Đã nhận hàng', tone: 'success' },
  cancelled: { label: 'Đã hủy', tone: 'neutral' },
  expired: { label: 'Quá hạn nhận', tone: 'danger' },
};
const filters = [
  { key: 'all', label: 'Tất cả', statuses: [] as OrderStatus[] },
  { key: 'active', label: 'Đang xử lý', statuses: ['pending', 'confirmed', 'ready_for_pickup', 'shipping'] as OrderStatus[] },
  { key: 'done', label: 'Hoàn thành', statuses: ['completed', 'delivered'] as OrderStatus[] },
  { key: 'closed', label: 'Đã hủy', statuses: ['cancelled', 'expired', 'delivery_failed'] as OrderStatus[] },
] as const;
const pickupSteps: OrderStatus[] = ['pending', 'confirmed', 'ready_for_pickup', 'completed'];
const deliverySteps: OrderStatus[] = ['pending', 'confirmed', 'shipping', 'delivered'];

function formatDate(value: string) {
  const date = new Date(value);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())} · ${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

function Progress({ order }: { order: OrderListItem }) {
  const steps = order.fulfillment_type === 'delivery' ? deliverySteps : pickupSteps;
  const index = steps.indexOf(order.status);
  if (index < 0) return null;
  return <View style={styles.progress}>
    {steps.map((step, i) => <View key={step} style={styles.progressStep}>
      <View style={[styles.progressDot, i <= index && styles.progressDotOn]}>{i < index && <Ionicons name="checkmark" size={12} color="#fff" />}</View>
      <Text style={[styles.progressLabel, i <= index && styles.progressLabelOn]} numberOfLines={2}>{statusInfo[step].label}</Text>
    </View>)}
  </View>;
}

function OrderCard({ order, onChanged }: { order: OrderListItem; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const status = statusInfo[order.status] ?? { label: order.status, tone: 'neutral' as Tone };
  const delivery = order.fulfillment_type === 'delivery';
  const itemCount = order.items?.reduce((sum, item) => sum + item.quantity, 0) ?? 0;

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && !detail) {
      setDetailError(null);
      getOrderDetail(order.id).then(setDetail).catch(e => setDetailError(cartErrorMessage(e)));
    }
  }
  async function cancel() {
    if (!(await confirmAction('Hủy đơn ' + order.order_code, 'Hàng đang giữ sẽ được trả lại cửa hàng. Bạn chắc chắn muốn hủy?', 'Hủy đơn', true))) return;
    setCancelling(true);
    try { await cancelOrder(order.id, 'Khách hủy trên ứng dụng'); onChanged(); }
    catch (e) { notify('Chưa hủy được đơn', cartErrorMessage(e)); }
    finally { setCancelling(false); }
  }
  return <Card>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel={'Đơn ' + order.order_code + ', ' + status.label}
      onPress={toggle} style={styles.cardHead}>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={styles.code}>{order.order_code}</Text>
        <Text style={styles.date}>{formatDate(order.created_at)}</Text>
      </View>
      <Badge label={status.label} tone={status.tone} />
    </Pressable>
    <View style={styles.where}>
      <Ionicons name={delivery ? 'bicycle-outline' : 'storefront-outline'} size={18} color={theme.colors.muted} />
      <Text style={styles.whereText} numberOfLines={2}>{delivery ? 'Giao đến: ' + (order.delivery_address ?? '') : 'Nhận tại: ' + (order.branch?.name ?? 'Cửa hàng')}</Text>
    </View>
    {order.status === 'ready_for_pickup' && order.pickup_deadline && <Notice tone="success">
      {'Hàng đã sẵn sàng. Vui lòng đến nhận trước ' + formatDate(order.pickup_deadline) + '.'}
    </Notice>}
    <View style={styles.totalRow}>
      <Text style={styles.count}>{itemCount} sản phẩm</Text>
      <Text style={styles.total}>{formatVnd(order.total_amount)}</Text>
    </View>
    <Pressable accessibilityRole="button" onPress={toggle} style={styles.more}>
      <Text style={styles.moreText}>{open ? 'Thu gọn' : 'Xem chi tiết'}</Text>
      <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={theme.colors.primary} />
    </Pressable>
    {open && <View style={styles.detail}>
      <Progress order={order} />
      {detailError ? <Notice tone="danger">{detailError}</Notice>
        : !detail ? <ActivityIndicator color={theme.colors.primary} />
        : detail.items.map(item => <View key={item.id} style={styles.line}>
          <Text style={styles.lineName} numberOfLines={2}>{item.variant?.product?.name ?? 'Sản phẩm'}
            <Text style={styles.lineMeta}>{item.variant ? '  ' + item.variant.color_name + ' · ' + item.variant.size : ''}</Text></Text>
          <Text style={styles.lineQty}>x{item.quantity}</Text>
          <Text style={styles.linePrice}>{formatVnd(item.unit_price * item.quantity)}</Text>
        </View>)}
      <Divider />
      <Row label="Tiền hàng" value={formatVnd(order.subtotal_amount ?? order.total_amount)} />
      {order.discount_amount > 0 && <Row label={'Giảm giá' + (order.voucher_code ? ' (' + order.voucher_code + ')' : '')} value={'−' + formatVnd(order.discount_amount)} valueColor={theme.colors.success} />}
      {delivery && <Row label="Phí giao hàng" value={order.shipping_fee ? formatVnd(order.shipping_fee) : 'Miễn phí'} />}
      <Row label="Người nhận" value={order.customer_name + ' · ' + order.customer_phone} />
      {!delivery && !!order.branch?.address && <Text style={styles.note}>{order.branch.address}</Text>}
      {!!order.note && <Text style={styles.note}>Ghi chú: {order.note}</Text>}
      {canCustomerCancel(order.status) && <Button title="Hủy đơn hàng" variant="danger" size="sm" icon="close-circle-outline" loading={cancelling} onPress={() => { void cancel(); }} />}
    </View>}
  </Card>;
}

export default function OrdersScreen() {
  const { userId, loading: authLoading } = useCart();
  const [attempt, setAttempt] = useState(0);
  const [filter, setFilter] = useState<(typeof filters)[number]['key']>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [result, setResult] = useState<{ owner: string; request: number; orders: OrderListItem[]; error: string | null } | null>(null);
  useFocusEffect(useCallback(() => {
    let active = true;
    if (!userId) return;
    void getOrders().then(orders => {
      if (active) setResult({ owner: userId, request: attempt, orders: orders.filter(order => order.user_id === userId), error: null });
    }).catch(error => {
      if (active) setResult({ owner: userId, request: attempt, orders: [], error: cartErrorMessage(error) });
    }).finally(() => { if (active) setRefreshing(false); });
    return () => { active = false; };
  }, [userId, attempt]));
  const reload = () => { setRefreshing(true); setAttempt(n => n + 1); };
  const current = result?.owner === userId ? result : null;
  const loading = authLoading || Boolean(userId && !current);
  const statuses = filters.find(item => item.key === filter)?.statuses ?? [];
  const visible = (current?.orders ?? []).filter(order => !statuses.length || (statuses as readonly OrderStatus[]).includes(order.status));
  const activeCount = (current?.orders ?? []).filter(order => (filters[1].statuses as readonly OrderStatus[]).includes(order.status)).length;

  return <ScrollView style={styles.page} contentContainerStyle={styles.content}
    refreshControl={userId ? <RefreshControl refreshing={refreshing} onRefresh={reload} tintColor={theme.colors.primary} colors={[theme.colors.primary]} /> : undefined}>
    <View style={styles.header}>
      <Text accessibilityRole="header" style={styles.title}>Đơn hàng của tôi</Text>
      {!!current?.orders.length && <Text style={styles.subtitle}>{activeCount ? activeCount + ' đơn đang xử lý · ' : ''}kéo xuống để cập nhật</Text>}
    </View>
    {loading ? <ActivityIndicator accessibilityLabel="Đang tải đơn hàng" color={theme.colors.primary} style={{ marginTop: 40 }} />
      : !userId ? <DestinationState icon="receipt-outline" title="Theo dõi đơn hàng của bạn"
        description="Đăng nhập để xem đơn hàng và trạng thái nhận hàng tại cửa hàng."
        actionLabel="Đăng nhập" onAction={() => router.push(loginTarget({ pathname: '/orders' }) as never)} />
      : current?.error ? <DestinationState icon="cloud-offline-outline" title="Chưa tải được đơn hàng" description={current.error}
        actionLabel="Thử lại" onAction={() => { setResult(null); setAttempt(n => n + 1); }} />
      : !current?.orders.length ? <DestinationState icon="bag-outline" title="Bạn chưa có đơn hàng"
        description="Đơn hàng đã đặt sẽ xuất hiện tại đây để bạn theo dõi."
        actionLabel="Khám phá sản phẩm" onAction={() => router.navigate('/products')} />
      : <>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {filters.map(item => <Chip key={item.key} label={item.label} selected={filter === item.key} onPress={() => setFilter(item.key)} />)}
        </ScrollView>
        {visible.length ? visible.map(order => <OrderCard key={order.id + order.status} order={order} onChanged={reload} />)
          : <Text style={styles.empty}>Không có đơn nào trong mục này.</Text>}
      </>}
  </ScrollView>;
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.colors.background }, content: { padding: 16, paddingBottom: 32, gap: 12 },
  header: { gap: 2 },
  title: { fontSize: 24, fontWeight: '800', color: theme.colors.ink }, subtitle: { fontSize: 13, color: theme.colors.muted },
  filters: { gap: 8, paddingRight: 8 },
  empty: { textAlign: 'center', color: theme.colors.muted, marginTop: 24 },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  code: { fontWeight: '800', fontSize: 16, color: theme.colors.ink }, date: { color: theme.colors.muted, fontSize: 12 },
  where: { flexDirection: 'row', gap: 8, alignItems: 'center' }, whereText: { flex: 1, color: theme.colors.text, fontSize: 13 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  count: { color: theme.colors.muted, fontSize: 13 }, total: { color: theme.colors.ink, fontWeight: '900', fontSize: 17 },
  more: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, minHeight: 36, borderTopWidth: 1, borderTopColor: theme.colors.soft, paddingTop: 8 },
  moreText: { color: theme.colors.primary, fontWeight: '700', fontSize: 13 },
  detail: { gap: 10 },
  progress: { flexDirection: 'row', gap: 4, paddingVertical: 4 },
  progressStep: { flex: 1, alignItems: 'center', gap: 6 },
  progressDot: { width: 22, height: 22, borderRadius: 11, backgroundColor: theme.colors.border, alignItems: 'center', justifyContent: 'center' },
  progressDotOn: { backgroundColor: theme.colors.success },
  progressLabel: { fontSize: 11, color: theme.colors.subtle, textAlign: 'center' },
  progressLabelOn: { color: theme.colors.ink, fontWeight: '700' },
  line: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  lineName: { flex: 1, fontSize: 13, fontWeight: '700', color: theme.colors.ink },
  lineMeta: { fontWeight: '400', color: theme.colors.muted, fontSize: 12 },
  lineQty: { fontSize: 13, color: theme.colors.muted },
  linePrice: { fontSize: 13, fontWeight: '700', color: theme.colors.ink, minWidth: 82, textAlign: 'right' },
  note: { fontSize: 12, color: theme.colors.muted, lineHeight: 17 },
});
