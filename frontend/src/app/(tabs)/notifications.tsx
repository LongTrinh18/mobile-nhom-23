import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { DestinationState } from '../../components/navigation/DestinationState';
import { theme } from '../../theme/theme';
export default function NotificationsScreen() {
  return <ScrollView style={styles.page} contentContainerStyle={styles.content}>
    <Text accessibilityRole="header" style={styles.title}>Thông báo</Text>
    <DestinationState icon="notifications-outline" title="Thông báo sẽ sớm ra mắt"
      description="Bạn có thể theo dõi các đơn đã đặt trong mục Đơn hàng."
      actionLabel="Xem đơn hàng" onAction={() => router.navigate('/orders')} />
  </ScrollView>;
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.colors.background }, content: { paddingTop: 24, paddingBottom: 32 },
  title: { marginHorizontal: 20, fontSize: 24, fontWeight: '800', color: theme.colors.ink },
});
