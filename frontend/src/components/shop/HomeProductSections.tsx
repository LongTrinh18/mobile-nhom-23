import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Text } from '../ui/Text';
import { collectionsForAudience, selectHomeProducts, type HomeFeedKey } from '../../data/home-sections';
import type { useCatalog } from '../../features/catalog/useCatalog';
import type { useHomeMerchandising } from '../../features/catalog/useHomeMerchandising';
import { theme } from '../../theme/theme';
import type { CustomerAudience } from '../../types/shop';
import { ProductSection } from './ProductSection';

type Props = { audience: CustomerAudience; catalog: ReturnType<typeof useCatalog>; merchandising: ReturnType<typeof useHomeMerchandising> };
const shelves: { key: Exclude<HomeFeedKey, 'new'>; title: string; subtitle?: string }[] = [
  { key: 'offers', title: '🔥 Ưu đãi hôm nay', subtitle: 'Đang giảm so với giá gốc' },
  { key: 'bestsellers', title: 'Bán chạy', subtitle: 'Được mua nhiều trong 30 ngày qua' },
  { key: 'collections', title: 'Bộ sưu tập' },
];

/** Each audience page uses the same catalog and merchandise requests from the home screen. */
export function HomeProductSections({ audience, catalog, merchandising }: Props) {
  const products = catalog.data?.products ?? [];
  const collections = merchandising.collections.data ?? [];
  const availableCollections = collectionsForAudience(collections, products, audience);
  const forYou = selectHomeProducts(products, 'new', { audience });
  const seeAll = (feed: HomeFeedKey) => router.push({ pathname: '/products', params: { audience, feed, section: '' } });
  return <View style={styles.sections}>
    {shelves.map(shelf => {
      const source = shelf.key === 'bestsellers' ? merchandising.bestsellers : shelf.key === 'collections' ? merchandising.collections : undefined;
      const selected = selectHomeProducts(products, shelf.key, { audience, bestSellers: merchandising.bestsellers.data ?? [], collections });
      const loading = catalog.loading || Boolean(source?.loading);
      // Optional shelves disappear when empty or unavailable; the full list page still explains why.
      if (catalog.error || (!loading && (source?.error || !selected.length))) return null;
      return <View key={shelf.key} style={styles.panel}>
        <ProductSection title={shelf.title} products={selected.slice(0, 10)} layout="horizontal" horizontalCardWidth={128}
          subtitle={shelf.key === 'collections' && availableCollections.length ? availableCollections.map(item => item.name).join(' · ') : shelf.subtitle}
          loading={loading} onSeeAll={!loading && selected.length ? () => seeAll(shelf.key) : undefined} />
      </View>;
    })}
    <View style={styles.forYouHeader}>
      <View style={styles.line} />
      <Text accessibilityRole="header" style={styles.forYouTitle}>Dành cho bạn</Text>
      <View style={styles.line} />
    </View>
    <ProductSection products={forYou} loading={catalog.loading} error={catalog.error} onRetry={catalog.retry}
      emptyTitle="Chưa có sản phẩm" emptyDescription="Sản phẩm cho nhóm này đang được cập nhật." />
  </View>;
}
const styles = StyleSheet.create({
  sections: { gap: 8 },
  panel: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, padding: 12 },
  forYouHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 24 },
  line: { flex: 1, height: 1, backgroundColor: theme.colors.borderStrong },
  forYouTitle: { fontSize: 15, fontWeight: '700', color: theme.colors.ink },
});
