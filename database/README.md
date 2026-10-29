# Database - Supabase SQL, migrations, seeds, RLS and ERD

## Dựng lại database (Supabase → SQL Editor, chạy đúng thứ tự)

| Bước | File | Nội dung |
|---|---|---|
| 1 | `migrations/01_schema.sql` | 14 bảng, ràng buộc, index, trigger `updated_at`, trigger tạo `profiles` khi đăng ký |
| 2 | `migrations/02_functions.sql` | View `v_product_catalog`, `v_inventory_available`; hàm `add_to_cart`, `place_order`, `update_order_status`, `restock`; job pg_cron hết hạn nhận hàng |
| 3 | `migrations/03_seed.sql` | 3 chi nhánh, 5 danh mục, 5 sản phẩm, 15 SKU, 45 dòng tồn kho, bảng size, ảnh, chính sách |
| 4 | `migrations/04_rls.sql` | Bật RLS 14 bảng, phân quyền khách / manager / admin, quyền upload Storage |

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
select tablename, rowsecurity from pg_tables where schemaname = 'public'; -- 14 dòng true
```

## Quy ước

- Giá: số nguyên VND. Size áo XS–XXL, quần 28–36.
- Ảnh: `products/{mã SP}/{mã màu}/{số}.webp` trong bucket `product-images`.
- App KHÔNG ghi thẳng `orders`, `order_items`, `inventory` — chỉ qua hàm `rpc`.
- Sửa database về sau: thêm file `05_...sql`, không sửa file đã chạy.

## Tài liệu liên quan

- `docs/ERD_App_quan_ao.drawio` — mở bằng app.diagrams.net
- Google Sheet "Thiet_ke_du_lieu_App_quan_ao" — trường dữ liệu, ràng buộc, quy tắc tồn kho, trạng thái đơn
- Tài liệu API Supabase — Tuần 1 (cho frontend) + `frontend/src/api/`
