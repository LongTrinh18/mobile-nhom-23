/** Data contract: shared by A (catalog), B (database adapter) and C (cart). */
export type Branch = {
  id: string;
  name: string;
  address?: string;
};

export type ProductVariant = {
  id: string;       // Primary key; unique per product/color/size
  productId: string;
  sku: string;      // Human-readable unique code
  size: string;
  color: string;
};

export type Product = {
  id: string;
  name: string;
  description: string;
  category: string;
  priceVnd: number; // Prices in integer VND, not decimals
  imageUrl?: string;
  variants: ProductVariant[];
};

export type StockRow = {
  skuId: string;
  branchId: string;
  quantity: number;
};

export type Catalog = {
  source: 'mock' | 'supabase';
  branches: Branch[];
  products: Product[];
  stock: StockRow[];
};

/** Contract for C's cart screen and A's add-to-cart action. */
export type CartItem = {
  key: string; // `${skuId}:${branchId}`, prevents merging two branches
  productId: string;
  productName: string;
  skuId: string;
  skuCode: string;
  size: string;
  color: string;
  branchId: string;
  branchName: string;
  imageUrl?: string;
  unitPriceVnd: number;
  quantity: number;
  maxAvailable: number; // UI-only snapshot; re-check stock before real order
};

export function cartItemKey(skuId: string, branchId: string): string {
  return `${skuId}:${branchId}`;
}

export function formatVnd(value: number): string {
  // Intl support can vary on native JS engines; use a predictable fallback.
  return `${Math.trunc(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')} ₫`;
}
