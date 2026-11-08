import type { CustomerAudience, Product } from '../types/shop';

export type BrowseCategoryKey = 'tops' | 'shirts' | 'bottoms' | 'outerwear' | 'dresses' | 'sleepwear' | 'bodysuits' | 'rompers' | 'accessories';
export type BrowseCategory = { key: BrowseCategoryKey; label: string; imageColumn: number };
export type CustomerGroup = { key: CustomerAudience; label: string; imageRow: number; categories: BrowseCategory[] };
export const customerGroups: CustomerGroup[] = [
  { key: 'men', label: 'Nam', imageRow: 0, categories: [
    { key: 'tops', label: 'Áo thun', imageColumn: 0 }, { key: 'shirts', label: 'Áo sơ mi', imageColumn: 1 },
    { key: 'bottoms', label: 'Quần', imageColumn: 2 }, { key: 'outerwear', label: 'Áo khoác', imageColumn: 3 },
  ] },
  { key: 'women', label: 'Nữ', imageRow: 1, categories: [
    { key: 'tops', label: 'Áo thun', imageColumn: 0 }, { key: 'shirts', label: 'Áo sơ mi', imageColumn: 1 },
    { key: 'dresses', label: 'Váy & đầm', imageColumn: 2 }, { key: 'bottoms', label: 'Quần', imageColumn: 3 },
  ] },
  { key: 'kids', label: 'Trẻ em', imageRow: 2, categories: [
    { key: 'tops', label: 'Áo thun', imageColumn: 0 }, { key: 'outerwear', label: 'Áo khoác', imageColumn: 1 },
    { key: 'bottoms', label: 'Quần', imageColumn: 2 }, { key: 'sleepwear', label: 'Đồ mặc nhà', imageColumn: 3 },
  ] },
  { key: 'baby', label: 'Em bé', imageRow: 3, categories: [
    { key: 'bodysuits', label: 'Bodysuit', imageColumn: 0 }, { key: 'rompers', label: 'Đồ liền thân', imageColumn: 1 },
    { key: 'sleepwear', label: 'Đồ ngủ', imageColumn: 2 }, { key: 'accessories', label: 'Phụ kiện', imageColumn: 3 },
  ] },
];
export function getCustomerGroup(key: string | undefined) { return customerGroups.find(group => group.key === key); }
export function getCategoryAudience(category: { customer_group?: string | null; gender?: string; slug?: string }): CustomerAudience | 'unisex' {
  if (category.customer_group === 'unisex' || getCustomerGroup(category.customer_group ?? undefined)) {
    return category.customer_group as CustomerAudience | 'unisex';
  }
  const slug = category.slug ?? '';
  if (/^(tre-em|kids)-/.test(slug)) return 'kids';
  if (/^(em-be|baby)-/.test(slug)) return 'baby';
  if (/^(nu|women)-/.test(slug)) return 'women';
  if (/^(nam|men)-/.test(slug)) return 'men';
  return category.gender === 'men' || category.gender === 'women' ? category.gender : 'unisex';
}
export function matchesAudience(product: Product, audience: CustomerAudience) {
  const group = product.audience ?? 'unisex';
  return group === audience || (group === 'unisex' && (audience === 'men' || audience === 'women'));
}
export function normalizeSearch(value: string) {
  return value.trim().toLocaleLowerCase('vi').normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/đ/g, 'd');
}
export function matchesBrowseCategory(product: Product, key: string) {
  const slug = normalizeSearch(product.categorySlug ?? product.category).replace(/\s+/g, '-')
    .replace(/^(tre-em|em-be|kids|baby|nam|nu|men|women)-/, '');
  switch (key) {
    case 'tops': return /^(ao-thun|ao-polo|ao-tank-top|t-shirt|ao)$/.test(slug);
    case 'shirts': return /^(so-mi|ao-so-mi|ao-kieu)(-|$)/.test(slug);
    case 'bottoms': return /^(quan|jeans|pants)(-|$)/.test(slug);
    case 'outerwear': return /^ao-khoac(-|$)/.test(slug);
    case 'dresses': return /^(vay|dam)(-|$)/.test(slug);
    case 'sleepwear': return /^(do-ngu|do-mac-nha|sleepsuit|pajamas)(-|$)/.test(slug);
    case 'bodysuits': return /^(bodysuit|body)(-|$)/.test(slug);
    case 'rompers': return /^(romper|do-lien-than)(-|$)/.test(slug);
    case 'accessories': return /^(phu-kien|yem|mu|tat)(-|$)/.test(slug);
    default: return product.category === key;
  }
}
