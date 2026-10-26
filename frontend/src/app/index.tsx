import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { Button } from '../components/shop/Button';
import { CatalogStatus } from '../components/shop/CatalogStatus';
import { ProductCard } from '../components/shop/ProductCard';
import { useCart } from '../context/CartContext';
import { useCatalog } from '../features/catalog/useCatalog';
import { theme } from '../theme/theme';

export default function HomeScreen() {
  const { data, loading, error, retry } = useCatalog();
  const { count } = useCart();
  return <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
    <View style={styles.topRow}>
      <Text style={styles.logo}>UNIQLO <Text style={styles.tag}>STUDENT DEMO</Text></Text>
      <Pressable onPress={() => router.push('/cart')} accessibilityRole="button" style={styles.cartPill}>
        <Text style={styles.cartText}>Giỏ hàng ({count})</Text>
      </Pressable>
    </View>
    <View style={styles.hero}>
      <Text style={styles.kicker}>NEW SEASON · EVERYDAY ESSENTIALS</Text>
      <Text style={styles.heroTitle}>Phong cách tối giản,{"\n"}thoải mái mỗi ngày.</Text>
      <Text style={styles.heroSubtitle}>Khám phá các thiết kế cơ bản phù hợp với mọi ngày.</Text>
      <Button title="Khám phá sản phẩm →" onPress={() => router.push('/products')} style={{ alignSelf: 'flex-start', marginTop: 14 }} />
    </View>
    <View style={styles.sectionHead}>
      <View><Text style={styles.sectionTitle}>Sản phẩm nổi bật</Text><Text style={styles.subtle}>Lựa chọn dành cho bạn</Text></View>
      <Pressable onPress={() => router.push('/products')}><Text style={styles.more}>Xem tất cả →</Text></Pressable>
    </View>
    {data?.source === 'mock' && <Text style={styles.demo}>DEMO · Dữ liệu mẫu. Chưa kết nối Supabase.</Text>}
    <CatalogStatus loading={loading} error={error} empty={Boolean(data && data.products.length === 0)} retry={retry} />
    {data && !loading && !error && <View style={styles.grid}>
      {data.products.slice(0, 4).map(product => <ProductCard key={product.id} product={product}
        onPress={() => router.push({ pathname: '/products/[id]', params: { id: product.id } })}/>) }
    </View>}
    <View style={styles.endRow}>
      <Pressable onPress={() => router.push('/account')}><Text style={styles.footerLink}>Tài khoản</Text></Pressable>
      <Text style={styles.footerInfo}>Nhóm 23 · Đồ án học phần</Text>
    </View>
  </ScrollView>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: 18, paddingBottom: 46 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  logo: { fontSize: 17, fontWeight: '900', letterSpacing: 0.4, color: theme.colors.primary },
  tag: { fontSize: 9, fontWeight: '500', color: theme.colors.muted },
  cartPill: { paddingVertical: 10, paddingHorizontal: 12, backgroundColor: '#fff', borderColor: theme.colors.border, borderWidth: 1, borderRadius: 20 },
  cartText: { fontSize: 12, fontWeight: '700', color: theme.colors.ink },
  hero: { backgroundColor: '#EBE8E3', padding: 20, borderRadius: 18, marginBottom: 26 },
  kicker: { fontSize: 10, fontWeight: '800', letterSpacing: 1.4, color: theme.colors.primary, marginBottom: 12 },
  heroTitle: { color: theme.colors.ink, fontSize: 27, fontWeight: '800', lineHeight: 35 },
  heroSubtitle: { color: '#555B61', fontSize: 14, marginTop: 10, lineHeight: 21 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 14 },
  sectionTitle: { fontSize: 19, fontWeight: '800', color: theme.colors.ink },
  subtle: { color: theme.colors.muted, fontSize: 12, marginTop: 4 },
  more: { color: theme.colors.primary, fontWeight: '700', fontSize: 12 },
  demo: { marginBottom: 14, backgroundColor: '#FFF3D8', padding: 10, borderRadius: 8, fontSize: 12, color: '#765115' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  endRow: { borderTopWidth: 1, borderTopColor: theme.colors.border, paddingTop: 22, flexDirection: 'row', justifyContent: 'space-between' },
  footerLink: { color: theme.colors.primary, fontWeight: '700' },
  footerInfo: { color: theme.colors.muted, fontSize: 12 },
});
