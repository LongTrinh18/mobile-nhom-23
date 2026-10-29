/** Đặt đơn, xem đơn, hủy / đổi trạng thái.  Endpoint: /rest/v1/rpc/place_order, /rest/v1/orders, /rest/v1/rpc/update_order_status */
import { db } from './client';
import type { OrderStatus, Branch, Order, OrderDetail, PlaceOrderInput, PlaceOrderResult } from './types';
import { unwrap } from './errors';

/**
 * Đặt đơn nhận tại chi nhánh. Thành công: các món đã đặt tự xóa khỏi giỏ.
 * Hết hàng: ném ApiError code 'OUT_OF_STOCK', detail = danh sách SKU thiếu.
 */
export async function placeOrder(input: PlaceOrderInput): Promise<PlaceOrderResult> {
  const rows = unwrap(
    await db().rpc('place_order', {
      p_branch_id: input.branchId,
      p_items: input.items.map(i => ({ variant_id: i.variantId, quantity: i.quantity })),
      p_customer_name: input.customerName,
      p_customer_phone: input.customerPhone,
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
 *  Manager: 'confirmed' → 'ready_for_pickup' → 'completed', hoặc 'cancelled'
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
