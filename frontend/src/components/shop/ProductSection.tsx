import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { theme } from '../../theme/theme';
import type { Product } from '../../types/shop';
import { Button } from './Button';
import { ProductCard } from './ProductCard';

export type ProductSectionProps = {
  products: readonly Product[];
  title?: string;
  subtitle?: string;
  layout?: 'grid' | 'horizontal';
  horizontalCardWidth?: number;
  onProductPress?: (product: Product) => void;
  onSeeAll?: () => void;
  seeAllLabel?: string;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: { label: string; onPress: () => void };
  style?: StyleProp<ViewStyle>;
};

/** Presentational product collection; callers own fetching, filtering, and navigation overrides. */
export function ProductSection({ products, title, subtitle, layout = 'grid', horizontalCardWidth = 168,
  onProductPress, onSeeAll, seeAllLabel = 'Xem tất cả', loading = false, error, onRetry,
  emptyTitle = 'Chưa có sản phẩm', emptyDescription = 'Sản phẩm đang được cập nhật.', emptyAction, style,
}: ProductSectionProps) {
  return <View style={[styles.section, style]}>
    {(title || subtitle || onSeeAll) && <View style={styles.header}>
      <View style={styles.heading}>
        {!!title && <Text accessibilityRole="header" style={styles.title}>{title}</Text>}
        {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>
      {onSeeAll && <Pressable accessibilityRole="button" accessibilityLabel={title ? seeAllLabel + ' · ' + title : seeAllLabel}
        onPress={onSeeAll} style={styles.seeAll}><Text style={styles.seeAllText}>{seeAllLabel} →</Text></Pressable>}
    </View>}
    {loading ? <View style={styles.state}>
      <ActivityIndicator accessibilityLabel="Đang tải sản phẩm" color={theme.colors.primary} />
      <Text style={styles.description}>Đang tải sản phẩm...</Text>
    </View> : error ? <View style={styles.state}>
      <Text accessibilityRole="alert" style={styles.stateTitle}>Không tải được sản phẩm</Text>
      <Text style={styles.description}>{error}</Text>
      {onRetry && <Button title="Thử lại" onPress={onRetry} variant="outline" />}
    </View> : !products.length ? <View style={styles.state}>
      <Text style={styles.stateTitle}>{emptyTitle}</Text>
      {!!emptyDescription && <Text style={styles.description}>{emptyDescription}</Text>}
      {emptyAction && <Button title={emptyAction.label} onPress={emptyAction.onPress} variant="outline" />}
    </View> : layout === 'horizontal' ? <ScrollView horizontal showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.horizontal}>
      {products.map(product => <ProductCard key={product.id} product={product} width={horizontalCardWidth} onPress={onProductPress} />)}
    </ScrollView> : <View style={styles.grid}>
      {products.map(product => <ProductCard key={product.id} product={product} width="48%" onPress={onProductPress} />)}
    </View>}
  </View>;
}
const styles = StyleSheet.create({
  section: { gap: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' },
  heading: { flex: 1, minWidth: 120, gap: 5 },
  title: { fontSize: 20, fontWeight: '800', color: theme.colors.ink },
  subtitle: { color: theme.colors.muted, fontSize: 13, lineHeight: 19 },
  seeAll: { minHeight: 44, justifyContent: 'center', paddingVertical: 8 },
  seeAllText: { color: theme.colors.primary, fontSize: 13, fontWeight: '700' },
  grid: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', rowGap: 24 },
  horizontal: { gap: 14, paddingBottom: 4 },
  state: { paddingVertical: 32, paddingHorizontal: 16, minHeight: 180, gap: 14, alignItems: 'center', justifyContent: 'center' },
  stateTitle: { fontSize: 18, fontWeight: '700', color: theme.colors.ink, textAlign: 'center' },
  description: { color: theme.colors.muted, lineHeight: 21, textAlign: 'center' },
});
