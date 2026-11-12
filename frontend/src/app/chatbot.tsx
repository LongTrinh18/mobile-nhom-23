import { router } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';
import { Text } from '../components/ui/Text';
import { DestinationState } from '../components/navigation/DestinationState';
import { theme } from '../theme/theme';
export default function ChatbotScreen() {
  return <ScrollView style={styles.page} contentContainerStyle={styles.content}>
    <Text accessibilityRole="header" style={styles.title}>Trợ lý mua sắm AI</Text>
    <DestinationState icon="chatbubbles-outline" title="Sắp ra mắt"
      description="Trợ lý sẽ tư vấn size theo chiều cao, cân nặng và gợi ý sản phẩm. Trong lúc chờ, bạn có thể xem tồn kho từng cửa hàng ngay ở trang sản phẩm."
      actionLabel="Tìm sản phẩm" onAction={() => router.navigate('/products')} />
  </ScrollView>;
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.colors.background }, content: { paddingTop: 16, paddingBottom: 32 },
  title: { marginHorizontal: 16, fontSize: 24, fontWeight: '800', color: theme.colors.ink },
});
