import { router } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';
import { Text } from '../../components/ui/Text';
import { DestinationState } from '../../components/navigation/DestinationState';
import { theme } from '../../theme/theme';
export default function NotificationsScreen() {
  return <ScrollView style={styles.page} contentContainerStyle={styles.content}>
    <Text accessibilityRole="header" style={styles.title}>Thông báo</Text>
    <DestinationState icon="notifications-outline" title="Chưa có thông báo"
      description="Trạng thái đơn hàng (đã xác nhận, sẵn sàng nhận, đang giao…) được cập nhật trong mục Đơn hàng."
      actionLabel="Xem đơn hàng" onAction={() => router.navigate('/orders')} />
  </ScrollView>;
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.colors.background }, content: { paddingTop: 16, paddingBottom: 32 },
  title: { marginHorizontal: 16, fontSize: 24, fontWeight: '800', color: theme.colors.ink },
});
