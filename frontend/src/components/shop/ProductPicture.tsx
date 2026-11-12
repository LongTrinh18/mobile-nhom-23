import { useState } from 'react';
import { Image } from 'expo-image';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { customerGroups, getCustomerGroup, matchesBrowseCategory, normalizeSearch } from '../../data/customer-groups';
import { theme } from '../../theme/theme';
import type { Product } from '../../types/shop';

const atlas = require('../../../assets/images/catalog/category-atlas-v1.png');
type PictureProduct = Pick<Product, 'imageUrl' | 'category' | 'categorySlug' | 'audience' | 'name'>;

// Garment words in the product name are more specific than the category ("Quần kaki" vs "Quần jean").
const nameHints: [RegExp, { row: number; column: number }][] = [
  [/\b(kaki|khaki|ong rong)\b/, { row: 1, column: 3 }],
  [/\b(jean|jeans|denim)\b/, { row: 0, column: 2 }],
  [/\b(so mi|oxford)\b/, { row: 0, column: 1 }],
  [/\b(ao khoac|khoac gio|hoodie)\b/, { row: 0, column: 3 }],
  [/\b(vay|dam)\b/, { row: 1, column: 2 }],
];

/** Which cell of the bundled 4×4 category atlas best represents a product without its own photo. */
export function atlasCellFor(product: Omit<PictureProduct, 'imageUrl' | 'name'> & { name?: string }): { row: number; column: number } {
  const name = normalizeSearch(product.name ?? '');
  const adult = !product.audience || product.audience === 'men' || product.audience === 'women' || product.audience === 'unisex';
  const hint = adult ? nameHints.find(([pattern]) => pattern.test(name))?.[1] : undefined;
  if (hint) return hint;
  const preferred = getCustomerGroup(product.audience === 'unisex' || !product.audience ? 'men' : product.audience) ?? customerGroups[0];
  for (const group of [preferred, ...customerGroups.filter(item => item !== preferred)]) {
    const category = group.categories.find(item => matchesBrowseCategory(product as Product, item.key));
    if (category) return { row: group.imageRow, column: category.imageColumn };
  }
  return { row: preferred.imageRow, column: 0 };
}

/** Crops one square atlas cell to cover a frame of any aspect ratio. */
export function AtlasPicture({ row, column, style }: { row: number; column: number; style?: StyleProp<ViewStyle> }) {
  const [frame, setFrame] = useState({ width: 0, height: 0 });
  const cell = Math.max(frame.width, frame.height);
  return <View accessible={false} style={[styles.frame, style]}
    onLayout={event => setFrame({ width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height })}>
    {cell > 0 && <Image source={atlas} accessible={false} contentFit="fill" cachePolicy="memory-disk"
      style={{ position: 'absolute', width: cell * 4, height: cell * 4,
        left: -column * cell - (cell - frame.width) / 2, top: -row * cell - (cell - frame.height) / 2 }} />}
  </View>;
}

/**
 * Product photo with a graceful fallback: until real photos are uploaded to the
 * product-images bucket, show the matching studio photo from the category atlas.
 */
export function ProductPicture({ product, style }: { product: PictureProduct | undefined; style?: StyleProp<ViewStyle> }) {
  const [failed, setFailed] = useState(false);
  const cell = atlasCellFor(product ?? { category: '', audience: 'men' });
  // The atlas photo sits underneath: it shows while the real photo loads and stays if that photo is missing (404).
  return <View style={[styles.frame, style]}>
    <AtlasPicture row={cell.row} column={cell.column} style={StyleSheet.absoluteFill} />
    {product?.imageUrl && !failed && <Image source={{ uri: product.imageUrl }} style={StyleSheet.absoluteFill} contentFit="cover"
      cachePolicy="memory-disk" transition={150} accessible={false} onError={() => setFailed(true)} />}
  </View>;
}

const styles = StyleSheet.create({ frame: { overflow: 'hidden', backgroundColor: theme.colors.canvas } });
