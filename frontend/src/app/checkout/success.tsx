import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../../components/ui/Text';
import { DestinationState } from '../../components/navigation/DestinationState';
import { Button } from '../../components/shop/Button';
import { Card, Divider, Notice, Row } from '../../components/ui/primitives';
import { theme } from '../../theme/theme';
import { formatVnd } from '../../types/shop';

type Params = { orderId?: string; orderCode?: string; fulfillmentType?: string; name?: string; phone?: string; address?: string;
  branchName?: string; branchAddress?: string; subtotal?: string; discount?: string; shipping?: string; totalVnd?: string;
  voucher?: string; itemCount?: string };
const money = (value?: string) => formatVnd(Number(value ?? 0) || 0);

export default function OrderSuccessScreen() {
  const params = useLocalSearchParams<Params>();
  const delivery = params.fulfillmentType === 'delivery';
  if (!params.orderId || !params.orderCode) {
    return <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <DestinationState icon="receipt-outline" title="Chưa có thông tin đơn hàng" description="Bạn có thể xem các đơn đã đặt trong mục Đơn hàng."
        actionLabel="Xem đơn hàng" onAction={() => router.dismissTo('/orders')} />
    </ScrollView>;
  }
  return <ScrollView style={styles.page} contentContainerStyle={styles.content}>
    <View style={styles.hero}>
      <View style={styles.check}><Ionicons name="checkmark" size={40} color="#fff" /></View>
      <Text accessibilityRole="header" style={styles.title}>Đặt hàng thành công!</Text>
      <Text style={styles.code} selectable>Mã đơn: {params.orderCode}</Text>
      <Text style={styles.sub}>{delivery
        ? 'Cửa hàng sẽ xác nhận và giao hàng đến bạn. Hãy để ý điện thoại khi shipper gọi.'
        : 'Đơn đang chờ cửa hàng xác nhận. Hãy đến nhận khi đơn chuyển sang “Sẵn sàng nhận”.'}</Text>
    </View>

    <Card>
      <View style={styles.infoRow}>
        <Ionicons name={delivery ? 'bicycle-outline' : 'storefront-outline'} size={22} color={theme.colors.primary} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.infoTitle}>{delivery ? 'Giao tận nơi' : 'Nhận tại ' + (params.branchName || 'cửa hàng')}</Text>
          <Text style={styles.infoText}>{delivery ? params.address : params.branchAddress}</Text>
          {delivery && !!params.branchName && <Text style={styles.infoText}>Giao từ {params.branchName}</Text>}
        </View>
      </View>
      <View style={styles.infoRow}>
        <Ionicons name="person-outline" size={22} color={theme.colors.primary} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.infoTitle}>{params.name}</Text>
          <Text style={styles.infoText}>{params.phone}</Text>
        </View>
      </View>
    </Card>

    <Card>
      <Row label={'Tiền hàng (' + (params.itemCount ?? '0') + ' sp)'} value={money(params.subtotal)} />
      {Number(params.discount) > 0 && <Row label={'Giảm giá' + (params.voucher ? ' (' + params.voucher + ')' : '')} value={'−' + money(params.discount)} valueColor={theme.colors.success} />}
      {delivery && <Row label="Phí giao hàng" value={Number(params.shipping) > 0 ? money(params.shipping) : 'Miễn phí'} />}
      <Divider />
      <Row label="Cần thanh toán" value={money(params.totalVnd)} strong />
      <Notice tone="success">{delivery ? 'Thanh toán tiền mặt cho shipper khi nhận hàng.' : 'Thanh toán tại quầy khi đến nhận hàng.'}</Notice>
    </Card>

    <Button title="Xem đơn hàng" icon="receipt-outline" onPress={() => router.dismissTo('/orders')} />
    <Button title="Tiếp tục mua sắm" variant="outline" onPress={() => router.dismissTo('/')} />
  </ScrollView>;
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: 16, paddingBottom: 40, gap: 12 },
  hero: { alignItems: 'center', gap: 8, paddingVertical: 20 },
  check: { width: 76, height: 76, borderRadius: 38, backgroundColor: theme.colors.success, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  title: { fontSize: 24, fontWeight: '900', color: theme.colors.ink },
  code: { fontSize: 15, fontWeight: '800', color: theme.colors.primary },
  sub: { fontSize: 14, lineHeight: 20, color: theme.colors.muted, textAlign: 'center', paddingHorizontal: 8 },
  infoRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  infoTitle: { fontSize: 15, fontWeight: '800', color: theme.colors.ink },
  infoText: { fontSize: 13, color: theme.colors.muted, lineHeight: 18 },
});
