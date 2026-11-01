/** Kiểu dữ liệu — khớp bảng/view trong database (01_schema.sql, 02_functions.sql). */

export type Role = 'customer' | 'manager' | 'admin';
export type OrderStatus =
  | 'pending' | 'confirmed' | 'ready_for_pickup'
  | 'completed' | 'cancelled' | 'expired';

export interface Profile {
  id: string;
  full_name: string;
  phone: string | null;
  role: Role;
  branch_id: string | null;
  gender: 'male' | 'female' | null;
  height_cm: number | null;
  weight_kg: number | null;
  created_at: string;
}

export interface Branch {
  id: string;
  code: string;
  name: string;
  address: string;
  phone: string | null;
  open_time: string;   // "09:00:00"
  close_time: string;
  image_path: string | null;
  is_active: boolean;
}

export interface Category {
  id: string;
  slug: string;
  name: string;
  code_prefix: string;
  gender: 'men' | 'women' | 'unisex';
  size_type: 'letter' | 'waist';
  image_path: string | null;
  sort_order: number;
}

/** Một dòng của view v_product_catalog — dùng cho Home / Search / Danh mục */
export interface CatalogItem {
  id: string;
  code: string;
  name: string;
  description: string | null;
  material: string | null;
  fit: 'regular' | 'slim' | 'oversize';
  category_id: string;
  category_slug: string;
  category_name: string;
  gender: 'men' | 'women' | 'unisex';
  base_price: number;          // giá gốc VND
  sale_price: number | null;   // null = không giảm
  final_price: number;         // giá khách trả
  is_on_sale: boolean;
  thumbnail_bucket: string | null;
  thumbnail_path: string | null;
  total_available: number;     // tổng còn bán ở mọi chi nhánh
  created_at: string;
}

export interface Variant {
  id: string;
  product_id: string;
  sku: string;
  color_code: string;
  color_name: string;
  size: string;
  is_active: boolean;
}

export interface Media {
  id: string;
  product_id: string;
  color_code: string | null;
  media_type: 'image' | 'video';
  bucket: 'product-images' | 'product-video';
  path: string;
  sort_order: number;
}

/** Một dòng của view v_inventory_available */
export interface StockRow {
  branch_id: string;
  branch_code: string;
  branch_name: string;
  variant_id: string;
  sku: string;
  product_id: string;
  color_code: string;
  color_name: string;
  size: string;
  available_quantity: number;
}

export interface SizeChartRow {
  id: string;
  category_id: string;
  product_id: string | null;
  size: string;
  height_min_cm: number;
  height_max_cm: number;
  weight_min_kg: number;
  weight_max_kg: number;
  chest_cm: number | null;
  waist_cm: number | null;
  length_cm: number | null;
}

export interface CartItem {
  id: string;
  user_id: string;
  variant_id: string;
  quantity: number;
  added_at: string;
}

/** Giỏ hàng kèm thông tin SKU + sản phẩm để hiển thị */
export interface CartLine extends CartItem {
  variant: Variant & {
    product: Pick<CatalogItem, 'id' | 'code' | 'name' | 'base_price' | 'sale_price'>;
  };
}

export interface Order {
  id: string;
  order_code: string;
  user_id: string;
  branch_id: string;
  status: OrderStatus;
  total_amount: number;
  customer_name: string;
  customer_phone: string;
  note: string | null;
  pickup_deadline: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface OrderItem {
  id: string;
  order_id: string;
  variant_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
}

export interface OrderDetail extends Order {
  branch: Pick<Branch, 'code' | 'name' | 'address'>;
  items: (OrderItem & { variant: Pick<Variant, 'sku' | 'color_name' | 'size'> & {
    product: { code: string; name: string };
  } })[];
}

export interface PlaceOrderInput {
  branchId: string;
  items: { variantId: string; quantity: number }[];
  customerName: string;
  customerPhone: string;
  note?: string;
}

export interface PlaceOrderResult {
  order_id: string;
  order_code: string;   // DH20261027-0001
  total_amount: number;
}
