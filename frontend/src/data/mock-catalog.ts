import type { Catalog, Product, ProductVariant, StockRow } from '../types/shop';

const baseProducts: Omit<Product, 'variants'>[] = [
  { id: 'p01', name: 'Áo thun cotton', category: 'Áo', description: 'Áo thun cotton mềm, phom dáng cơ bản, dễ phối đồ hằng ngày.', priceVnd: 199000 },
  { id: 'p02', name: 'Áo sơ mi Oxford', category: 'Áo', description: 'Sơ mi chất liệu Oxford, phong cách tối giản, phù hợp công sở.', priceVnd: 499000 },
  { id: 'p03', name: 'Quần jeans slim', category: 'Quần', description: 'Quần denim co giãn nhẹ, ống slim, thoải mái khi di chuyển.', priceVnd: 599000 },
  { id: 'p04', name: 'Áo khoác nhẹ', category: 'Áo khoác', description: 'Áo khoác nhẹ tiện dụng, thích hợp thời tiết chuyển mùa.', priceVnd: 699000 },
  { id: 'p05', name: 'Quần short kaki', category: 'Quần', description: 'Quần short kaki thoáng mát, thích hợp cho hoạt động thường ngày.', priceVnd: 349000 },
];

const matrix = [
  [{ size: 'S', color: 'Trắng' }, { size: 'M', color: 'Trắng' }, { size: 'L', color: 'Đen' }],
  [{ size: 'S', color: 'Xanh dương' }, { size: 'M', color: 'Xanh dương' }, { size: 'L', color: 'Trắng' }],
  [{ size: '29', color: 'Xanh denim' }, { size: '30', color: 'Xanh denim' }, { size: '31', color: 'Đen' }],
  [{ size: 'S', color: 'Be' }, { size: 'M', color: 'Be' }, { size: 'L', color: 'Đen' }],
  [{ size: 'S', color: 'Kaki' }, { size: 'M', color: 'Kaki' }, { size: 'L', color: 'Đen' }],
];

export const mockBranches = [
  { id: 'b01', name: 'Chi nhánh Thủ Đức', address: 'TP. Thủ Đức, TP.HCM' },
  { id: 'b02', name: 'Chi nhánh Quận 1', address: 'Quận 1, TP.HCM' },
  { id: 'b03', name: 'Chi nhánh Bình Thạnh', address: 'Bình Thạnh, TP.HCM' },
];

export const mockProducts: Product[] = baseProducts.map((product, productIndex) => ({
  ...product,
  variants: matrix[productIndex].map((v, variantIndex): ProductVariant => ({
    id: `sku-${productIndex + 1}-${variantIndex + 1}`,
    productId: product.id,
    sku: `MN23-${productIndex + 1}-${variantIndex + 1}`,
    size: v.size,
    color: v.color,
  })),
}));

export const mockStock: StockRow[] = mockProducts.flatMap((product, pi) =>
  product.variants.flatMap((variant, vi) =>
    mockBranches.map((branch, bi) => ({
      skuId: variant.id,
      branchId: branch.id,
      quantity: (pi === 2 && vi === 1 && bi === 0) ? 0 : (pi + vi * 2 + bi * 3) % 9 + 1,
    })),
  ),
);

export const mockCatalog: Catalog = {
  source: 'mock',
  products: mockProducts,
  branches: mockBranches,
  stock: mockStock,
};
