import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { collectionsForAudience, homeSections, selectHomeProducts } from '../../data/home-sections';
import type { useCatalog } from '../../features/catalog/useCatalog';
import type { useHomeMerchandising } from '../../features/catalog/useHomeMerchandising';
import type { CustomerAudience } from '../../types/shop';
import { ProductSection } from './ProductSection';

type Props = { audience: CustomerAudience; catalog: ReturnType<typeof useCatalog>; merchandising: ReturnType<typeof useHomeMerchandising> };
/** Each audience page uses the same catalog and merchandise requests from the home screen. */
export function HomeProductSections({ audience, catalog, merchandising }: Props) {
  const products = catalog.data?.products ?? [];
  const collections = merchandising.collections.data ?? [];
  const availableCollections = collectionsForAudience(collections, products, audience);
  return <View style={styles.sections}>
    {homeSections.map(section => {
      const source = section.key === 'bestsellers' ? merchandising.bestsellers
        : section.key === 'collections' ? merchandising.collections : undefined;
      const selected = selectHomeProducts(products, section.key, { audience,
        bestSellers: merchandising.bestsellers.data ?? [], collections });
      const loading = catalog.loading || Boolean(source?.loading);
      const error = catalog.error ?? source?.error;
      return <ProductSection key={section.key} title={section.title} products={selected.slice(0, 4)}
        subtitle={section.key === 'bestsellers' ? 'Được mua nhiều trong 30 ngày qua'
          : section.key === 'collections' && availableCollections.length ? availableCollections.map(item => item.name).join(' · ') : undefined}
        loading={loading} error={error} onRetry={() => { if (catalog.error) catalog.retry(); else source?.retry(); }}
        emptyTitle={section.key === 'bestsellers' ? 'Chưa có dữ liệu bán chạy' : 'Chưa có sản phẩm'}
        emptyDescription={section.emptyDescription}
        onSeeAll={!loading && !error && selected.length ? () => router.push({ pathname: '/products', params: { audience, feed: section.key, section: '' } }) : undefined} />;
    })}
  </View>;
}
const styles = StyleSheet.create({ sections: { gap: 32, marginBottom: 36 } });
