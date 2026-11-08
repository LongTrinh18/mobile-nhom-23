import type { CartItem, Catalog } from '../types/shop';
import { firstParam, type RouteParams } from '../navigation/routes';
export type BuyNowDraft = { productId: string; variantId: string; quantity: number };
export function parseCheckoutIntent(params: RouteParams): { kind: 'cart' } | { kind: 'buy-now'; draft: BuyNowDraft } | { kind: 'invalid' } {
  const mode = firstParam(params.mode);
  if (!mode) return { kind: 'cart' };
  const productId = firstParam(params.productId), variantId = firstParam(params.variantId);
  const raw = firstParam(params.quantity), quantity = Number(raw);
  if (mode !== 'buy-now' || !/^[a-zA-Z0-9-]+$/.test(productId) || !/^[a-zA-Z0-9-]+$/.test(variantId)
    || !/^\d+$/.test(raw) || !Number.isInteger(quantity) || quantity < 1 || quantity > 10) return { kind: 'invalid' };
  return { kind: 'buy-now', draft: { productId, variantId, quantity } };
}
/** A single pickup branch must be able to fulfill the quantity; never sum stock from different stores. */
export function variantPurchaseLimit(catalog: Catalog, variantId: string) {
  if (!catalog.products.some(product => product.variants.some(variant => variant.id === variantId))) return 0;
  const active = new Set(catalog.branches.map(branch => branch.id));
  return Math.min(10, Math.max(0, ...catalog.stock.filter(row => row.skuId === variantId && active.has(row.branchId)).map(row => Math.floor(row.quantity))));
}
export function buyNowItem(catalog: Catalog, draft: BuyNowDraft, branchId: string): CartItem {
  const product = catalog.products.find(item => item.id === draft.productId);
  const variant = product?.variants.find(item => item.id === draft.variantId);
  if (!product || !variant) throw new Error('Sản phẩm hoặc phiên bản này hiện không còn bán.');
  if (!Number.isInteger(draft.quantity) || draft.quantity < 1 || draft.quantity > 10) throw new Error('Số lượng phải từ 1 đến 10.');
  const branch = catalog.branches.find(item => item.id === branchId);
  if (branchId && !branch) throw new Error('Chi nhánh không còn hoạt động. Vui lòng chọn lại.');
  const available = branch ? catalog.stock.find(row => row.skuId === variant.id && row.branchId === branch.id)?.quantity ?? 0 : 0;
  return { key: 'buy-now:' + variant.id, productId: product.id, productName: product.name,
    skuId: variant.id, skuCode: variant.sku, size: variant.size, color: variant.color,
    branchId: branch?.id ?? '', branchName: branch?.name ?? 'Chưa chọn chi nhánh', imageUrl: product.imageUrl,
    unitPriceVnd: product.priceVnd, quantity: draft.quantity, maxAvailable: Math.min(10, Math.max(0, available)) };
}
