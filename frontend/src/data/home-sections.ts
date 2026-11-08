import type { CustomerAudience, Product } from '../types/shop';
import { matchesAudience } from './customer-groups';

export type HomeFeedKey = 'new' | 'bestsellers' | 'offers' | 'collections';
export type BestSeller = { productId: string; unitsSold: number };
export type HomeCollection = { id: string; slug: string; name: string; description: string; productIds: string[] };
export const homeSections: { key: HomeFeedKey; title: string; emptyDescription: string }[] = [
  { key: 'new', title: 'Hàng mới', emptyDescription: 'Sản phẩm mới dành cho nhóm này đang được cập nhật.' },
  { key: 'bestsellers', title: 'Bán chạy', emptyDescription: 'Chưa có sản phẩm được mua trong các đơn hoàn thành trong 30 ngày qua.' },
  { key: 'offers', title: 'Ưu đãi', emptyDescription: 'Hiện chưa có sản phẩm giảm giá dành cho nhóm này.' },
  { key: 'collections', title: 'Bộ sưu tập', emptyDescription: 'Các bộ sưu tập dành cho nhóm này đang được cập nhật.' },
];
export function getHomeSection(key: string | undefined) { return homeSections.find(section => section.key === key); }
export function discountPercent(product: Product) {
  const base = product.basePriceVnd;
  return base && Number.isFinite(base) && base > 0 && Number.isFinite(product.priceVnd) && product.priceVnd > 0 && product.priceVnd < base
    ? Math.round((base - product.priceVnd) / base * 100) : 0;
}
function newestFirst(a: Product, b: Product) {
  const time = (value?: string) => { const parsed = Date.parse(value ?? ''); return Number.isFinite(parsed) ? parsed : 0; };
  return time(b.createdAt) - time(a.createdAt) || a.id.localeCompare(b.id);
}
export function selectHomeProducts(products: readonly Product[], feed: HomeFeedKey, options: {
  audience?: CustomerAudience; bestSellers?: readonly BestSeller[]; collections?: readonly HomeCollection[]; collectionSlug?: string;
} = {}): Product[] {
  const eligible = products.filter(product => !options.audience || matchesAudience(product, options.audience));
  if (feed === 'new') return eligible.sort(newestFirst);
  if (feed === 'offers') return eligible.filter(product => product.basePriceVnd != null && product.basePriceVnd > product.priceVnd && product.priceVnd > 0)
    .sort((a, b) => discountPercent(b) - discountPercent(a) || newestFirst(a, b));
  if (feed === 'bestsellers') {
    const sold = new Map((options.bestSellers ?? []).filter(row => Number.isFinite(row.unitsSold) && row.unitsSold > 0).map(row => [row.productId, row.unitsSold]));
    return eligible.filter(product => sold.has(product.id)).sort((a, b) => sold.get(b.id)! - sold.get(a.id)! || newestFirst(a, b));
  }
  const order = new Map<string, number>();
  for (const collection of options.collections ?? []) {
    if (options.collectionSlug && collection.slug !== options.collectionSlug) continue;
    for (const id of collection.productIds) if (!order.has(id)) order.set(id, order.size);
  }
  return eligible.filter(product => order.has(product.id)).sort((a, b) => order.get(a.id)! - order.get(b.id)!);
}
export function collectionsForAudience(collections: readonly HomeCollection[], products: readonly Product[], audience?: CustomerAudience) {
  const ids = new Set(products.filter(product => !audience || matchesAudience(product, audience)).map(product => product.id));
  return collections.filter(collection => collection.productIds.some(id => ids.has(id)));
}
