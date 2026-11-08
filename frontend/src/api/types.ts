/** Kiểu dữ liệu — khớp bảng/view trong database (01_schema.sql … 06_order_functions.sql). */

export type Role = 'customer' | 'manager' | 'admin';
export type OrderStatus =
  | 'pending' | 'confirmed'
  | 'ready_for_pickup' | 'completed' | 'expired'     // nhận tại cửa hàng
  | 'shipping' | 'delivered' | 'delivery_failed'     // giao hàng
  | 'cancelled';
export type FulfillmentType = 'pickup' | 'delivery';
export type PaymentStatus = 'unpaid' | 'paid';
export type CustomerGroup = 'women' | 'men' | 'unisex' | 'kids' | 'baby';

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
  latitude: number | null;
  longitude: number | null;
}

export interface Category {
  id: string;
  slug: string;
  name: string;
  code_prefix: string;
  gender: 'men' | 'women' | 'unisex' | 'kids' | 'baby';
  size_type: 'letter' | 'waist' | 'height';   // height: size theo chiều cao (cm), đồ trẻ em
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
  gender: Category['gender'];
  base_price: number;          // giá gốc VND
  sale_price: number | null;   // null = không giảm
  final_price: number;         // giá khách trả
  is_on_sale: boolean;
  thumbnail_bucket: string | null;
  thumbnail_path: string | null;
  total_available: number;     // tổng còn bán ở mọi chi nhánh
  created_at: string;
  customer_group: CustomerGroup;
  rating_avg: number | null;   // null = chưa có đánh giá
  rating_count: number;
  discount_percent: number;    // 0 khi không giảm giá
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
  source_url: string | null;
  license: string | null;
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
  variant: (Variant & {
    product: Pick<CatalogItem, 'id' | 'code' | 'name' | 'base_price' | 'sale_price'> | null;
  }) | null;
}

export interface Order {
  id: string;
  order_code: string;
  user_id: string;
  branch_id: string;
  fulfillment_type: FulfillmentType;
  status: OrderStatus;
  subtotal_amount: number;     // tiền hàng
  discount_amount: number;
  shipping_fee: number;
  total_amount: number;        // = subtotal − discount + shipping_fee
  voucher_code: string | null;
  payment_method: 'cod';
  payment_status: PaymentStatus;
  customer_name: string;
  customer_phone: string;
  delivery_address: string | null;
  delivery_lat: number | null;
  delivery_lng: number | null;
  note: string | null;
  pickup_deadline: string | null;
  shipped_at: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null; // lúc khách nhận (pickup) hoặc giao xong (delivery)
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

export interface OrderLineInput {
  variantId: string;
  quantity: number;             // 1–10; tối đa 20 dòng mỗi đơn
}

export interface PlaceOrderInput {
  items: OrderLineInput[];      // các dòng giỏ được chọn
  fulfillmentType: FulfillmentType;
  customerName: string;
  customerPhone: string;
  /** UUID tạo một lần khi mở màn checkout, gửi lại nguyên giá trị mỗi lần bấm Đặt */
  idempotencyKey: string;
  branchId?: string;            // bắt buộc với pickup; delivery do server chọn
  deliveryAddress?: string;     // bắt buộc với delivery
  deliveryLat?: number;
  deliveryLng?: number;
  voucherCode?: string;
  note?: string;
}

export interface PlaceOrderResult {
  order_id: string;
  order_code: string;           // DH20261027-0001
  status: OrderStatus;
  fulfillment_type: FulfillmentType;
  branch_id: string;
  branch_name: string;
  branch_address: string;
  subtotal_amount: number;
  discount_amount: number;
  shipping_fee: number;
  total_amount: number;
  voucher_code: string | null;
  payment_method: 'cod';
  created_at: string;
  /** true khi server trả lại đơn đã tạo trước đó với cùng idempotencyKey */
  is_duplicate: boolean;
}

/** Một dòng kết quả của find_fulfilling_branches (B5) */
export interface BranchFulfillment {
  branch_id: string;
  branch_code: string;
  branch_name: string;
  address: string;
  phone: string | null;
  latitude: number | null;
  longitude: number | null;
  distance_km: number | null;   // null khi thiếu tọa độ
  can_fulfill: boolean;         // đủ TẤT CẢ món
  missing_items: { variant_id: string; sku: string; requested: number; available: number }[];
}

export interface Voucher {
  code: string;
  description: string;
  discount_type: 'percent' | 'free_shipping';
  discount_value: number;
  applies_to: 'all' | 'delivery';
  is_active: boolean;
}

export interface Collection {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  cover_image_path: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface ProductReview {
  id: string;
  product_id: string;
  user_id: string | null;
  reviewer_name: string;
  rating: number;               // 1–5
  content: string | null;
  created_at: string;
}
