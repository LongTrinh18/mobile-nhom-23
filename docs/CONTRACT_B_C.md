# Hop dong du lieu A - B - C (tuan 1)

Ngay chot: truoc khi lam A05 / C04. Moi thay doi phai duoc A, B, C thong nhat.

## B -> A: Supabase read-only catalog (de xuat)

| Table | Columns required | Meaning |
|---|---|---|
| `products` | `id`, `name`, `description`, `category`, `price_vnd`, `image_url` | Product's current catalog details. `price_vnd` is non-negative integer VND. |
| `product_variants` | `id`, `product_id`, `sku`, `size`, `color` | One row for a unique SKU/size/color combination; `sku` unique. |
| `branches` | `id`, `name`, `address` | Each store/branch. |
| `inventory` | `sku_id`, `branch_id`, `quantity` | Unique `(sku_id,branch_id)`, quantity >= 0. |

The adapter is `src/services/catalog-service.ts`. If B has already made tables named
`product_skus`, `stores` or `stock`, **edit only the adapter**, or agree on a view,
NOT every screen. The given names are a proposed contract, not a claim about B's current SQL.

B must provide:
- Supabase Project URL and `sb_publishable_...` (or legacy anon key) to A through private team channel.
- Readable rows via Supabase Data API for products, product_variants, branches, inventory.
- RLS **SELECT** for anon or authenticated client used by mobile app. NEVER grant
  INSERT/UPDATE/DELETE on pricing or inventory to unauthenticated mobile users.
- At least 3 branches, 5 products, ~15 SKUs, stock per branch for N6 demo.
- Full ERD, constraints and ownership/policies in B's own database work.

## A -> C: cart interface

Shared types in `src/types/shop.ts`:

```ts
import { useCart } from '../context/CartContext';
import { cartItemKey, type CartItem } from '../types/shop';

const { items, addItem, updateQuantity, removeItem, count, totalVnd } = useCart();
// A detail screen calls addItem with skuId + branchId + quantity + price snapshot.
// C uses the same items/updateQuantity/removeItem in its final cart/checkout screens.
```

- A keeps `CartProvider` at root in `src/app/_layout.tsx`.
- C can REPLACE `src/app/cart.tsx`, `src/app/checkout.tsx`, `src/app/account.tsx`
  with their full UX but SHOULD keep the provider/type contract.
- Cart merge key MUST be `skuId:branchId` so stock of different stores never merges.
- `maxAvailable` is a **temporary snapshot**, NOT stock reservation.
- A's `checkout.tsx` is DEMO ONLY; person C takes ownership of the final demo form.
- No real login, registration, order persistence or payments in week 1.

## Navigation contract

- `/` Home (A)
- `/products` Catalog (A)
- `/products/[id]` Product details (A)
- `/cart` Cart (C)
- `/checkout` COD confirmation demo (C)
- `/account` Account screens (C)

## Example cart item for tests

```json
{
  "key":"sku-1-1:b01","productId":"p01","productName":"Áo thun cotton",
  "skuId":"sku-1-1","skuCode":"MN23-1-1","size":"S","color":"Trắng",
  "branchId":"b01","branchName":"Chi nhánh Thủ Đức",
  "unitPriceVnd":199000,"quantity":2,"maxAvailable":8
}
```

## Authentication and security

Expo's `EXPO_PUBLIC_...` variables are embedded in a public client bundle.
Only publishable/anon keys belong there. Project RLS is the real security boundary.
Never put Supabase service role, secret API key or DB passwords in GitHub or Expo.
