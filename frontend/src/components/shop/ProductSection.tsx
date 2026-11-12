import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from '../ui/Text';
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
  onProductPress, onSeeAll, seeAllLabel = 'Xem thêm', loading = false, error, onRetry,
  emptyTitle = 'Chưa có sản phẩm', emptyDescription = 'Sản phẩm đang được cập nhật.', emptyAction, style,
}: ProductSectionProps) {
  return <View style={[styles.section, style]}>
    {(title || subtitle || onSeeAll) && <View style={styles.header}>
      <View style={styles.heading}>
        {!!title && <Text accessibilityRole="header" style={styles.title}>{title}</Text>}
        {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>
      {onSeeAll && <Pressable accessibilityRole="button" accessibilityLabel={title ? seeAllLabel + ' · ' + title : seeAllLabel}
        onPress={onSeeAll} style={styles.seeAll} hitSlop={6}><Text style={styles.seeAllText}>{seeAllLabel} ›</Text></Pressable>}
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
      {products.map(product => <ProductCard key={product.id} product={product} width="49%" onPress={onProductPress} />)}
    </View>}
  </View>;
}
const styles = StyleSheet.create({
  section: { gap: 10 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  heading: { flex: 1, minWidth: 120, gap: 2 },
  title: { fontSize: 16, fontWeight: '700', color: theme.colors.ink },
  subtitle: { color: theme.colors.muted, fontSize: 12, lineHeight: 17 },
  seeAll: { minHeight: 36, justifyContent: 'center', paddingLeft: 8 },
  seeAllText: { color: theme.colors.muted, fontSize: 12, fontWeight: '500' },
  grid: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', rowGap: 8 },
  horizontal: { gap: 8, paddingRight: 12 },
  state: { paddingVertical: 28, paddingHorizontal: 16, minHeight: 160, gap: 12, alignItems: 'center', justifyContent: 'center',
    backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg },
  stateTitle: { fontSize: 16, fontWeight: '700', color: theme.colors.ink, textAlign: 'center' },
  description: { color: theme.colors.muted, fontSize: 13, lineHeight: 19, textAlign: 'center' },
});
