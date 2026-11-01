-- =====================================================================
-- 01_schema.sql — Tạo 14 bảng, ràng buộc, index, trigger
-- App bán quần áo nhiều chi nhánh (Supabase / PostgreSQL 15+)
-- Chạy trong Supabase → SQL Editor. Chạy file này TRƯỚC 02 và 03.
-- Nguồn: sheet "Trường dữ liệu" và "Ràng buộc".
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Extension
--    vector: kiểu dữ liệu cho embedding (chatbot RAG)
-- ---------------------------------------------------------------------
create extension if not exists vector with schema extensions;


-- ---------------------------------------------------------------------
-- 1. Hàm dùng chung: tự cập nhật cột updated_at mỗi khi sửa dòng
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;


-- ---------------------------------------------------------------------
-- 2. branches — chi nhánh
-- ---------------------------------------------------------------------
create table public.branches (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,                 -- CN01, CN02…
  name        text not null,
  address     text not null,
  phone       text,
  open_time   time not null,
  close_time  time not null,
  image_path  text,                                 -- branches/cn01.webp
  is_active   boolean not null default true,
  constraint branches_open_before_close check (open_time < close_time)
);


-- ---------------------------------------------------------------------
-- 3. profiles — hồ sơ người dùng (email, mật khẩu nằm ở auth.users)
-- ---------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null,
  phone       text,
  role        text not null default 'customer'
              check (role in ('customer', 'manager', 'admin')),
  -- RESTRICT (không phải SET NULL): SET NULL sẽ vi phạm check manager_has_branch.
  -- Muốn đóng chi nhánh thì đặt branches.is_active = false, không xóa thật.
  branch_id   uuid references public.branches(id) on delete restrict,
  gender      text check (gender in ('male', 'female')),
  height_cm   int  check (height_cm between 100 and 250),
  weight_kg   int  check (weight_kg between 30 and 200),
  created_at  timestamptz not null default now(),
  constraint profiles_manager_has_branch
    check (role <> 'manager' or branch_id is not null)
);


-- ---------------------------------------------------------------------
-- 4. categories — danh mục
-- ---------------------------------------------------------------------
create table public.categories (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,                -- ao-thun, quan-jean…
  name         text not null,
  code_prefix  text not null unique,                -- AT, QJ…
  gender       text not null check (gender in ('men', 'women', 'unisex')),
  size_type    text not null check (size_type in ('letter', 'waist')),
  image_path   text,
  sort_order   int  not null default 0
);


-- ---------------------------------------------------------------------
-- 5. products — sản phẩm (giá đặt ở đây, mọi SKU cùng giá)
-- ---------------------------------------------------------------------
create table public.products (
  id           uuid primary key default gen_random_uuid(),
  code         text not null unique,                -- AT001…
  name         text not null,
  description  text,
  category_id  uuid not null references public.categories(id) on delete restrict,
  material     text,
  fit          text not null check (fit in ('regular', 'slim', 'oversize')),
  base_price   int  not null check (base_price > 0),             -- VND
  sale_price   int  check (sale_price is null
                           or (sale_price > 0 and sale_price <= base_price)),
  is_active    boolean not null default true,
  created_at   timestamptz not null default now()
);
create index products_category_id_idx on public.products(category_id);


-- ---------------------------------------------------------------------
-- 6. product_variants — SKU (1 màu + 1 size)
-- ---------------------------------------------------------------------
create table public.product_variants (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products(id) on delete restrict,
  sku         text not null unique,                 -- AT001-BLACK-M
  color_code  text not null,                        -- black, white…
  color_name  text not null,                        -- Đen, Trắng…
  size        text not null,                        -- XS–XXL hoặc 28–36
  is_active   boolean not null default true,
  constraint product_variants_unique_color_size unique (product_id, color_code, size)
);
create index product_variants_product_id_idx on public.product_variants(product_id);


-- ---------------------------------------------------------------------
-- 7. product_media — ảnh và video (chỉ lưu đường dẫn trong bucket)
-- ---------------------------------------------------------------------
create table public.product_media (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products(id) on delete cascade,
  color_code  text,                                 -- null = dùng chung
  media_type  text not null check (media_type in ('image', 'video')),
  bucket      text not null check (bucket in ('product-images', 'product-video')),
  path        text not null,                        -- products/AT001/black/1.webp
  sort_order  int  not null,                        -- 1 = ảnh đại diện
  constraint product_media_type_matches_bucket check (
    (media_type = 'image' and bucket = 'product-images') or
    (media_type = 'video' and bucket = 'product-video')
  )
);
create index product_media_product_sort_idx on public.product_media(product_id, sort_order);


-- ---------------------------------------------------------------------
-- 8. inventory — tồn kho theo (chi nhánh, SKU)
--    Có thể bán = quantity − reserved_quantity
-- ---------------------------------------------------------------------
create table public.inventory (
  id                 uuid primary key default gen_random_uuid(),
  branch_id          uuid not null references public.branches(id) on delete restrict,
  variant_id         uuid not null references public.product_variants(id) on delete restrict,
  quantity           int  not null default 0 check (quantity >= 0),
  reserved_quantity  int  not null default 0,
  updated_at         timestamptz not null default now(),
  constraint inventory_unique_branch_variant unique (branch_id, variant_id),
  constraint inventory_reserved_valid
    check (reserved_quantity >= 0 and reserved_quantity <= quantity)
);
create index inventory_variant_id_idx on public.inventory(variant_id);
create trigger inventory_set_updated_at
  before update on public.inventory
  for each row execute function public.set_updated_at();


-- ---------------------------------------------------------------------
-- 9. size_charts — bảng size cho chatbot
--    product_id = null → bảng chung của danh mục
--    product_id có giá trị → bảng riêng, ghi đè bảng danh mục
-- ---------------------------------------------------------------------
create table public.size_charts (
  id             uuid primary key default gen_random_uuid(),
  category_id    uuid not null references public.categories(id) on delete cascade,
  product_id     uuid references public.products(id) on delete cascade,
  size           text not null,
  height_min_cm  int  not null,
  height_max_cm  int  not null,
  weight_min_kg  int  not null,
  weight_max_kg  int  not null,
  chest_cm       int,
  waist_cm       int,
  length_cm      int,
  constraint size_charts_height_range check (height_min_cm <= height_max_cm),
  constraint size_charts_weight_range check (weight_min_kg <= weight_max_kg),
  constraint size_charts_unique unique nulls not distinct (category_id, product_id, size)
);


-- ---------------------------------------------------------------------
-- 10. store_policies — chính sách và FAQ (chatbot RAG)
--     vector(1536): số chiều phải khớp model embedding sẽ chọn
-- ---------------------------------------------------------------------
create table public.store_policies (
  id          uuid primary key default gen_random_uuid(),
  topic       text not null,                        -- return, pickup, payment…
  title       text not null,
  content     text not null,
  embedding   extensions.vector(1536),
  updated_at  timestamptz not null default now()
);
create trigger store_policies_set_updated_at
  before update on public.store_policies
  for each row execute function public.set_updated_at();


-- ---------------------------------------------------------------------
-- 11. chat_messages — lịch sử chat
-- ---------------------------------------------------------------------
create table public.chat_messages (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  session_id  uuid not null,
  role        text not null check (role in ('user', 'assistant')),
  content     text not null,
  created_at  timestamptz not null default now()
);
create index chat_messages_session_idx
  on public.chat_messages(user_id, session_id, created_at);


-- ---------------------------------------------------------------------
-- 12. cart_items — giỏ hàng
-- ---------------------------------------------------------------------
create table public.cart_items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  variant_id  uuid not null references public.product_variants(id) on delete cascade,
  quantity    int  not null check (quantity between 1 and 10),
  added_at    timestamptz not null default now(),
  constraint cart_items_unique_user_variant unique (user_id, variant_id)
);


-- ---------------------------------------------------------------------
-- 13. orders — đơn hàng (nhận tại một chi nhánh)
-- ---------------------------------------------------------------------
create sequence public.order_code_seq;

create table public.orders (
  id               uuid primary key default gen_random_uuid(),
  order_code       text not null unique,            -- DH20261022-0001
  user_id          uuid not null references public.profiles(id) on delete restrict,
  branch_id        uuid not null references public.branches(id) on delete restrict,
  status           text not null default 'pending'
                   check (status in ('pending', 'confirmed', 'ready_for_pickup',
                                     'completed', 'cancelled', 'expired')),
  total_amount     int  not null check (total_amount >= 0),        -- VND
  customer_name    text not null,
  customer_phone   text not null,
  note             text,
  pickup_deadline  timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  completed_at     timestamptz
);
create index orders_user_created_idx   on public.orders(user_id, created_at desc);
create index orders_branch_status_idx  on public.orders(branch_id, status);
create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();


-- ---------------------------------------------------------------------
-- 14. order_items — chi tiết đơn
--     product_id lưu thêm để Apriori gom theo sản phẩm không cần join
-- ---------------------------------------------------------------------
create table public.order_items (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders(id) on delete cascade,
  variant_id  uuid not null references public.product_variants(id) on delete restrict,
  product_id  uuid not null references public.products(id) on delete restrict,
  quantity    int  not null check (quantity > 0),
  unit_price  int  not null check (unit_price > 0),             -- giá tại lúc mua
  constraint order_items_unique_order_variant unique (order_id, variant_id)
);
create index order_items_product_id_idx on public.order_items(product_id);


-- ---------------------------------------------------------------------
-- 15. association_rules — luật gợi ý sinh từ Apriori
-- ---------------------------------------------------------------------
create table public.association_rules (
  id              uuid primary key default gen_random_uuid(),
  antecedent_ids  uuid[]  not null,                 -- sản phẩm đã mua
  consequent_ids  uuid[]  not null,                 -- sản phẩm gợi ý
  support         numeric not null check (support between 0 and 1),
  confidence      numeric not null check (confidence between 0 and 1),
  lift            numeric not null check (lift > 0),
  generated_at    timestamptz not null default now()
);
create index association_rules_antecedent_gin
  on public.association_rules using gin (antecedent_ids);


-- ---------------------------------------------------------------------
-- 16. Tự tạo profiles khi có người đăng ký qua Supabase Auth
--     full_name lấy từ metadata lúc đăng ký, nếu không có thì lấy phần
--     trước @ của email. App gửi metadata như sau:
--     supabase.auth.signUp({ email, password,
--        options: { data: { full_name: 'Nguyễn Văn A' } } })
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''),
             split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
