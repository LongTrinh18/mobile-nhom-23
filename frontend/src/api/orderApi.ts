/** Đặt đơn, xem đơn, hủy / đổi trạng thái.  Endpoint: /rest/v1/rpc/place_order, /rest/v1/orders, /rest/v1/rpc/update_order_status */
import { db } from './client';
import type { OrderStatus, Branch, Order, OrderDetail, PlaceOrderInput, PlaceOrderResult } from './types';
import { unwrap } from './errors';

/**
 * Đặt đơn nhận tại cửa hàng (pickup) hoặc giao hàng (delivery). Server tự tính giá,
 * giảm giá, phí ship; delivery thì server chọn chi nhánh gần nhất đủ hàng.
 * Giỏ nằm trên máy: đặt thành công thì màn hình tự xóa các dòng đã đặt.
 * Lỗi thường gặp: 'OUT_OF_STOCK' (pickup), 'NO_BRANCH_AVAILABLE' (delivery), 'INVALID_VOUCHER'.
 * Gọi lại với cùng idempotencyKey → nhận lại đơn cũ (is_duplicate = true), không tạo đơn mới.
 */
export async function placeBuyNowOrder(input: PlaceOrderInput): Promise<PlaceOrderResult> {
  const rows = unwrap(await db().rpc('place_buy_now_order', {
    p_branch_id: input.branchId, p_items: input.items.map(item => ({ variant_id: item.variantId, quantity: item.quantity })),
    p_customer_name: input.customerName, p_customer_phone: input.customerPhone, p_note: input.note ?? null,
  })) as PlaceOrderResult[];
  return rows[0];
}

/** Đặt từ giỏ hàng: các món đã đặt được xóa khỏi giỏ trong cùng giao dịch. */
export async function placeOrder(input: PlaceOrderInput): Promise<PlaceOrderResult> {
  const rows = unwrap(
    await db().rpc('place_order', {
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
    }),
  ) as PlaceOrderResult[];
  return rows[0];
}

/**
 * Danh sách đơn. Khách: đơn của mình. Manager: đơn chi nhánh mình. Admin: tất cả.
 * (Database tự lọc, app không cần truyền user_id.)
 */
export async function getOrders(status?: OrderStatus): Promise<(Order & { branch: Pick<Branch, 'code' | 'name'> })[]> {
  let q = db().from('orders')
    .select('*, branch:branches(code, name)')
    .order('created_at', { ascending: false });
  if (status) q = q.eq('status', status);
  return unwrap(await q) as unknown as (Order & { branch: Pick<Branch, 'code' | 'name'> })[];
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
