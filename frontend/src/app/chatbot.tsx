import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { DestinationState } from '../components/navigation/DestinationState';
import { theme } from '../theme/theme';
export default function ChatbotScreen() {
  return <ScrollView style={styles.page} contentContainerStyle={styles.content}>
    <Text accessibilityRole="header" style={styles.title}>Chatbot AI</Text>
    <DestinationState icon="chatbubbles-outline" title="Trợ lý mua sắm AI"
      description="Tính năng tư vấn sản phẩm và kích thước sẽ sớm ra mắt. Trong lúc chờ, hãy khám phá sản phẩm trong danh mục."
      actionLabel="Tìm sản phẩm" onAction={() => router.navigate('/products')} />
  </ScrollView>;
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.colors.background }, content: { paddingTop: 24, paddingBottom: 32 },
  title: { marginHorizontal: 20, fontSize: 24, fontWeight: '800', color: theme.colors.ink },
});
