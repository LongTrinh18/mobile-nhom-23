/** Manager / admin: nhập hàng, đổi vai trò.  Endpoint: /rest/v1/rpc/restock, /rest/v1/rpc/set_user_role */
import { db } from './client';
import type { Role, Profile } from './types';
import { unwrap } from './errors';

/** Nhập thêm hàng (manager của chi nhánh đó hoặc admin) */
export async function restock(branchId: string, variantId: string, quantity: number) {
  return unwrap(
    await db().rpc('restock', {
      p_branch_id: branchId, p_variant_id: variantId, p_quantity: quantity,
    }),
  );
}

/** Admin đổi vai trò; manager bắt buộc có branchId */
export async function setUserRole(userId: string, role: Role, branchId?: string): Promise<Profile> {
  return unwrap(
    await db().rpc('set_user_role', {
      p_user_id: userId, p_role: role, p_branch_id: branchId ?? null,
    }),
  ) as Profile;
}
