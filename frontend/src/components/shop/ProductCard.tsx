import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '../../theme/theme';
import { formatVnd, type Product } from '../../types/shop';

type Props = { product: Product; onPress: () => void; width?: number | `${number}%` };

export function ProductCard({ product, onPress, width = '48%' }: Props) {
  return (
    <Pressable style={[styles.card, { width }]} onPress={onPress} accessibilityRole="button" accessibilityLabel={`Xem ${product.name}`}>
      <View style={styles.media}>
        {product.imageUrl ? <Image source={{ uri: product.imageUrl }} style={styles.image} resizeMode="cover" /> :
          <View style={styles.placeholder}><Text style={styles.emoji}>👕</Text><Text style={styles.placeholderText}>Ảnh sản phẩm</Text></View>}
      </View>
      <Text style={styles.category}>{product.category.toUpperCase()}</Text>
      <Text style={styles.name} numberOfLines={2}>{product.name}</Text>
      <Text style={styles.price}>{formatVnd(product.priceVnd)}</Text>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  card: { marginBottom: 18 },
  media: { width: '100%', height: 168, backgroundColor: '#F1F0ED', borderRadius: theme.radius.md, overflow: 'hidden', marginBottom: 9 },
  image: { width: '100%', height: '100%' },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 44 },
  placeholderText: { color: theme.colors.muted, fontSize: 11, marginTop: 10 },
  category: { fontSize: 10, color: theme.colors.muted, letterSpacing: 1.1, marginBottom: 5 },
  name: { fontSize: 14, fontWeight: '600', color: theme.colors.ink, minHeight: 36 },
  price: { fontSize: 15, fontWeight: '800', color: theme.colors.primary, marginTop: 2 },
});
