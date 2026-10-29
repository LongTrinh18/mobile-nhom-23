/** Danh mục, chi nhánh, sản phẩm, tồn kho, bảng size, gợi ý.  Endpoint: /rest/v1/v_product_catalog, product_variants, … */
import { db } from './client';
import type { Branch, Category, CatalogItem, Variant, Media, StockRow, SizeChartRow } from './types';
import { unwrap } from './errors';

export async function getCategories(): Promise<Category[]> {
  return unwrap(await db().from('categories').select('*').order('sort_order'));
}

export async function getBranches(): Promise<Branch[]> {
  return unwrap(await db().from('branches').select('*').order('code'));
}

export interface CatalogQuery {
  categorySlug?: string;
  search?: string;             // tìm theo tên
  onSaleOnly?: boolean;
  inStockOnly?: boolean;
  sort?: 'newest' | 'price_asc' | 'price_desc';
  limit?: number;
  offset?: number;
}

/** Home / Search / Danh mục */
export async function getCatalog(q: CatalogQuery = {}): Promise<CatalogItem[]> {
  let query = db().from('v_product_catalog').select('*');
  if (q.categorySlug) query = query.eq('category_slug', q.categorySlug);
  if (q.search)       query = query.ilike('name', `%${q.search}%`);
  if (q.onSaleOnly)   query = query.eq('is_on_sale', true);
  if (q.inStockOnly)  query = query.gt('total_available', 0);
  if (q.sort === 'price_asc')       query = query.order('final_price', { ascending: true });
  else if (q.sort === 'price_desc') query = query.order('final_price', { ascending: false });
  else                              query = query.order('created_at', { ascending: false });
  const from = q.offset ?? 0;
  query = query.range(from, from + (q.limit ?? 20) - 1);
  return unwrap(await query);
}

export interface ProductDetail {
  product: CatalogItem;
  variants: Variant[];
  media: Media[];
  /** Tồn kho từng SKU ở từng chi nhánh */
  stock: StockRow[];
  /** Bảng size áp dụng: bảng riêng của sản phẩm nếu có, không thì bảng của danh mục */
  sizeChart: SizeChartRow[];
}

/** Màn chi tiết sản phẩm — tra theo mã (AT001) */
export async function getProductDetail(code: string): Promise<ProductDetail> {
  const product = unwrap(
    await db().from('v_product_catalog').select('*').eq('code', code).single(),
  ) as CatalogItem;

  const [variants, media, stock, sizeChart] = await Promise.all([
    db().from('product_variants').select('*').eq('product_id', product.id).order('sku'),
    db().from('product_media').select('*').eq('product_id', product.id).order('sort_order'),
    db().from('v_inventory_available').select('*').eq('product_id', product.id),
    getSizeChart(product.id, product.category_id),
  ]);

  return {
    product,
    variants: unwrap(variants),
    media: unwrap(media),
    stock: unwrap(stock),
    sizeChart,
  };
}

/** Bảng size: ưu tiên bảng riêng của sản phẩm, không có thì dùng bảng danh mục */
export async function getSizeChart(productId: string, categoryId: string): Promise<SizeChartRow[]> {
  const own: SizeChartRow[] = unwrap(
    await db().from('size_charts').select('*').eq('product_id', productId),
  );
  if (own.length > 0) return own;
  return unwrap(
    await db().from('size_charts').select('*')
      .eq('category_id', categoryId).is('product_id', null),
  );
}

/** Tồn kho của 1 SKU ở các chi nhánh — dùng ở bước chọn chi nhánh khi checkout */
export async function getStockForVariants(variantIds: string[]): Promise<StockRow[]> {
  if (variantIds.length === 0) return [];
  return unwrap(
    await db().from('v_inventory_available').select('*').in('variant_id', variantIds),
  );
}

/** Luật gợi ý "Thường mua cùng" cho 1 sản phẩm (có dữ liệu sau khi chạy Apriori) */
export async function getRecommendations(productId: string, limit = 5) {
  return unwrap(
    await db().from('association_rules')
      .select('consequent_ids, confidence, lift')
      .contains('antecedent_ids', [productId])
      .order('lift', { ascending: false })
      .limit(limit),
  ) as { consequent_ids: string[]; confidence: number; lift: number }[];
}
