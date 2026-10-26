import { mockCatalog } from '../data/mock-catalog';
import { supabase } from '../lib/supabase';
import type { Branch, Catalog, Product, ProductVariant, StockRow } from '../types/shop';

type CategoryDb = {
  id: string;
  name: string;
};
type ProductDb = {
  id: string;
  name: string;
  description: string | null;
  category_id: string;
  base_price: number;
  sale_price: number | null;
};
type VariantDb = {
  id: string;
  product_id: string;
  sku: string;
  size: string;
  color_name: string;
  color_code: string;
};
type BranchDb = {
  id: string;
  name: string;
  address: string;
};
type InventoryDb = {
  variant_id: string;
  branch_id: string;
  quantity: number;
  reserved_quantity: number;
};
type MediaDb = {
  product_id: string;
  color_code: string | null;
  media_type: 'image' | 'video';
  bucket: string;
  path: string;
  sort_order: number;
};

/**
 * Adapter following ERD_App_quan_ao.drawio and Thiet_ke_du_lieu_App_quan_ao.xlsx.
 * Keep the UI contract stable (Product, ProductVariant, StockRow in types/shop.ts).
 * B must first deploy these tables, seed data, grant SELECT and configure RLS.
 * Product images require a publicly readable Storage bucket (e.g. product-images).
 */
export async function getCatalog(): Promise<Catalog> {
  const client = supabase;
  if (!client) return mockCatalog;

  const [p, v, b, i, c, m] = await Promise.all([
    client.from('products')
      .select('id,name,description,category_id,base_price,sale_price')
      .eq('is_active', true).order('name'),
    client.from('product_variants')
      .select('id,product_id,sku,size,color_name,color_code')
      .eq('is_active', true),
    client.from('branches')
      .select('id,name,address').eq('is_active', true).order('name'),
    client.from('inventory')
      .select('variant_id,branch_id,quantity,reserved_quantity'),
    client.from('categories')
      .select('id,name'),
    client.from('product_media')
      .select('product_id,color_code,media_type,bucket,path,sort_order')
      .eq('media_type', 'image').order('sort_order'),
  ]);

  for (const [table, result] of [
    ['products', p],
    ['product_variants', v],
    ['branches', b],
    ['inventory', i],
    ['categories', c],
    ['product_media', m],
  ] as const) {
    if (result.error) {
      throw new Error(`${table}: ${result.error.message}. Kiểm tra SQL schema, GRANT SELECT va RLS cua B.`);
    }
  }

  const rawProducts = (p.data ?? []) as ProductDb[];
  const rawVariants = (v.data ?? []) as VariantDb[];
  const rawBranches = (b.data ?? []) as BranchDb[];
  const rawInventory = (i.data ?? []) as InventoryDb[];
  const rawCategories = (c.data ?? []) as CategoryDb[];
  const rawMedia = (m.data ?? []) as MediaDb[];

  const categoryNames = new Map(rawCategories.map(item => [item.id, item.name]));
  const variantsByProduct: Record<string, ProductVariant[]> = {};
  for (const variant of rawVariants) {
    const item: ProductVariant = {
      id: variant.id,
      productId: variant.product_id,
      sku: variant.sku,
      size: variant.size,
      color: variant.color_name,
    };
    (variantsByProduct[item.productId] ??= []).push(item);
  }

  // ProductCard supports one image URL. Prefer common media when available;
  // otherwise use the first image in sort order. Color-specific galleries can
  // be added later without changing the catalog read interface.
  const coverMedia = new Map<string, MediaDb>();
  for (const media of rawMedia) {
    if (!media.path) continue;
    const current = coverMedia.get(media.product_id);
    if (!current || (current.color_code !== null && media.color_code === null)) {
      coverMedia.set(media.product_id, media);
    }
  }

  const products: Product[] = rawProducts.map(product => {
    const media = coverMedia.get(product.id);
    const imageUrl = media
      ? client.storage.from(media.bucket).getPublicUrl(media.path).data.publicUrl
      : undefined;
    return {
      id: product.id,
      name: product.name,
      description: product.description ?? '',
      category: categoryNames.get(product.category_id) ?? 'Khác',
      priceVnd: product.sale_price ?? product.base_price,
      imageUrl,
      variants: variantsByProduct[product.id] ?? [],
    };
  });

  const branches: Branch[] = rawBranches.map(branch => ({
    id: branch.id,
    name: branch.name,
    address: branch.address,
  }));

  // The UI's StockRow.quantity holds AVAILABLE stock, not physical stock.
  // Never expose write operations on inventory from the mobile client.
  const stock: StockRow[] = rawInventory.map(row => ({
    skuId: row.variant_id,
    branchId: row.branch_id,
    quantity: Math.max(0, Number(row.quantity) - Number(row.reserved_quantity)),
  }));

  return { source: 'supabase', products, branches, stock };
}

export function getStock(catalog: Catalog, skuId: string, branchId: string): number {
  return Math.max(0,
    catalog.stock.find(item => item.skuId === skuId && item.branchId === branchId)?.quantity ?? 0,
  );
}
