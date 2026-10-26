import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Button } from './Button';
import { theme } from '../../theme/theme';

export function CatalogStatus({ loading, error, empty, retry }: { loading: boolean; error: string | null; empty?: boolean; retry: () => void }) {
  if (loading) return <View style={styles.area}><ActivityIndicator size="large" color={theme.colors.primary}/><Text style={styles.text}>Đang tải sản phẩm...</Text></View>;
  if (error) return <View style={styles.area}><Text style={styles.title}>Không tải được dữ liệu</Text><Text style={styles.text}>{error}</Text><Button title="Thử lại" onPress={retry} style={{ marginTop: 14 }} /></View>;
  if (empty) return <View style={styles.area}><Text style={styles.title}>Chưa có sản phẩm</Text><Text style={styles.text}>Hãy kiểm tra dữ liệu và chính sách đọc trong Supabase.</Text></View>;
  return null;
}
const styles = StyleSheet.create({
  area: { padding: 26, minHeight: 230, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 18, fontWeight: '700', color: theme.colors.ink, marginBottom: 8, textAlign: 'center' },
  text: { marginTop: 8, textAlign: 'center', color: theme.colors.muted, lineHeight: 21 },
});
