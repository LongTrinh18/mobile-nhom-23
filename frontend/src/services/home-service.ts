import { supabase } from '../lib/supabase';
import type { BestSeller, HomeCollection } from '../data/home-sections';

export async function getBestSellers(): Promise<BestSeller[]> {
  if (!supabase) return []; // No completed demo orders: do not invent sales rankings.
  const { data, error } = await supabase.rpc('get_home_best_sellers');
  if (error) throw error;
  return ((data ?? []) as { product_id: string; units_sold: number | string }[])
    .map(row => ({ productId: row.product_id, unitsSold: Number(row.units_sold) }));
}
export async function getHomeCollections(): Promise<HomeCollection[]> {
  if (!supabase) return [
    { id: 'demo-essentials', slug: 'everyday-essentials', name: 'Thiết yếu mỗi ngày', description: 'Các thiết kế cơ bản dễ phối.', productIds: ['p01', 'p04', 'p03'] },
    { id: 'demo-office', slug: 'smart-casual', name: 'Công sở tối giản', description: 'Gọn gàng cho ngày đi làm.', productIds: ['p02', 'p05'] },
  ];
  const { data, error } = await supabase.from('collections')
    .select('id,slug,name,description,products:collection_products(product_id,sort_order)')
    .eq('is_active', true).order('sort_order').order('id');
  if (error) throw error;
  type CollectionDb = { id: string; slug: string; name: string; description: string | null; products: { product_id: string; sort_order: number }[] };
  return ((data ?? []) as unknown as CollectionDb[]).map(row => ({
    id: row.id, slug: row.slug, name: row.name, description: row.description ?? '',
    productIds: [...row.products].sort((a, b) => a.sort_order - b.sort_order || a.product_id.localeCompare(b.product_id)).map(item => item.product_id),
  }));
}
