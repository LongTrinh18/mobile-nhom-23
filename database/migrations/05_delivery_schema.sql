-- =====================================================================
-- 05_delivery_schema.sql — B2: bổ sung cấu trúc cho tuần 2
--   • Giao hàng, người nhận, phí ship, voucher, thanh toán, chống gọi lặp
--   • Tọa độ chi nhánh
--   • Nhóm khách hàng, size trẻ em, bộ sưu tập, đánh giá, nguồn ảnh
--     (chỉ tạo cấu trúc; dữ liệu B3/B4 nhập sau)
-- Chạy SAU 01–04. Cả file chạy trong một transaction: lỗi ở đâu thì
-- không có gì thay đổi. Dữ liệu cũ được giữ nguyên: đơn cũ thành đơn
-- nhận tại cửa hàng, thanh toán COD.
-- Quy định: sheet "QĐ nghiệp vụ (mới)" và "Trường dữ liệu (mới)".
-- =====================================================================

begin;


-- ---------------------------------------------------------------------
-- 1. branches — tọa độ để tính khoảng cách (QD15, QD17)
--    Tọa độ 3 chi nhánh mẫu là gần đúng theo địa chỉ trong 03_seed.sql.
-- ---------------------------------------------------------------------
alter table public.branches
  add column if not exists latitude  numeric(9,6),
  add column if not exists longitude numeric(9,6);

alter table public.branches
  add constraint branches_coords_valid check (
    (latitude is null and longitude is null) or
    (latitude between -90 and 90 and longitude between -180 and 180));

update public.branches b
set latitude = v.lat, longitude = v.lng
from (values
  ('CN01', 10.774300, 106.703600),   -- 135 Nguyễn Huệ, Quận 1
  ('CN02', 10.728900, 106.718800),   -- 101 Tôn Dật Tiên, Quận 7
  ('CN03', 10.850400, 106.762100)    -- 216 Võ Văn Ngân, Thủ Đức
) as v(code, lat, lng)
where b.code = v.code and b.latitude is null;


-- ---------------------------------------------------------------------
-- 2. categories — thêm nhóm trẻ em / em bé và size theo chiều cao (QD02)
-- ---------------------------------------------------------------------
alter table public.categories drop constraint if exists categories_gender_check;
alter table public.categories add constraint categories_gender_check
  check (gender in ('men', 'women', 'unisex', 'kids', 'baby'));

alter table public.categories drop constraint if exists categories_size_type_check;
alter table public.categories add constraint categories_size_type_check
  check (size_type in ('letter', 'waist', 'height'));     -- height: 60–160 (cm)


-- ---------------------------------------------------------------------
-- 3. products — nhóm khách hàng (QD01)
--    Sản phẩm cũ lấy theo giới tính của danh mục. Sản phẩm mới bắt buộc
--    ghi rõ nhóm (không có giá trị mặc định).
-- ---------------------------------------------------------------------
alter table public.products add column if not exists customer_group text;

update public.products p
set customer_group = c.gender
from public.categories c
where c.id = p.category_id and p.customer_group is null;

alter table public.products alter column customer_group set not null;
alter table public.products add constraint products_customer_group_check
  check (customer_group in ('women', 'men', 'unisex', 'kids', 'baby'));
create index if not exists products_customer_group_idx on public.products(customer_group);


-- ---------------------------------------------------------------------
-- 4. product_media — nguồn và giấy phép ảnh (QD06). Ảnh mới phải điền.
-- ---------------------------------------------------------------------
alter table public.product_media
  add column if not exists source_url text,
  add column if not exists license    text;


-- ---------------------------------------------------------------------
-- 5. collections, collection_products — bộ sưu tập (QD03)
-- ---------------------------------------------------------------------
create table if not exists public.collections (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null unique,                -- thu-dong-2026
  name              text not null,
  description       text,
  cover_image_path  text,                                -- bucket product-images
  sort_order        int  not null default 0,
  is_active         boolean not null default true
);

create table if not exists public.collection_products (
  collection_id  uuid not null references public.collections(id) on delete cascade,
  product_id     uuid not null references public.products(id)    on delete cascade,
  sort_order     int  not null default 0,
  primary key (collection_id, product_id)
);
create index if not exists collection_products_product_idx on public.collection_products(product_id);


-- ---------------------------------------------------------------------
-- 6. product_reviews — đánh giá mẫu (QD04). Khách không tự viết;
--    user_id để trống với dữ liệu mẫu.
-- ---------------------------------------------------------------------
create table if not exists public.product_reviews (
  id             uuid primary key default gen_random_uuid(),
  product_id     uuid not null references public.products(id) on delete cascade,
  user_id        uuid references public.profiles(id) on delete set null,
  reviewer_name  text not null,
  rating         int  not null check (rating between 1 and 5),
  content        text,
  created_at     timestamptz not null default now()
);
create index if not exists product_reviews_product_idx on public.product_reviews(product_id);


-- ---------------------------------------------------------------------
-- 7. vouchers — mã giảm giá (QD19)
-- ---------------------------------------------------------------------
create table if not exists public.vouchers (
  code            text primary key check (code = upper(code)),
  description     text not null,
  discount_type   text not null check (discount_type in ('percent', 'free_shipping')),
  discount_value  int  not null default 0,
  applies_to      text not null default 'all' check (applies_to in ('all', 'delivery')),
  is_active       boolean not null default true,
  constraint vouchers_value_valid check (
    (discount_type = 'percent'       and discount_value between 1 and 100) or
    (discount_type = 'free_shipping' and discount_value = 0))
);

insert into public.vouchers (code, description, discount_type, discount_value, applies_to) values
  ('UNIQLO10', 'Giảm 10% tiền hàng',  'percent',       10, 'all'),
  ('FREESHIP', 'Miễn phí giao hàng', 'free_shipping',  0, 'delivery')
on conflict (code) do nothing;


-- ---------------------------------------------------------------------
-- 8. orders — cách nhận, người nhận, tiền, thanh toán, chống gọi lặp
--    Đơn cũ: pickup, COD, tiền hàng = tổng tiền; đơn đã completed = paid.
-- ---------------------------------------------------------------------
alter table public.orders
  add column if not exists fulfillment_type  text not null default 'pickup',
  add column if not exists delivery_address  text,
  add column if not exists delivery_lat      numeric(9,6),
  add column if not exists delivery_lng      numeric(9,6),
  add column if not exists subtotal_amount   int,
  add column if not exists discount_amount   int  not null default 0,
  add column if not exists shipping_fee      int  not null default 0,
  add column if not exists voucher_code      text references public.vouchers(code) on delete restrict,
  add column if not exists payment_method    text not null default 'cod',
  add column if not exists payment_status    text not null default 'unpaid',
  add column if not exists idempotency_key   uuid,
  add column if not exists shipped_at        timestamptz;

-- Điền dữ liệu cho đơn cũ mà không đổi updated_at
alter table public.orders disable trigger orders_set_updated_at;
update public.orders set subtotal_amount = total_amount where subtotal_amount is null;
update public.orders set payment_status  = 'paid'       where status = 'completed';
alter table public.orders enable trigger orders_set_updated_at;

alter table public.orders alter column subtotal_amount set not null;

-- Trạng thái: thêm luồng giao hàng (sheet "Trạng thái đơn (mới)")
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in ('pending', 'confirmed',
                    'ready_for_pickup', 'completed', 'expired',        -- pickup
                    'shipping', 'delivered', 'delivery_failed',        -- delivery
                    'cancelled'));

alter table public.orders
  add constraint orders_fulfillment_type_check
    check (fulfillment_type in ('pickup', 'delivery')),
  add constraint orders_payment_method_check
    check (payment_method in ('cod')),
  add constraint orders_payment_status_check
    check (payment_status in ('unpaid', 'paid')),
  -- Tổng = tiền hàng − giảm giá + phí ship (QD21)
  add constraint orders_amounts_valid check (
    subtotal_amount >= 0
    and discount_amount between 0 and subtotal_amount
    and shipping_fee >= 0
    and total_amount = subtotal_amount - discount_amount + shipping_fee),
  -- Giao hàng phải có địa chỉ; nhận tại cửa hàng không có phí ship, không có địa chỉ
  add constraint orders_delivery_fields check (
    (fulfillment_type = 'pickup'   and shipping_fee = 0 and delivery_address is null) or
    (fulfillment_type = 'delivery' and coalesce(trim(delivery_address), '') <> '')),
  add constraint orders_delivery_coords check (
    (delivery_lat is null and delivery_lng is null) or
    (delivery_lat between -90 and 90 and delivery_lng between -180 and 180)),
  -- Mỗi cách nhận chỉ dùng trạng thái của luồng mình
  add constraint orders_status_matches_fulfillment check (
    (fulfillment_type = 'pickup'   and status not in ('shipping', 'delivered', 'delivery_failed')) or
    (fulfillment_type = 'delivery' and status not in ('ready_for_pickup', 'completed', 'expired'))),
  -- Một mã chống gọi lặp chỉ tạo được một đơn cho mỗi người (QD25)
  add constraint orders_unique_idempotency_key unique (user_id, idempotency_key);

-- Job tự hủy đơn pending quá 24 giờ tìm theo (status, created_at)
create index if not exists orders_status_created_idx on public.orders(status, created_at);


-- ---------------------------------------------------------------------
-- 9. v_product_catalog — thêm cột cho trang chủ (QD33, QD34)
--    "create or replace" chỉ thêm cột vào cuối nên giữ nguyên quyền đã cấp.
-- ---------------------------------------------------------------------
create or replace view public.v_product_catalog
with (security_invoker = true)
as
select
  p.id,
  p.code,
  p.name,
  p.description,
  p.material,
  p.fit,
  c.id                                     as category_id,
  c.slug                                   as category_slug,
  c.name                                   as category_name,
  c.gender,
  p.base_price,
  p.sale_price,
  coalesce(p.sale_price, p.base_price)     as final_price,
  p.sale_price is not null                 as is_on_sale,
  thumb.bucket                             as thumbnail_bucket,
  thumb.path                               as thumbnail_path,
  coalesce(stock.total_available, 0)       as total_available,
  p.created_at,
  -- cột mới tuần 2
  p.customer_group,
  rv.rating_avg,
  coalesce(rv.rating_count, 0)             as rating_count,
  case when p.sale_price is not null
       then round(100.0 * (p.base_price - p.sale_price) / p.base_price)::int
       else 0 end                          as discount_percent
from public.products p
join public.categories c on c.id = p.category_id
left join lateral (
  select m.bucket, m.path
  from public.product_media m
  where m.product_id = p.id and m.media_type = 'image'
  order by m.sort_order, m.color_code nulls first
  limit 1
) thumb on true
left join lateral (
  select sum(i.quantity - i.reserved_quantity)::int as total_available
  from public.inventory i
  join public.product_variants v on v.id = i.variant_id
  join public.branches b         on b.id = i.branch_id
  where v.product_id = p.id and v.is_active and b.is_active
) stock on true
left join lateral (
  select round(avg(r.rating), 1)  as rating_avg,
         count(*)::int            as rating_count
  from public.product_reviews r
  where r.product_id = p.id
) rv on true
where p.is_active;


-- ---------------------------------------------------------------------
-- 10. Phân quyền bảng mới (QD32): mọi người xem, chỉ admin sửa.
--     Bật RLS ngay trong file này để bảng không bị hở khi mới tạo.
-- ---------------------------------------------------------------------
alter table public.collections         enable row level security;
alter table public.collection_products enable row level security;
alter table public.product_reviews     enable row level security;
alter table public.vouchers            enable row level security;

create policy "collections: mọi người xem bộ sưu tập đang hiện"
  on public.collections for select to anon, authenticated
  using (is_active or public.is_admin());
create policy "collections: admin quản lý"
  on public.collections for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "collection_products: mọi người xem"
  on public.collection_products for select to anon, authenticated
  using (true);
create policy "collection_products: admin quản lý"
  on public.collection_products for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "reviews: mọi người xem"
  on public.product_reviews for select to anon, authenticated
  using (true);
create policy "reviews: admin quản lý"
  on public.product_reviews for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "vouchers: mọi người xem mã đang dùng"
  on public.vouchers for select to anon, authenticated
  using (is_active or public.is_admin());
create policy "vouchers: admin quản lý"
  on public.vouchers for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

commit;

-- =====================================================================
-- Kiểm tra nhanh sau khi chạy:
--   select code, latitude, longitude from public.branches;          -- 3 dòng có tọa độ
--   select code, customer_group from public.products;               -- không có null
--   select * from public.vouchers;                                   -- UNIQLO10, FREESHIP
--   select fulfillment_type, payment_status, count(*) from public.orders group by 1, 2;
-- =====================================================================
