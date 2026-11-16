import { router, useLocalSearchParams, usePathname } from 'expo-router';
import { Pressable, StyleSheet, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from '../ui/Text';
import { Price } from '../ui/Price';
import { theme } from '../../theme/theme';
import { formatVnd, type Product } from '../../types/shop';
import { discountPercent } from '../../data/home-sections';
import { swatchColor, swatchNeedsBorder } from '../../data/colors';
import { productTarget, routeContext } from '../../navigation/routes';
import { ProductPicture } from './ProductPicture';

export type ProductCardProps = {
  product: Product;
  onPress?: (product: Product) => void;
  width?: DimensionValue;
  style?: StyleProp<ViewStyle>;
};

export function Swatches({ colors, size = 10 }: { colors: string[]; size?: number }) {
  return <View style={styles.swatches}>
    {colors.slice(0, 5).map(name => {
      const hex = swatchColor(name);
      return <View key={name} accessibilityLabel={'Màu ' + name}
        style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: hex }, swatchNeedsBorder(hex) && styles.swatchBorder]} />;
    })}
    {colors.length > 5 && <Text style={styles.more}>+{colors.length - 5}</Text>}
  </View>;
}

export function Tag({ label, tone = 'primary' }: { label: string; tone?: 'primary' | 'neutral' | 'success' }) {
  return <View style={[styles.tag, tone === 'neutral' && styles.tagNeutral, tone === 'success' && styles.tagSuccess]}>
    <Text style={[styles.tagText, tone === 'neutral' && styles.tagTextNeutral, tone === 'success' && styles.tagTextSuccess]}>{label}</Text>
  </View>;
}

/** A single product tile. Its container owns spacing and column width. */
export function ProductCard({ product, onPress, width = '100%', style }: ProductCardProps) {
  const pathname = usePathname();
  const params = useLocalSearchParams();
  const discount = discountPercent(product);
  const sizes = [...new Set(product.variants.map(variant => variant.size))];
  const colors = [...new Set(product.variants.map(variant => variant.color))];
  function openProduct() {
    if (onPress) onPress(product);
    else router.push(productTarget(product.id, { ...routeContext(params), origin: pathname === '/' ? 'home' : pathname === '/cart' ? 'cart' : 'products' }));
  }
  return <Pressable accessibilityRole="button" accessibilityLabel={'Xem ' + product.name + ', ' + formatVnd(product.priceVnd)}
    accessibilityHint="Mở chi tiết sản phẩm" onPress={openProduct}
    style={({ pressed }) => [styles.card, { width }, style, pressed && styles.pressed]}>
    <ProductPicture product={product} style={styles.media} />
    <View style={styles.body}>
      <Text style={styles.name} numberOfLines={2}>{product.name}</Text>
      <View style={styles.tags}>
        {discount > 0 && <Tag label={'-' + discount + '%'} />}
        {sizes.length > 0 && <Tag tone="neutral" label={sizes.length > 1 ? sizes[0] + '–' + sizes[sizes.length - 1] : sizes[0]} />}
        <Swatches colors={colors} />
      </View>
      <View style={styles.priceRow}>
        <Price value={product.priceVnd} size={16} />
        {discount > 0 && <Price value={product.basePriceVnd!} size={11} weight="500" color={theme.colors.subtle} strike />}
      </View>
    </View>
  </Pressable>;
}
const styles = StyleSheet.create({
  card: { minWidth: 0, backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, overflow: 'hidden' },
  pressed: { opacity: 0.85 },
  media: { width: '100%', aspectRatio: 1 },
  body: { padding: 8, gap: 6 },
  name: { fontSize: 13, lineHeight: 18, color: theme.colors.ink, minHeight: 36 },
  tags: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4, minHeight: 18 },
  tag: { paddingHorizontal: 4, height: 18, justifyContent: 'center', borderRadius: 3, backgroundColor: theme.colors.primarySoft },
  tagNeutral: { backgroundColor: theme.colors.soft },
  tagSuccess: { backgroundColor: theme.colors.successSoft },
  tagText: { fontSize: 10, lineHeight: 13, fontWeight: '600', color: theme.colors.primary },
  tagTextNeutral: { color: theme.colors.muted },
  tagTextSuccess: { color: theme.colors.success },
  swatches: { flexDirection: 'row', alignItems: 'center', gap: 3, marginLeft: 2 },
  swatchBorder: { borderWidth: 1, borderColor: theme.colors.borderStrong },
  more: { fontSize: 10, color: theme.colors.muted, marginLeft: 2 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', columnGap: 6 },
});
