/** Đăng ký, đăng nhập, hồ sơ người dùng.  Endpoint: /auth/v1/*, /rest/v1/profiles */
import { db } from './client';
import type { Profile } from './types';
import { ApiError, unwrap } from './errors';

export async function signUp(email: string, password: string, fullName: string) {
  const { data, error } = await db().auth.signUp({
    email, password, options: { data: { full_name: fullName } },
  });
  if (error) throw new ApiError('UNKNOWN', error.message, error);
  return data;
}

export async function signIn(email: string, password: string) {
  const { data, error } = await db().auth.signInWithPassword({ email, password });
  if (error) throw new ApiError('UNKNOWN', error.message, error);
  return data;
}

export async function signOut() {
  await db().auth.signOut();
}

/** Hồ sơ của người đang đăng nhập (null nếu chưa đăng nhập) */
export async function getMyProfile(): Promise<Profile | null> {
  const { data: { user } } = await db().auth.getUser();
  if (!user) return null;
  return unwrap(await db().from('profiles').select('*').eq('id', user.id).single());
}

/** Chỉ sửa được các trường cá nhân; role / branch_id bị database chặn */
export async function updateMyProfile(
  patch: Partial<Pick<Profile, 'full_name' | 'phone' | 'gender' | 'height_cm' | 'weight_kg'>>,
): Promise<Profile> {
  const { data: { user } } = await db().auth.getUser();
  if (!user) throw new ApiError('NOT_AUTHENTICATED', 'Bạn cần đăng nhập');
  return unwrap(await db().from('profiles').update(patch).eq('id', user.id).select().single());
}
