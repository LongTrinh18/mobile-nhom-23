import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import type { Profile } from '../api/types';
import { supabase } from '../lib/supabase';
import { safeReturnTarget, targetUrl, type AppTarget } from '../navigation/routes';

export const NATIVE_AUTH_CALLBACK = 'uniqlomobile://auth/callback';
export function googleCallbackUrl() { return Platform.OS === 'web' ? Linking.createURL('auth/callback') : NATIVE_AUTH_CALLBACK; }
const pendingKey = 'uniqlo.google-login.v1';
const maxAge = 10 * 60 * 1000;
type PendingLogin = { returnTo: string; redirectTo: string; startedAt: number };
export class LoginCancelled extends Error {}
function client() {
  if (!supabase) throw new Error('Chưa cấu hình kết nối Supabase Auth.');
  return supabase;
}
export function authErrorMessage(error: unknown): string {
  if (error instanceof LoginCancelled) return 'Bạn đã huỷ đăng nhập Google.';
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
  const message = error instanceof Error ? error.message : '';
  if (/provider.*(not enabled|disabled|not supported)/i.test(message) || code === 'provider_disabled')
    return 'Google chưa được bật trong Supabase. Vui lòng cấu hình nhà cung cấp Google.';
  if (/network|fetch|timeout/i.test(message)) return 'Không thể kết nối. Kiểm tra mạng rồi thử lại.';
  if (/invalid login credentials/i.test(message)) return 'Email hoặc mật khẩu chưa đúng.';
  if (/email not confirmed/i.test(message)) return 'Vui lòng xác nhận email trước khi đăng nhập.';
  if (/code verifier|flow_state|code.*expired|invalid.*code/i.test(message))
    return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập Google lại.';
  // Never display a provider URL, auth code, access token or raw callback error.
  return error instanceof Error && error.name === 'UserAuthError' ? message : 'Đăng nhập chưa hoàn tất. Vui lòng thử lại.';
}
export function userAuthError(message: string) {
  const error = new Error(message); error.name = 'UserAuthError'; return error;
}
export async function loadMyProfile(): Promise<Profile> {
  const db = client();
  const { data: { user }, error: authError } = await db.auth.getUser();
  if (authError) throw authError;
  if (!user) throw userAuthError('Phiên đã hết hạn. Vui lòng đăng nhập lại.');
  let { data, error } = await db.from('profiles').select('*').eq('id', user.id).maybeSingle();
  if (error) throw userAuthError('Chưa tải được hồ sơ. Kiểm tra kết nối rồi thử lại.');
  if (!data?.full_name?.trim()) {
    const repaired = await db.rpc('ensure_my_profile');
    if (repaired.error) throw userAuthError('Chưa tạo được hồ sơ. Cần triển khai migration 08_auth_profiles.sql trên Supabase.');
    data = repaired.data;
  }
  if (!data || data.id !== user.id || !data.full_name?.trim() || !['customer', 'manager', 'admin'].includes(data.role))
    throw userAuthError('Hồ sơ chưa hợp lệ. Vui lòng thử tải lại.');
  return data as Profile;
}
export function parseGoogleCallback(raw: string, expected: string) {
  let url: URL, redirect: URL;
  try { url = new URL(raw); redirect = new URL(expected); }
  catch { throw userAuthError('Liên kết đăng nhập không hợp lệ.'); }
  if (url.protocol !== redirect.protocol || url.host !== redirect.host || url.pathname !== redirect.pathname || url.hash)
    throw userAuthError('Liên kết đăng nhập không hợp lệ.');
  const error = url.searchParams.get('error');
  if (error === 'access_denied') throw new LoginCancelled();
  if (error) throw userAuthError('Google không thể hoàn tất đăng nhập. Vui lòng thử lại.');
  const code = url.searchParams.get('code');
  const flowId = url.searchParams.get('sb_flow_id');
  if (!code || code.length > 2048 || (flowId && !/^[a-zA-Z0-9_-]{8,64}$/.test(flowId)))
    throw userAuthError('Liên kết đăng nhập thiếu hoặc sai mã xác thực.');
  return { code, flowId };
}
let completion: { url: string; promise: Promise<AppTarget> } | null = null;
async function finishGoogleLogin(url: string): Promise<AppTarget> {
  const raw = await AsyncStorage.getItem(pendingKey);
  let pending: PendingLogin | null = null;
  try { pending = raw ? JSON.parse(raw) : null; } catch { /* Invalid local intent fails closed. */ }
  if (!pending || typeof pending.startedAt !== 'number' || Date.now() - pending.startedAt > maxAge || pending.startedAt > Date.now() ||
      typeof pending.returnTo !== 'string' || typeof pending.redirectTo !== 'string')
    throw userAuthError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập Google lại.');
  const expected = googleCallbackUrl();
  if (pending.redirectTo !== expected) throw userAuthError('Liên kết đăng nhập không hợp lệ.');
  try {
    const { code, flowId } = parseGoogleCallback(url, expected);
    const { data, error } = await client().auth.exchangeCodeForSession(code, flowId ? { flowId } : undefined);
    if (error) throw error;
    if (!data.session?.user) throw userAuthError('Chưa nhận được phiên đăng nhập. Vui lòng thử lại.');
    await loadMyProfile();
    return safeReturnTarget(pending.returnTo);
  } finally { await AsyncStorage.removeItem(pendingKey); }
}
/** Both the browser promise and the Router callback can arrive; exchange only once. */
export function completeGoogleLogin(url: string): Promise<AppTarget> {
  if (completion?.url === url) return completion.promise;
  const promise = finishGoogleLogin(url);
  completion = { url, promise };
  return promise;
}
let loginInFlight = false;
export async function signInWithGoogle(destination: AppTarget): Promise<AppTarget> {
  if (loginInFlight) throw userAuthError('Đăng nhập Google đang diễn ra.');
  if (Constants.appOwnership === 'expo')
    throw userAuthError('Hãy mở bản Android của ứng dụng để đăng nhập Google. Expo Go không hỗ trợ liên kết xác thực này.');
  const db = client();
  loginInFlight = true;
  completion = null;
  const redirectTo = googleCallbackUrl();
  try {
    // Check the public Auth setting before opening a browser to an unconfigured provider.
    const settings = await fetch(process.env.EXPO_PUBLIC_SUPABASE_URL + '/auth/v1/settings', {
      headers: { apikey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '' },
    });
    if (!settings.ok) throw new Error('Auth settings unavailable');
    if (!(await settings.json()).external?.google)
      throw userAuthError('Google chưa được bật trong Supabase. Vui lòng cấu hình nhà cung cấp Google.');
    await AsyncStorage.setItem(pendingKey, JSON.stringify({ returnTo: targetUrl(destination), redirectTo, startedAt: Date.now() }));
    const { data, error } = await db.auth.signInWithOAuth({ provider: 'google', options: {
      redirectTo, skipBrowserRedirect: true, scopes: 'email profile', queryParams: { prompt: 'select_account' },
    } });
    if (error) throw error;
    if (!data.url) throw userAuthError('Không mở được đăng nhập Google. Vui lòng thử lại.');
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type === 'cancel' || result.type === 'dismiss') throw new LoginCancelled();
    if (result.type !== 'success') throw userAuthError('Không mở được cửa sổ đăng nhập Google.');
    return await completeGoogleLogin(result.url);
  } catch (error) {
    await AsyncStorage.removeItem(pendingKey);
    throw error;
  } finally { loginInFlight = false; }
}
export async function signOutCurrentDevice() {
  await AsyncStorage.removeItem(pendingKey);
  completion = null;
  const { error } = await client().auth.signOut({ scope: 'local' });
  if (error) throw userAuthError('Chưa đăng xuất được. Kiểm tra kết nối rồi thử lại.');
}
