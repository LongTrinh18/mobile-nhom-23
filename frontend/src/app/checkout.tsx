/** Temporary COD form for N7 demo. Person C owns final checkout UX (C05). */
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Input } from '../components/shop/Input';
import { Button } from '../components/shop/Button';
import { useCart } from '../context/CartContext';
import { theme } from '../theme/theme';
import { formatVnd } from '../types/shop';

export default function CheckoutScreen() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const { items, count, totalVnd, clearCart } = useCart();
  const nameError = !name.trim() ? 'Vui lòng nhập tên người nhận.' : '';
  const phoneError = !/^(0|\+84)\d{9}$/.test(phone.replace(/\s/g, '')) ? 'Số điện thoại chưa hợp lệ.' : '';
  const addressError = !address.trim() ? 'Vui lòng nhập địa chỉ.' : '';

  function demoOrder() {
    setSubmitted(true);
    if (!items.length || nameError || phoneError || addressError) return;
    // No SQL insert and no payment is performed in week 1.
    Alert.alert('Đặt hàng DEMO thành công', `Đã mô phỏng ${count} sản phẩm (${formatVnd(totalVnd)}). Không có đơn hàng thực tế.`, [
      { text: 'Về trang chủ', onPress: () => { clearCart(); router.replace('/'); } },
    ]);
  }

  return <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
    <Text style={styles.title}>Thông tin nhận hàng</Text>
    <Text style={styles.banner}>DEMO · Chưa tạo đơn trong Supabase và chưa thanh toán.</Text>
    <Input label="Người nhận" placeholder="Họ và tên" value={name} onChangeText={setName} error={submitted ? nameError : undefined}/>
    <Input label="Số điện thoại" placeholder="0xxxxxxxxx" keyboardType="phone-pad" value={phone} onChangeText={setPhone} error={submitted ? phoneError : undefined}/>
    <Input label="Địa chỉ nhận hàng" placeholder="Số nhà, đường, phường, thành phố" multiline value={address} onChangeText={setAddress} error={submitted ? addressError : undefined}/>
    <View style={styles.pay}><Text style={styles.payTitle}>Phương thức thanh toán</Text><Text style={styles.payText}>✓ COD · Thanh toán khi nhận hàng</Text></View>
    <View style={styles.summary}><Text style={styles.payTitle}>Tóm tắt đơn</Text>
      <Text style={styles.count}>{count} sản phẩm</Text><Text style={styles.total}>{formatVnd(totalVnd)}</Text></View>
    <Button title="Xác nhận đặt hàng DEMO" onPress={demoOrder} disabled={!items.length}/>
    {!items.length && <Text style={styles.hint}>Giỏ trống, hãy chọn sản phẩm trước khi đặt hàng.</Text>}
  </ScrollView>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: 18, paddingBottom: 50 },
  title: { fontSize: 23, fontWeight: '800', color: theme.colors.ink, marginBottom: 12 },
  banner: { backgroundColor: '#FFF3D8', color: '#765115', padding: 12, borderRadius: 9, marginBottom: 22, lineHeight: 20 },
  pay: { padding: 16, backgroundColor: '#fff', borderRadius: 12, marginVertical: 16 },
  payTitle: { fontWeight: '700', fontSize: 15, marginBottom: 10, color: theme.colors.ink },
  payText: { fontSize: 14, color: theme.colors.success },
  summary: { padding: 16, backgroundColor: '#fff', borderRadius: 12, marginBottom: 18 },
  count: { color: theme.colors.muted },
  total: { fontWeight: '800', fontSize: 21, color: theme.colors.primary, marginTop: 8 },
  hint: { textAlign: 'center', color: theme.colors.muted, marginTop: 12 },
});
