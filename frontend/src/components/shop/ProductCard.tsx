import { useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams, usePathname } from 'expo-router';
import { Pressable, StyleSheet, Text, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import { theme } from '../../theme/theme';
import { formatVnd, type Product } from '../../types/shop';
import { discountPercent } from '../../data/home-sections';
import { productTarget, routeContext } from '../../navigation/routes';

export type ProductCardProps = {
  product: Product;
  onPress?: (product: Product) => void;
  width?: DimensionValue;
  style?: StyleProp<ViewStyle>;
};

function ProductImage({ uri }: { uri?: string }) {
  const [failed, setFailed] = useState(false);
  return uri && !failed
    ? <Image source={{ uri }} style={styles.image} contentFit="cover" cachePolicy="memory-disk"
        accessible={false} onError={() => setFailed(true)} />
    : <View style={styles.placeholder} accessible={false}>
        <Ionicons name="shirt-outline" size={42} color={theme.colors.muted} />
        <Text style={styles.placeholderText}>Chưa có ảnh</Text>
      </View>;
}

/** A single product tile. Its container owns spacing and column width. */
export function ProductCard({ product, onPress, width = '100%', style }: ProductCardProps) {
  const pathname = usePathname();
  const params = useLocalSearchParams();
  const discount = discountPercent(product);
  const onSale = product.basePriceVnd != null && product.basePriceVnd > product.priceVnd && product.priceVnd > 0;
  function openProduct() {
    if (onPress) onPress(product);
    else router.push(productTarget(product.id, { ...routeContext(params), origin: pathname === '/' ? 'home' : pathname === '/cart' ? 'cart' : 'products' }));
  }
  return <Pressable accessibilityRole="button" accessibilityLabel={'Xem ' + product.name + ', ' + formatVnd(product.priceVnd)}
    accessibilityHint="Mở chi tiết sản phẩm" onPress={openProduct}
    style={({ pressed }) => [styles.card, { width }, style, pressed && styles.pressed]}>
    <View style={styles.media}>
      <ProductImage key={product.imageUrl ?? product.id} uri={product.imageUrl} />
      {discount > 0 && <View style={styles.discountBadge}><Text style={styles.discountText}>−{discount}%</Text></View>}
    </View>
    <Text style={styles.category} numberOfLines={1}>{product.category.toLocaleUpperCase('vi')}</Text>
    <Text style={styles.name} numberOfLines={2}>{product.name}</Text>
    <Text style={styles.price}>{formatVnd(product.priceVnd)}</Text>
    {onSale && <Text style={styles.originalPrice}>{formatVnd(product.basePriceVnd!)}</Text>}
  </Pressable>;
}
const styles = StyleSheet.create({
  card: { minWidth: 0 },
  pressed: { opacity: 0.7 },
  media: { width: '100%', aspectRatio: 3 / 4, backgroundColor: '#F1F0ED', borderRadius: theme.radius.sm, overflow: 'hidden', marginBottom: 10 },
  discountBadge: { position: 'absolute', left: 8, top: 8, backgroundColor: theme.colors.primary, paddingVertical: 4, paddingHorizontal: 7, borderRadius: 4 },
  discountText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  originalPrice: { color: theme.colors.muted, fontSize: 12, textDecorationLine: 'line-through', marginTop: 3 },
  image: { width: '100%', height: '100%' },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  placeholderText: { color: theme.colors.muted, fontSize: 12 },
  category: { fontSize: 10, color: theme.colors.muted, letterSpacing: 1, marginBottom: 5 },
  name: { fontSize: 14, lineHeight: 20, fontWeight: '600', color: theme.colors.ink, minHeight: 40 },
  price: { fontSize: 16, fontWeight: '800', color: theme.colors.primary, marginTop: 6 },
});
