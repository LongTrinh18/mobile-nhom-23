import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../../components/ui/Text';
import { ProductSection } from '../../components/shop/ProductSection';
import { Chip, Notice } from '../../components/ui/primitives';
import { getCustomerGroup, matchesAudience, matchesBrowseCategory, normalizeSearch } from '../../data/customer-groups';
import { collectionsForAudience, getHomeSection, selectHomeProducts } from '../../data/home-sections';
import { useCatalog } from '../../features/catalog/useCatalog';
import { useHomeMerchandising } from '../../features/catalog/useHomeMerchandising';
import { theme } from '../../theme/theme';
import type { Product } from '../../types/shop';

type SortKey = 'default' | 'price_asc' | 'price_desc';
const sortOptions: { key: SortKey; label: string }[] = [
  { key: 'default', label: 'Phù hợp' }, { key: 'price_asc', label: 'Giá thấp → cao' }, { key: 'price_desc', label: 'Giá cao → thấp' },
];
function single(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] ?? '' : value ?? ''; }
function sortProducts(products: Product[], sort: SortKey) {
  if (sort === 'default') return products;
  return [...products].sort((a, b) => sort === 'price_asc' ? a.priceVnd - b.priceVnd : b.priceVnd - a.priceVnd);
}
export default function ProductListScreen() {
  const catalog = useCatalog();
  const { data } = catalog;
  const [sort, setSort] = useState<SortKey>('default');
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
  const filtered = sortProducts(candidates.filter(product => (!section || matchesBrowseCategory(product, section))
    && normalizeSearch(product.name).includes(normalizeSearch(query))), sort);
  const selectedLabel = categories.find(category => category.key === section)?.label;
  const title = query ? 'Tìm “' + query + '”' : feed ? feed.title + (group ? ' · ' + group.label : '') : group ? 'Sản phẩm ' + group.label : 'Tất cả sản phẩm';
  return <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <View style={styles.header}>
      <Text accessibilityRole="header" style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{loading ? 'Đang tải…' : filtered.length + ' sản phẩm'}
        {selectedLabel ? ' · ' + selectedLabel : feed?.key === 'bestsellers' ? ' · đơn hoàn thành 30 ngày qua' : ''}</Text>
    </View>
    {feed?.key === 'collections' && collections.length > 0 && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
      {[{ slug: '', name: 'Tất cả bộ sưu tập' }, ...collections].map(collection => <Chip key={collection.slug} label={collection.name}
        selected={collectionSlug === collection.slug} onPress={() => router.setParams({ collection: collection.slug, section: '' })} />)}
    </ScrollView>}
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
      {[{ key: '', label: 'Tất cả' }, ...categories].map(category => <Chip key={category.key || 'all'} label={category.label}
        selected={section === category.key} onPress={() => router.setParams({ section: category.key })} />)}
    </ScrollView>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
      {sortOptions.map(option => <Chip key={option.key} label={option.label} icon={option.key === 'default' ? 'swap-vertical' : undefined}
        selected={sort === option.key} onPress={() => setSort(option.key)} />)}
    </ScrollView>
    {data?.source === 'mock' && <Notice tone="warning">Đang hiển thị dữ liệu mẫu (chưa kết nối Supabase).</Notice>}
    <ProductSection products={filtered} loading={loading} error={error}
      onRetry={() => { if (catalog.error) catalog.retry(); else source?.retry(); }}
      emptyTitle="Chưa có sản phẩm phù hợp"
      emptyDescription={query || section ? 'Hãy thử danh mục khác hoặc đổi từ khóa tìm kiếm.'
        : feed ? feed.emptyDescription : groupProducts.length === 0 && group
        ? 'Sản phẩm dành cho ' + group.label.toLocaleLowerCase('vi') + ' đang được cập nhật.'
        : 'Hãy thử danh mục khác hoặc đổi từ khóa tìm kiếm.'}
      emptyAction={{ label: 'Về trang chủ', onPress: () => router.dismissTo('/') }} />
  </ScrollView>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background }, content: { padding: 8, paddingBottom: 28, gap: 10 },
  header: { gap: 2, paddingHorizontal: 6, paddingTop: 4 },
  title: { fontSize: 20, fontWeight: '700', color: theme.colors.ink }, subtitle: { color: theme.colors.muted, fontSize: 12 },
  filters: { gap: 8, paddingRight: 8 },
});
