/**
 * Lấy client Supabase dùng chung của cả app.
 *
 * KHÔNG tạo client mới ở đây — dùng lại client trong src/lib/db().ts
 * (đọc EXPO_PUBLIC_SUPABASE_URL + EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY từ .env)
 * để cả app chỉ có 1 client, 1 phiên đăng nhập.
 *
 * Token đăng nhập: client tự giữ sau khi signIn và tự gắn vào mọi request.
 * Lưu ý tuần 1: lib/db().ts đang để persistSession: false → tắt app mở lại
 * phải đăng nhập lại. Khi làm Auth thật, C bật lưu phiên trong lib/db().ts
 * (cài @react-native-async-storage/async-storage, thêm storage + persistSession: true,
 * autoRefreshToken: true). Các file trong api/ không cần sửa.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase as sharedClient, hasSupabaseConfig } from '../lib/supabase';
import { ApiError } from './errors';

export { hasSupabaseConfig };

/** Trả về client; ném lỗi NOT_CONFIGURED nếu .env chưa có URL / key. */
export function db(): SupabaseClient {
  if (!sharedClient) {
    throw new ApiError('NOT_CONFIGURED', 'Chưa cấu hình Supabase trong .env');
  }
  return sharedClient;
}
