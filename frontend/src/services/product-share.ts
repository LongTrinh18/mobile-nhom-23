import * as Linking from 'expo-linking';
import { Platform, Share } from 'react-native';
import { formatVnd, type Product } from '../types/shop';

export async function shareProduct(product: Pick<Product, 'id' | 'name' | 'priceVnd'>): Promise<'shared' | 'copied' | 'dismissed'> {
  const url = Linking.createURL('/products/' + encodeURIComponent(product.id));
  const text = product.name + '\n' + formatVnd(product.priceVnd);
  if (Platform.OS === 'web') {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try { await navigator.share({ title: product.name, text, url }); return 'shared'; }
      catch (error) { if (error instanceof Error && error.name === 'AbortError') return 'dismissed'; throw error; }
    }
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url); return 'copied';
    }
    throw new Error('Trình duyệt chưa hỗ trợ chia sẻ hoặc sao chép liên kết.');
  }
  const result = await Share.share({ title: product.name, message: text + '\n' + url }, { dialogTitle: 'Chia sẻ sản phẩm' });
  return result.action === Share.dismissedAction ? 'dismissed' : 'shared';
}
