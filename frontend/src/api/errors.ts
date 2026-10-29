/** Lỗi: tách mã lỗi từ database ("OUT_OF_STOCK: ...") và câu thông báo tiếng Việt. */
import type { PostgrestError } from '@supabase/supabase-js';

export type ApiErrorCode =
  | 'NOT_CONFIGURED' | 'NOT_AUTHENTICATED' | 'INVALID_CUSTOMER' | 'INVALID_BRANCH' | 'EMPTY_ORDER'
  | 'INVALID_QUANTITY' | 'VARIANT_NOT_FOUND' | 'VARIANT_NOT_AVAILABLE'
  | 'OUT_OF_STOCK' | 'ORDER_NOT_FOUND' | 'INVALID_TRANSITION' | 'FORBIDDEN'
  | 'USER_NOT_FOUND' | 'UNKNOWN';

export class ApiError extends Error {
  /** Mã lỗi để rẽ nhánh trong code */
  code: ApiErrorCode;
  /** Phần sau dấu ":" — với OUT_OF_STOCK là danh sách SKU, ví dụ "AT001-BLACK-M, QJ001-BLUE-30" */
  detail: string;
  constructor(code: ApiErrorCode, detail: string, raw?: unknown) {
    super(`${code}: ${detail}`);
    this.code = code;
    this.detail = detail;
    this.cause = raw;
  }
}

const KNOWN_CODES: ApiErrorCode[] = [
  'NOT_CONFIGURED',
  'NOT_AUTHENTICATED', 'INVALID_CUSTOMER', 'INVALID_BRANCH', 'EMPTY_ORDER',
  'INVALID_QUANTITY', 'VARIANT_NOT_FOUND', 'VARIANT_NOT_AVAILABLE', 'OUT_OF_STOCK',
  'ORDER_NOT_FOUND', 'INVALID_TRANSITION', 'FORBIDDEN', 'USER_NOT_FOUND',
];

/** Hàm SQL báo lỗi dạng "MÃ_LỖI: chi tiết" → tách thành ApiError */
function toApiError(err: PostgrestError | Error): ApiError {
  const msg = err.message ?? '';
  const m = msg.match(/^([A-Z_]+):\s*(.*)$/s);
  if (m && (KNOWN_CODES as string[]).includes(m[1])) {
    return new ApiError(m[1] as ApiErrorCode, m[2], err);
  }
  return new ApiError('UNKNOWN', msg, err);
}

export function unwrap<T>(res: { data: T | null; error: PostgrestError | null }): T {
  if (res.error) throw toApiError(res.error);
  return res.data as T;
}

/** Câu thông báo hiển thị cho người dùng */
export function friendlyMessage(e: unknown): string {
  if (!(e instanceof ApiError)) return 'Có lỗi xảy ra, vui lòng thử lại.';
  switch (e.code) {
    case 'NOT_CONFIGURED':        return 'Ứng dụng chưa kết nối máy chủ.';
    case 'NOT_AUTHENTICATED':     return 'Bạn cần đăng nhập để tiếp tục.';
    case 'OUT_OF_STOCK':          return `Hết hàng tại chi nhánh đã chọn: ${e.detail}. Hãy giảm số lượng hoặc chọn chi nhánh khác.`;
    case 'VARIANT_NOT_AVAILABLE':
    case 'VARIANT_NOT_FOUND':     return 'Sản phẩm này hiện không còn bán.';
    case 'INVALID_BRANCH':        return 'Chi nhánh không còn hoạt động, vui lòng chọn chi nhánh khác.';
    case 'INVALID_CUSTOMER':      return 'Vui lòng nhập tên và số điện thoại người nhận.';
    case 'EMPTY_ORDER':           return 'Giỏ hàng đang trống.';
    case 'INVALID_QUANTITY':      return 'Số lượng không hợp lệ.';
    case 'INVALID_TRANSITION':    return 'Không thể thực hiện thao tác này với đơn ở trạng thái hiện tại.';
    case 'ORDER_NOT_FOUND':       return 'Không tìm thấy đơn hàng.';
    case 'FORBIDDEN':             return 'Bạn không có quyền thực hiện thao tác này.';
    default:                      return 'Có lỗi xảy ra, vui lòng thử lại.';
  }
}
