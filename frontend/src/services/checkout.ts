/**
 * Pure checkout rules. They mirror place_order (database/migrations/09_fix_checkout_flow.sql)
 * so the customer sees the same numbers before ordering; the server still recalculates everything.
 */
import type { Voucher } from '../api/types';
import type { Catalog } from '../types/shop';

export const SHIPPING_FEE_VND = 30000;      // QD20
export const FREE_SHIP_ABOVE_VND = 500000;  // QD20: goods after discount must be ABOVE this
export const PHONE_PATTERN = /^(0|\+84)\d{9}$/;

export type FulfillmentType = 'pickup' | 'delivery';
export type VoucherRule = Pick<Voucher, 'code' | 'description' | 'discount_type' | 'discount_value' | 'applies_to'>;
export type CheckoutLine = { skuId: string; skuCode: string; quantity: number };
export type Quote = { subtotal: number; discount: number; shipping: number; total: number; freeShipRemaining: number };

export const normalizeVoucherCode = (raw: string) => raw.trim().toUpperCase();
export const normalizePhone = (raw: string) => raw.replace(/[\s.-]/g, '');

/** Why a voucher cannot be used for this order, or null when it applies. */
export function voucherProblem(voucher: VoucherRule | undefined, type: FulfillmentType): string | null {
  if (!voucher) return 'Mã giảm giá không tồn tại hoặc đã hết hạn.';
  if (voucher.applies_to === 'delivery' && type !== 'delivery') return 'Mã ' + voucher.code + ' chỉ áp dụng khi giao hàng tận nơi.';
  return null;
}

export function quoteOrder(subtotal: number, type: FulfillmentType, voucher?: VoucherRule | null): Quote {
  const usable = voucher && !voucherProblem(voucher, type) ? voucher : null;
  const discount = usable?.discount_type === 'percent' ? Math.round(subtotal * usable.discount_value / 100) : 0;
  const goods = subtotal - discount;
  let shipping = 0;
  if (type === 'delivery' && subtotal > 0) {
    shipping = goods > FREE_SHIP_ABOVE_VND || usable?.discount_type === 'free_shipping' ? 0 : SHIPPING_FEE_VND;
  }
  const freeShipRemaining = type === 'delivery' && shipping > 0 ? FREE_SHIP_ABOVE_VND + 1 - goods : 0;
  return { subtotal, discount, shipping, total: goods + shipping, freeShipRemaining };
}

export type BranchCheck = { branchId: string; canFulfill: boolean; missing: { skuCode: string; requested: number; available: number }[] };

/** Same rule as find_fulfilling_branches: one store must have every line in full. */
export function checkBranches(catalog: Catalog, lines: readonly CheckoutLine[]): BranchCheck[] {
  return catalog.branches.map(branch => {
    const missing = lines.map(line => ({ skuCode: line.skuCode, requested: line.quantity,
      available: Math.max(0, catalog.stock.find(row => row.skuId === line.skuId && row.branchId === branch.id)?.quantity ?? 0) }))
      .filter(line => line.available < line.requested);
    return { branchId: branch.id, canFulfill: lines.length > 0 && missing.length === 0, missing };
  });
}

export function validateCustomer(input: { name: string; phone: string; address: string; type: FulfillmentType }) {
  return {
    name: input.name.trim() ? '' : 'Vui lòng nhập họ và tên người nhận.',
    phone: PHONE_PATTERN.test(normalizePhone(input.phone)) ? '' : 'Số điện thoại chưa hợp lệ (ví dụ: 0912345678).',
    address: input.type === 'delivery' && input.address.trim().length < 8 ? 'Vui lòng nhập địa chỉ giao hàng chi tiết (số nhà, đường, phường, quận).' : '',
  };
}

/** Identifies one checkout attempt: the same payload re-uses its idempotency key, a changed payload gets a new one. */
export function orderSignature(input: { type: FulfillmentType; branchId?: string; address?: string; voucher?: string; lines: readonly CheckoutLine[] }) {
  return JSON.stringify([input.type, input.type === 'pickup' ? input.branchId ?? '' : input.address?.trim() ?? '', input.voucher ?? '',
    [...input.lines].map(line => line.skuId + 'x' + line.quantity).sort()]);
}
