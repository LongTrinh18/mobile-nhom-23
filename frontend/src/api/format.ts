/** Định dạng hiển thị. */
import type { OrderStatus } from './types';

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  ready_for_pickup: 'Sẵn sàng nhận',
  completed: 'Đã nhận hàng',
  cancelled: 'Đã hủy',
  expired: 'Quá hạn nhận',
};

export const formatVnd = (n: number) => n.toLocaleString('vi-VN') + ' ₫';
