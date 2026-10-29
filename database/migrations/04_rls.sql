-- =====================================================================
-- 04_rls.sql — Phân quyền (Row Level Security) + quyền Storage
-- Chạy SAU 01, 02, 03.
--
-- Ai được làm gì:
--   Khách vãng lai (anon) : xem danh mục, sản phẩm, SKU, ảnh, bảng size,
--                           chính sách, tồn kho, chi nhánh, luật gợi ý
--   Khách đăng nhập       : + xem/sửa hồ sơ của mình (trừ role, branch_id)
--                           + giỏ hàng của mình, đơn hàng của mình, chat của mình
--   Manager               : + xem đơn của chi nhánh mình
--   Admin                 : + sửa danh mục, sản phẩm, SKU, ảnh, bảng size,
--                             chính sách, chi nhánh; xem mọi đơn và hồ sơ;
--                             đổi role người dùng; upload ảnh/video
--
-- Không ai (kể cả admin) được ghi thẳng vào orders, order_items, inventory:
-- mọi thay đổi đi qua hàm ở file 02 (place_order, update_order_status, restock).
-- Hàm security definer do chủ bảng tạo nên vẫn chạy được khi bật RLS.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Hàm kiểm tra vai trò (security definer để đọc profiles không bị
--    vòng lặp RLS)
-- ---------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles
                 where id = auth.uid() and role = 'admin');
$$;

create or replace function public.is_manager_of(p_branch_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles
                 where id = auth.uid() and role = 'manager' and branch_id = p_branch_id);
$$;

grant execute on function public.is_admin()            to anon, authenticated;
grant execute on function public.is_manager_of(uuid)   to anon, authenticated;


-- ---------------------------------------------------------------------
-- 2. Bật RLS cho cả 14 bảng
--    Bật xong mà chưa có policy = không ai đọc/ghi được (trừ hàm ở file 02)
-- ---------------------------------------------------------------------
alter table public.branches          enable row level security;
alter table public.profiles          enable row level security;
alter table public.categories        enable row level security;
alter table public.products          enable row level security;
alter table public.product_variants  enable row level security;
alter table public.product_media     enable row level security;
alter table public.inventory         enable row level security;
alter table public.size_charts       enable row level security;
alter table public.store_policies    enable row level security;
alter table public.chat_messages     enable row level security;
alter table public.cart_items        enable row level security;
alter table public.orders            enable row level security;
alter table public.order_items       enable row level security;
alter table public.association_rules enable row level security;


-- ---------------------------------------------------------------------
-- 3. Dữ liệu danh mục: ai cũng đọc được, chỉ admin sửa
-- ---------------------------------------------------------------------

-- branches
create policy "branches: mọi người xem chi nhánh đang hoạt động"
  on public.branches for select to anon, authenticated
  using (is_active or public.is_admin());
create policy "branches: admin quản lý"
  on public.branches for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- categories
create policy "categories: mọi người xem"
  on public.categories for select to anon, authenticated
  using (true);
create policy "categories: admin quản lý"
  on public.categories for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- products (sản phẩm ẩn chỉ admin thấy)
create policy "products: mọi người xem sản phẩm đang bán"
  on public.products for select to anon, authenticated
  using (is_active or public.is_admin());
create policy "products: admin quản lý"
  on public.products for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- product_variants
create policy "variants: mọi người xem SKU đang bán"
  on public.product_variants for select to anon, authenticated
  using (is_active or public.is_admin());
create policy "variants: admin quản lý"
  on public.product_variants for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- product_media
create policy "media: mọi người xem"
  on public.product_media for select to anon, authenticated
  using (true);
create policy "media: admin quản lý"
  on public.product_media for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- size_charts (chatbot đọc để gợi ý size)
create policy "size_charts: mọi người xem"
  on public.size_charts for select to anon, authenticated
  using (true);
create policy "size_charts: admin quản lý"
  on public.size_charts for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- store_policies
create policy "store_policies: mọi người xem"
  on public.store_policies for select to anon, authenticated
  using (true);
create policy "store_policies: admin quản lý"
  on public.store_policies for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- association_rules (app đọc để hiện "Thường mua cùng")
-- Ghi luật mới: script Apriori chạy bằng service_role (bỏ qua RLS)
create policy "rules: mọi người xem"
  on public.association_rules for select to anon, authenticated
  using (true);


-- ---------------------------------------------------------------------
-- 4. inventory: ai cũng xem được (để hiện còn/hết hàng),
--    KHÔNG có policy ghi → chỉ sửa qua place_order / update_order_status / restock
-- ---------------------------------------------------------------------
create policy "inventory: mọi người xem"
  on public.inventory for select to anon, authenticated
  using (true);


-- ---------------------------------------------------------------------
-- 5. profiles: xem/sửa hồ sơ của mình; admin xem tất cả
--    Khách KHÔNG được tự đổi role hoặc branch_id → chặn ở mức cột:
--    chỉ cấp quyền UPDATE cho các cột cá nhân.
-- ---------------------------------------------------------------------
create policy "profiles: xem hồ sơ của mình, admin xem tất cả"
  on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
create policy "profiles: sửa hồ sơ của mình"
  on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (full_name, phone, gender, height_cm, weight_kg)
  on public.profiles to authenticated;

-- Admin đổi role / gán chi nhánh cho người dùng qua hàm này
create or replace function public.set_user_role(
  p_user_id    uuid,
  p_role       text,
  p_branch_id  uuid default null
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.profiles;
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN: Chỉ admin được đổi vai trò';
  end if;
  update public.profiles
  set role = p_role,
      branch_id = case when p_role = 'manager' then p_branch_id else null end
  where id = p_user_id
  returning * into v_row;
  if v_row.id is null then
    raise exception 'USER_NOT_FOUND: Không tìm thấy người dùng';
  end if;
  return v_row;
end;
$$;
revoke execute on function public.set_user_role(uuid, text, uuid) from public, anon;
grant  execute on function public.set_user_role(uuid, text, uuid) to authenticated;


-- ---------------------------------------------------------------------
-- 6. cart_items: mỗi người chỉ thấy và sửa giỏ của mình
-- ---------------------------------------------------------------------
create policy "cart: xem giỏ của mình"
  on public.cart_items for select to authenticated
  using (user_id = auth.uid());
create policy "cart: thêm vào giỏ của mình"
  on public.cart_items for insert to authenticated
  with check (user_id = auth.uid());
create policy "cart: sửa số lượng trong giỏ của mình"
  on public.cart_items for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "cart: xóa khỏi giỏ của mình"
  on public.cart_items for delete to authenticated
  using (user_id = auth.uid());


-- ---------------------------------------------------------------------
-- 7. orders, order_items: chỉ XEM; tạo/đổi trạng thái qua hàm ở file 02
--    Khách thấy đơn của mình; manager thấy đơn chi nhánh mình; admin thấy hết
-- ---------------------------------------------------------------------
create policy "orders: khách xem đơn của mình, manager xem đơn chi nhánh, admin xem hết"
  on public.orders for select to authenticated
  using (user_id = auth.uid()
         or public.is_manager_of(branch_id)
         or public.is_admin());

create policy "order_items: xem chi tiết của đơn mình được xem"
  on public.order_items for select to authenticated
  using (exists (
    select 1 from public.orders o
    where o.id = order_items.order_id
      and (o.user_id = auth.uid() or public.is_manager_of(o.branch_id) or public.is_admin())
  ));

-- Chặn thêm một lớp ở mức quyền bảng (phòng khi lỡ tạo policy ghi sau này)
revoke insert, update, delete on public.orders      from anon, authenticated;
revoke insert, update, delete on public.order_items from anon, authenticated;
revoke insert, update, delete on public.inventory   from anon, authenticated;


-- ---------------------------------------------------------------------
-- 8. chat_messages: mỗi người xem và gửi tin của mình
--    Khách chỉ ghi được tin role = 'user'. Tin trả lời (role = 'assistant')
--    do backend chatbot (Edge Function dùng service_role) ghi.
-- ---------------------------------------------------------------------
create policy "chat: xem lịch sử chat của mình"
  on public.chat_messages for select to authenticated
  using (user_id = auth.uid());
create policy "chat: gửi tin nhắn của mình"
  on public.chat_messages for insert to authenticated
  with check (user_id = auth.uid() and role = 'user');


-- ---------------------------------------------------------------------
-- 9. Storage: bucket public nên ai cũng XEM ảnh/video qua link.
--    Upload / sửa / xóa file: chỉ admin.
-- ---------------------------------------------------------------------
create policy "storage: admin upload ảnh/video sản phẩm"
  on storage.objects for insert to authenticated
  with check (bucket_id in ('product-images', 'product-video') and public.is_admin());
create policy "storage: admin sửa ảnh/video sản phẩm"
  on storage.objects for update to authenticated
  using (bucket_id in ('product-images', 'product-video') and public.is_admin());
create policy "storage: admin xóa ảnh/video sản phẩm"
  on storage.objects for delete to authenticated
  using (bucket_id in ('product-images', 'product-video') and public.is_admin());


-- =====================================================================
-- Tạo tài khoản admin đầu tiên (chạy trong SQL Editor — SQL Editor chạy
-- bằng quyền postgres nên không bị RLS chặn):
--
-- update public.profiles set role = 'admin', branch_id = null
-- where id = (select id from auth.users where email = 'admin@test.com');
--
-- Kiểm tra RLS đã bật hết chưa (cột rowsecurity phải là true cả 14 dòng):
--   select tablename, rowsecurity from pg_tables where schemaname = 'public';
-- =====================================================================
