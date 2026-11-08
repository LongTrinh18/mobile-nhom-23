/** Shared Supabase client: persistent PKCE sessions are configured in lib/supabase.ts.
 * AuthProvider manages foreground refresh; API calls reuse the same session.
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
