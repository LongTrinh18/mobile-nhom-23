/** Đặt đơn, xem đơn, hủy / đổi trạng thái.
 * Endpoint: /rest/v1/rpc/place_cart_order, /rest/v1/rpc/place_order, /rest/v1/orders, /rest/v1/rpc/update_order_status
 */
import { db } from './client';
import type { OrderStatus, Branch, Order, OrderDetail, PlaceOrderInput, PlaceOrderResult } from './types';
import { ApiError, unwrap } from './errors';

function orderParams(input: PlaceOrderInput) {
  return {
    p_items: input.items.map(i => ({ variant_id: i.variantId, quantity: i.quantity })),
    p_fulfillment_type: input.fulfillmentType,
    p_customer_name: input.customerName,
    p_customer_phone: input.customerPhone,
    p_idempotency_key: input.idempotencyKey,
    p_branch_id: input.branchId ?? null,
    p_delivery_address: input.deliveryAddress ?? null,
    p_delivery_lat: input.deliveryLat ?? null,
    p_delivery_lng: input.deliveryLng ?? null,
    p_voucher_code: input.voucherCode ?? null,
    p_note: input.note ?? null,
  };
}
function firstRow(rows: PlaceOrderResult[] | null): PlaceOrderResult {
  if (!rows?.[0]) throw new ApiError('UNKNOWN', 'Máy chủ không trả về đơn hàng');
  return rows[0];
}

/**
 * Mua ngay (pickup hoặc delivery). place_order KHÔNG đụng tới giỏ hàng.
 * Server tự tính giá, giảm giá, phí ship; delivery thì server chọn chi nhánh đủ hàng.
 * Gọi lại với cùng idempotencyKey (uuid) → nhận lại đơn cũ (is_duplicate = true).
 */
export async function placeOrder(input: PlaceOrderInput): Promise<PlaceOrderResult> {
  return firstRow(unwrap(await db().rpc('place_order', orderParams(input))) as PlaceOrderResult[]);
}

/** Đặt các món đã chọn trong giỏ; server xóa đúng các món đó khỏi giỏ trong cùng giao dịch (file 09). */
export async function placeCartOrder(input: PlaceOrderInput): Promise<PlaceOrderResult> {
  return firstRow(unwrap(await db().rpc('place_cart_order', orderParams(input))) as PlaceOrderResult[]);
}

export type OrderListItem = Order & {
  branch: Pick<Branch, 'code' | 'name' | 'address'> | null;
  items: { quantity: number }[];
};

/**
 * Danh sách đơn. Khách: đơn của mình. Manager: đơn chi nhánh mình. Admin: tất cả.
 * (Database tự lọc, app không cần truyền user_id.)
 */
export async function getOrders(status?: OrderStatus): Promise<OrderListItem[]> {
  let q = db().from('orders')
    .select('*, branch:branches(code, name, address), items:order_items(quantity)')
    .order('created_at', { ascending: false });
  if (status) q = q.eq('status', status);
  return unwrap(await q) as unknown as OrderListItem[];
}

export async function getOrderDetail(orderId: string): Promise<OrderDetail> {
  return unwrap(
    await db().from('orders')
      .select(`*,
        branch:branches(code, name, address),
        items:order_items(*, variant:product_variants(sku, color_name, size, product:products(code, name)))`)
      .eq('id', orderId)
      .single(),
  ) as unknown as OrderDetail;
}

/**
 * Đổi trạng thái đơn.
 *  Khách:   'cancelled' (khi đơn pending / confirmed)
 *  Manager, pickup:   'confirmed' → 'ready_for_pickup' → 'completed', hoặc 'cancelled'
 *  Manager, delivery: 'confirmed' → 'shipping' → 'delivered' | 'delivery_failed', hoặc 'cancelled'
 */
export async function updateOrderStatus(
  orderId: string, newStatus: Exclude<OrderStatus, 'pending' | 'expired'>, reason?: string,
): Promise<Order> {
  return unwrap(
    await db().rpc('update_order_status', {
      p_order_id: orderId, p_new_status: newStatus, p_reason: reason ?? null,
    }),
  ) as Order;
}

export const cancelOrder = (orderId: string, reason?: string) =>
  updateOrderStatus(orderId, 'cancelled', reason);

/** Khách chỉ được hủy khi cửa hàng chưa chuẩn bị xong / chưa giao (giống update_order_status). */
export const canCustomerCancel = (status: OrderStatus) => status === 'pending' || status === 'confirmed';
