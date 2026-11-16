import { normalizeSearch } from './customer-groups';

/** Swatch colours for the Vietnamese colour names used in product_variants.color_name. */
const swatches: [string, string][] = [
  ['xanh navy', '#1E2A4A'], ['navy', '#1E2A4A'], ['xanh nhat', '#A9C5E6'], ['xanh jean', '#3B5A86'], ['xanh denim', '#3B5A86'],
  ['denim', '#3B5A86'], ['xanh duong', '#3D7BD9'], ['xanh la', '#6E8B4E'], ['xanh reu', '#5E6B3D'], ['xanh', '#5B8BD0'],
  ['den', '#1F2328'], ['trang', '#FAFAF7'], ['kem', '#F1E7D2'], ['be', '#D8C6A6'], ['kaki', '#B8A27A'], ['xam', '#9AA0A6'],
  ['do', '#C62828'], ['hong', '#F1B6C3'], ['vang', '#E5B83A'], ['cam', '#E8833A'], ['nau', '#7A5638'], ['tim', '#A58BD8'],
];

export function swatchColor(name: string): string {
  const value = normalizeSearch(name);
  return swatches.find(([key]) => value === key)?.[1]
    ?? swatches.find(([key]) => value.startsWith(key + ' ') || value.endsWith(' ' + key) || value.includes(' ' + key + ' '))?.[1]
    ?? '#D1D5DB';
}

/** Light swatches need an outline to stay visible on white. */
export const swatchNeedsBorder = (hex: string) => ['#FAFAF7', '#F1E7D2', '#D8C6A6'].includes(hex);
