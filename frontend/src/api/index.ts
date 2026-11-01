/**
 * api/ — lớp gọi Supabase cho app.
 * Màn hình chỉ cần:  import { getCatalog, placeOrder, friendlyMessage } from '../api';
 *
 *  client.ts      db(): dùng lại client ở src/lib/supabase.ts
 *  types.ts       kiểu dữ liệu
 *  errors.ts      ApiError, friendlyMessage
 *  media.ts       ghép link ảnh/video
 *  authApi.ts     đăng ký, đăng nhập, hồ sơ
 *  catalogApi.ts  danh mục, chi nhánh, sản phẩm, tồn kho, bảng size, gợi ý
 *  cartApi.ts     giỏ hàng
 *  orderApi.ts    đặt đơn, xem đơn, đổi trạng thái
 *  adminApi.ts    nhập hàng, đổi vai trò
 *  format.ts      nhãn trạng thái, định dạng tiền
 */
export * from './client';
export * from './types';
export * from './errors';
export * from './media';
export * from './authApi';
export * from './catalogApi';
export * from './cartApi';
export * from './orderApi';
export * from './adminApi';
export * from './format';
