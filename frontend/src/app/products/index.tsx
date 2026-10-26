import { useMemo, useState } from 'react';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { ProductCard } from '../../components/shop/ProductCard';
import { CatalogStatus } from '../../components/shop/CatalogStatus';
import { Input } from '../../components/shop/Input';
import { useCatalog } from '../../features/catalog/useCatalog';
import { theme } from '../../theme/theme';

export default function ProductListScreen() {
  const { data, loading, error, retry } = useCatalog();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('Tất cả');
  const categories = useMemo(() => ['Tất cả', ...new Set(data?.products.map(p => p.category) ?? [])], [data]);
  const filtered = useMemo(() => (data?.products ?? []).filter(p =>
    (category === 'Tất cả' || p.category === category) && p.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())),
    [data, category, query]);
  return <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
    <Text style={styles.title}>Danh mục sản phẩm</Text>
    <Text style={styles.subtitle}>Chọn sản phẩm, size, màu và chi nhánh muốn mua.</Text>
    <Input value={query} onChangeText={setQuery} placeholder="Tìm kiếm sản phẩm..." />
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filters}>
      {categories.map(c => <Pressable key={c} onPress={() => setCategory(c)} style={[styles.chip, category === c && styles.chipActive]}>
        <Text style={[styles.chipText, category === c && styles.chipTextActive]}>{c}</Text>
      </Pressable>)}
    </ScrollView>
    {data?.source === 'mock' && <Text style={styles.demo}>Đang hiển thị dữ liệu mẫu</Text>}
    <CatalogStatus loading={loading} error={error} empty={Boolean(data && data.products.length === 0)} retry={retry} />
    {data && !loading && !error && (filtered.length ? <View style={styles.grid}>
      {filtered.map(product => <ProductCard key={product.id} product={product}
        onPress={() => router.push({ pathname: '/products/[id]', params: { id: product.id } })} />)}
    </View> : data.products.length > 0 ? <Text style={styles.empty}>Không có sản phẩm phù hợp bộ lọc.</Text> : null)}
  </ScrollView>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: 18, paddingBottom: 36 },
  title: { fontSize: 24, fontWeight: '800', color: theme.colors.ink },
  subtitle: { color: theme.colors.muted, marginTop: 8, marginBottom: 18 },
  filters: { marginBottom: 16 },
  chip: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 18, borderWidth: 1, borderColor: theme.colors.border, marginRight: 8, backgroundColor: '#fff' },
  chipActive: { backgroundColor: theme.colors.ink, borderColor: theme.colors.ink },
  chipText: { fontSize: 12, fontWeight: '600', color: theme.colors.ink },
  chipTextActive: { color: '#fff' },
  demo: { marginBottom: 14, color: '#765115', backgroundColor: '#FFF3D8', padding: 10, borderRadius: 8 },
  grid: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap' },
  empty: { textAlign: 'center', color: theme.colors.muted, marginTop: 40 },
});
