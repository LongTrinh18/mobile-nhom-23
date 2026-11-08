import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text, Pressable } from 'react-native';
import { ProductSection } from '../../components/shop/ProductSection';
import { getCustomerGroup, matchesAudience, matchesBrowseCategory, normalizeSearch } from '../../data/customer-groups';
import { collectionsForAudience, getHomeSection, selectHomeProducts } from '../../data/home-sections';
import { useCatalog } from '../../features/catalog/useCatalog';
import { useHomeMerchandising } from '../../features/catalog/useHomeMerchandising';
import { theme } from '../../theme/theme';

function single(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] ?? '' : value ?? ''; }
export default function ProductListScreen() {
  const catalog = useCatalog();
  const { data } = catalog;
  const params = useLocalSearchParams<{ q?: string | string[]; audience?: string | string[]; section?: string | string[];
    feed?: string | string[]; collection?: string | string[] }>();
  const query = single(params.q);
  const group = getCustomerGroup(single(params.audience));
  const section = single(params.section);
  const feed = getHomeSection(single(params.feed));
  const collectionSlug = single(params.collection);
  const merchandising = useHomeMerchandising({ bestsellers: feed?.key === 'bestsellers', collections: feed?.key === 'collections' });
  const source = feed?.key === 'bestsellers' ? merchandising.bestsellers : feed?.key === 'collections' ? merchandising.collections : undefined;
  const loading = catalog.loading || Boolean(source?.loading);
  const error = catalog.error ?? source?.error;
  const groupProducts = (data?.products ?? []).filter(product => !group || matchesAudience(product, group.key));
  const collections = collectionsForAudience(merchandising.collections.data ?? [], groupProducts);
  const candidates = feed ? selectHomeProducts(data?.products ?? [], feed.key, { audience: group?.key,
    bestSellers: merchandising.bestsellers.data ?? [], collections, collectionSlug }) : groupProducts;
  const categories = group ? group.categories.map(item => ({ key: item.key, label: item.label }))
    : [...new Set(groupProducts.map(product => product.category))].map(name => ({ key: name, label: name }));
  const filtered = candidates.filter(product => (!section || matchesBrowseCategory(product, section))
    && normalizeSearch(product.name).includes(normalizeSearch(query)));
  const selectedLabel = categories.find(category => category.key === section)?.label;
  const title = feed ? feed.title + (group ? ' · ' + group.label : '') : group ? 'Sản phẩm ' + group.label : 'Danh mục sản phẩm';
  return <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
    <Text accessibilityRole="header" style={styles.title}>{title}</Text>
    <Text style={styles.subtitle}>{selectedLabel ?? (feed?.key === 'bestsellers' ? 'Đơn hoàn thành trong 30 ngày qua' : 'Tất cả danh mục')}</Text>
    {!!query && <Text style={styles.searchSummary}>Kết quả tìm kiếm: “{query}”</Text>}
    {feed?.key === 'collections' && collections.length > 0 && <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filters}>
      {[{ slug: '', name: 'Tất cả bộ sưu tập' }, ...collections].map(collection => <Pressable key={collection.slug} accessibilityRole="button"
        accessibilityState={{ selected: collectionSlug === collection.slug }} onPress={() => router.setParams({ collection: collection.slug, section: '' })}
        style={[styles.chip, collectionSlug === collection.slug && styles.chipActive]}>
        <Text style={[styles.chipText, collectionSlug === collection.slug && styles.chipTextActive]}>{collection.name}</Text>
      </Pressable>)}
    </ScrollView>}
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filters}>
      {[{ key: '', label: 'Tất cả' }, ...categories].map(category => <Pressable key={category.key} accessibilityRole="button"
        accessibilityState={{ selected: section === category.key }} onPress={() => router.setParams({ section: category.key })}
        style={[styles.chip, section === category.key && styles.chipActive]}>
        <Text style={[styles.chipText, section === category.key && styles.chipTextActive]}>{category.label}</Text>
      </Pressable>)}
    </ScrollView>
    {data?.source === 'mock' && <Text style={styles.demo}>Đang hiển thị dữ liệu mẫu</Text>}
    <ProductSection products={filtered} loading={loading} error={error}
      onRetry={() => { if (catalog.error) catalog.retry(); else source?.retry(); }}
      emptyTitle="Chưa có sản phẩm phù hợp"
      emptyDescription={query || section ? 'Hãy thử danh mục khác hoặc đổi từ khóa tìm kiếm.'
        : feed ? feed.emptyDescription : groupProducts.length === 0 && group
        ? 'Sản phẩm dành cho ' + group.label.toLocaleLowerCase('vi') + ' đang được cập nhật.'
        : 'Hãy thử danh mục khác hoặc đổi từ khóa tìm kiếm.'}
      emptyAction={{ label: 'Quay lại danh mục', onPress: () => router.replace('/') }} />
  </ScrollView>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background }, content: { padding: 18, paddingBottom: 36 },
  title: { fontSize: 24, fontWeight: '800', color: theme.colors.ink }, subtitle: { color: theme.colors.muted, marginTop: 8, marginBottom: 18 },
  searchSummary: { color: theme.colors.ink, marginBottom: 16, fontWeight: '600' }, filters: { marginBottom: 16 },
  chip: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 18, borderWidth: 1, borderColor: theme.colors.border, marginRight: 8, backgroundColor: '#fff' },
  chipActive: { backgroundColor: theme.colors.ink, borderColor: theme.colors.ink },
  chipText: { fontSize: 12, fontWeight: '600', color: theme.colors.ink }, chipTextActive: { color: '#fff' },
  demo: { marginBottom: 14, color: '#765115', backgroundColor: '#FFF3D8', padding: 10, borderRadius: 8 },
});
