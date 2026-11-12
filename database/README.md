# Database - Supabase SQL, migrations, seeds, RLS and ERD

## Dựng lại database (Supabase → SQL Editor, chạy đúng thứ tự)

| Bước | File | Nội dung |
|---|---|---|
| 1 | `migrations/01_schema.sql` | 14 bảng, ràng buộc, index, trigger `updated_at`, trigger tạo `profiles` khi đăng ký |
| 2 | `migrations/02_functions.sql` | View `v_product_catalog`, `v_inventory_available`; hàm `add_to_cart`, `place_order`, `update_order_status`, `restock`; job pg_cron hết hạn nhận hàng |
| 3 | `migrations/03_seed.sql` | 3 chi nhánh, 5 danh mục, 5 sản phẩm, 15 SKU, 45 dòng tồn kho, bảng size, ảnh, chính sách |
| 4 | `migrations/04_rls.sql` | Bật RLS 14 bảng, phân quyền khách / manager / admin, quyền upload Storage |
| 5 | `migrations/05_delivery_schema.sql` | Tuần 2 (B2): giao hàng, phí ship, voucher, thanh toán, chống gọi lặp, tọa độ chi nhánh; nhóm khách hàng, size trẻ em, bộ sưu tập, đánh giá, nguồn ảnh (chỉ cấu trúc) |
| 6 | `migrations/06_order_functions.sql` | Tuần 2 (B5, B6): `find_fulfilling_branches`, `place_order` mới (pickup + delivery), trạng thái giao hàng, job tự hủy đơn pending quá 24 giờ |

**Thứ tự đầy đủ = thứ tự tên file** (có hai file 05 và hai file 06):

`01_schema` → `02_functions` → `03_seed` → `04_rls` → `05_customer_groups` → `05_delivery_schema` → `06_home_sections` → `06_order_functions` → `07_buy_now` → `08_auth_profiles` → `09_fix_checkout_flow`

| File | Nội dung |
|---|---|
| `05_customer_groups.sql` | Nhóm khách (Nam / Nữ / Trẻ em / Em bé) cho danh mục |
| `06_home_sections.sql` | Bán chạy (`get_home_best_sellers`), bộ sưu tập trang chủ |
| `07_buy_now.sql` | (Cũ, bị file 09 thay thế) hàm mua ngay `place_buy_now_order` |
| `08_auth_profiles.sql` | Hồ sơ cho tài khoản Google, `ensure_my_profile` |
| `09_fix_checkout_flow.sql` | Sửa lỗi rà soát: xóa `place_buy_now_order` (luôn lỗi), thêm `place_cart_order` (đặt từ giỏ + xóa món đã đặt khỏi giỏ), chống tràn số khi giảm giá, bán chạy tính cả đơn `delivered`, người ngoài nhận `ORDER_NOT_FOUND`, chặn `restock` khi thiếu hồ sơ, không lộ bộ sưu tập đang ẩn |

**Đã chạy tới 08 trên Supabase rồi?** Chỉ cần chạy thêm `09_fix_checkout_flow.sql`. App mới gọi `place_cart_order`, nên phải chạy file 09 trước khi dùng bản app này.

Kiểm thử toàn bộ migration trên máy (không cần Supabase): `cd frontend && npm run test:checkout`.

Các file 05 → 09 chạy trong một transaction: lỗi ở đâu thì không có gì thay đổi, sửa xong chạy lại cả file. File 09 chạy lại nhiều lần vẫn an toàn.

**Đổi chữ ký `place_order` ở file 06:** bản cũ (`p_branch_id, p_items, …`) bị xóa. App gọi qua `frontend/src/api/orderApi.ts`: `placeCartOrder()` (đặt từ giỏ) và `placeOrder()` (mua ngay, không đụng giỏ). `p_idempotency_key` là **uuid**: app tạo một mã cho mỗi lần đặt và gửi lại đúng mã đó khi bấm lại.

Nếu file 02 báo lỗi `pg_cron`: Database → Extensions → bật **pg_cron**, chạy lại đoạn cuối file 02.

## Trước đó cần có

- Storage → 2 bucket **public**: `product-images` (ảnh, 5 MB), `product-video` (video, 50 MB).

## Tài khoản test

1. Authentication → Users → tạo `khach@test.com`, `quanly@test.com`, `admin@test.com`.
2. SQL Editor:

```sql
update public.profiles
set role = 'manager', branch_id = (select id from public.branches where code = 'CN01')
where id = (select id from auth.users where email = 'quanly@test.com');

update public.profiles set role = 'admin', branch_id = null
where id = (select id from auth.users where email = 'admin@test.com');
```

## Kiểm tra nhanh

```sql
select count(*) from public.product_variants;                          -- 15
select count(*) from public.inventory;                                 -- 45
select * from public.v_inventory_available where available_quantity = 0;  -- 3 dòng
select tablename, rowsecurity from pg_tables where schemaname = 'public'; -- 18 dòng true (sau file 05)

-- Sau file 05, 06
select code, latitude, longitude from public.branches;                 -- 3 dòng có tọa độ
select * from public.vouchers;                                          -- UNIQLO10, FREESHIP
select jobname, schedule from cron.job;                                 -- 2 job
select branch_code, can_fulfill, missing_items
from public.find_fulfilling_branches(
  (select jsonb_agg(jsonb_build_object('variant_id', id, 'quantity', 1))
   from public.product_variants where sku = 'SM001-BLUE-L'));          -- CN01 false
```

## Quy ước

- Giá: số nguyên VND. Size áo XS–XXL, quần 28–36.
- Ảnh: `products/{mã SP}/{mã màu}/{số}.webp` trong bucket `product-images`.
- App KHÔNG ghi thẳng `orders`, `order_items`, `inventory` — chỉ qua hàm `rpc`.
- Sửa database về sau: thêm file mới (`07_...sql`), không sửa file đã chạy.
- Quy định nghiệp vụ tuần 2 (QD01–QD37), trạng thái đơn, tồn kho, mã lỗi: Google Sheet "Thiet_ke_du_lieu_App_quan_ao", các tab có hậu tố "(mới)".

## Tài liệu liên quan

- `docs/ERD_App_quan_ao.drawio` — mở bằng app.diagrams.net
- Google Sheet "Thiet_ke_du_lieu_App_quan_ao" — trường dữ liệu, ràng buộc, quy tắc tồn kho, trạng thái đơn
- Tài liệu API Supabase — Tuần 1 (cho frontend) + `frontend/src/api/`
