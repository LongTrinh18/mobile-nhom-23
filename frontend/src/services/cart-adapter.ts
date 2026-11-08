import type { CartLine } from '../api/types';
import type { CartItem, Catalog } from '../types/shop';

/** The database cart has one row per SKU; pickup branch is chosen for the whole order. */
export function hydrateCart(rows: CartLine[], catalog: Catalog, requestedBranchId: string) {
  const branch = catalog.branches.find(b => b.id === requestedBranchId) ?? catalog.branches[0];
  const items: CartItem[] = rows.map(row => {
    const variant = row.variant;
    const dbProduct = variant?.product;
    const product = dbProduct ? catalog.products.find(p => p.id === dbProduct.id) : undefined;
    const available = catalog.stock.find(s => s.skuId === row.variant_id && s.branchId === branch?.id)?.quantity ?? 0;
    return {
      key: row.id,
      productId: dbProduct?.id ?? '',
      productName: dbProduct?.name ?? 'Sản phẩm không còn bán',
      skuId: row.variant_id,
      skuCode: variant?.sku ?? row.variant_id,
      size: variant?.size ?? '—',
      color: variant?.color_name ?? '—',
      branchId: branch?.id ?? '',
      branchName: branch?.name ?? 'Chưa có chi nhánh nhận hàng',
      imageUrl: product?.imageUrl,
      unitPriceVnd: dbProduct?.sale_price ?? dbProduct?.base_price ?? 0,
      quantity: row.quantity,
      // Keep unavailable lines visible so the customer can remove them.
      maxAvailable: product ? Math.min(10, Math.max(0, available)) : 0,
    };
  });
  return { items, branchId: branch?.id ?? '', branches: catalog.branches };
}

export function validateOrderItems(items: CartItem[]) {
  if (!items.length) throw new Error('Giỏ hàng đang trống.');
  if (!items[0].branchId || items.some(item => item.branchId !== items[0].branchId)) {
    throw new Error('Vui lòng chọn một chi nhánh nhận hàng cho toàn bộ giỏ.');
  }
  if (items.some(item => !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > item.maxAvailable)) {
    throw new Error('Có sản phẩm vượt quá tồn kho hoặc giới hạn 10 sản phẩm mỗi SKU. Hãy sửa giỏ hàng.');
  }
}
