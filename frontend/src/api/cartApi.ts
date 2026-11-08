/** Giỏ hàng (không gắn chi nhánh).  Endpoint: /rest/v1/cart_items, /rest/v1/rpc/add_to_cart */
import { db } from './client';
import type { CartItem, CartLine } from './types';
import { ApiError, unwrap } from './errors';

export async function getCart(): Promise<CartLine[]> {
  return unwrap(
    await db().from('cart_items')
      .select('*, variant:product_variants(*, product:products(id, code, name, base_price, sale_price))')
      .order('added_at'),
  ) as unknown as CartLine[];
}

/** Thêm vào giỏ; đã có cùng SKU thì cộng dồn (tối đa 10) */
export async function addToCart(variantId: string, quantity = 1): Promise<CartItem> {
  return unwrap(
    await db().rpc('add_to_cart', { p_variant_id: variantId, p_quantity: quantity }),
  ) as CartItem;
}

/** Đặt lại số lượng (1–10) */
export async function setCartQuantity(cartItemId: string, quantity: number): Promise<void> {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) throw new ApiError('INVALID_QUANTITY', 'Số lượng phải từ 1 đến 10');
  unwrap(await db().from('cart_items').update({ quantity }).eq('id', cartItemId));
}

export async function removeFromCart(cartItemId: string): Promise<void> {
  unwrap(await db().from('cart_items').delete().eq('id', cartItemId));
}

/** Delete only the authenticated user's cart, with RLS providing a second boundary. */
export async function clearServerCart(): Promise<void> {
  const client = db();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) throw new ApiError('NOT_AUTHENTICATED', 'Bạn cần đăng nhập');
  unwrap(await client.from('cart_items').delete().eq('user_id', user.id));
}
