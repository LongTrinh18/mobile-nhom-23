/** Định dạng hiển thị. */
import type { FulfillmentType, OrderStatus } from './types';

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  ready_for_pickup: 'Sẵn sàng nhận',
  completed: 'Đã nhận hàng',
  cancelled: 'Đã hủy',
  expired: 'Quá hạn nhận',
  shipping: 'Đang giao',
  delivered: 'Đã giao',
  delivery_failed: 'Giao thất bại',
};

export const FULFILLMENT_LABEL: Record<FulfillmentType, string> = {
  pickup: 'Nhận tại cửa hàng',
  delivery: 'Giao hàng',
};

export const formatVnd = (n: number) => n.toLocaleString('vi-VN') + ' ₫';
