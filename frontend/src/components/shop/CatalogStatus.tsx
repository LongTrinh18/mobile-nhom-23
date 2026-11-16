import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Text } from '../ui/Text';
import { Button } from './Button';
import { theme } from '../../theme/theme';

export function CatalogStatus({ loading, error, empty, retry }: { loading: boolean; error: string | null; empty?: boolean; retry: () => void }) {
  if (loading) return <View style={styles.area}><ActivityIndicator size="large" color={theme.colors.primary} /><Text style={styles.text}>Đang tải sản phẩm…</Text></View>;
  if (error) return <View style={styles.area}>
    <Ionicons name="cloud-offline-outline" size={44} color={theme.colors.subtle} />
    <Text style={styles.title}>Không tải được dữ liệu</Text>
    <Text style={styles.text}>{/network|fetch/i.test(error) ? 'Kiểm tra kết nối mạng rồi thử lại.' : error}</Text>
    <Button title="Thử lại" icon="refresh" onPress={retry} style={{ marginTop: 8, alignSelf: 'stretch' }} />
  </View>;
  if (empty) return <View style={styles.area}><Text style={styles.title}>Chưa có sản phẩm</Text><Text style={styles.text}>Hãy kiểm tra dữ liệu và chính sách đọc trong Supabase.</Text></View>;
  return null;
}
const styles = StyleSheet.create({
  area: { padding: 28, minHeight: 260, justifyContent: 'center', alignItems: 'center', gap: 8 },
  title: { fontSize: 18, fontWeight: '800', color: theme.colors.ink, textAlign: 'center' },
  text: { textAlign: 'center', color: theme.colors.muted, lineHeight: 21 },
});
