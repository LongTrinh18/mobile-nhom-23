-- =====================================================================
-- 02_functions.sql — Logic nghiệp vụ: giỏ hàng, đặt đơn, trạng thái đơn,
-- tồn kho, job hết hạn nhận hàng.
-- Chạy SAU 01_schema.sql. Nguồn: sheet "Quy tắc tồn kho", "Trạng thái đơn".
--
-- Nguyên tắc: app KHÔNG sửa trực tiếp inventory / orders / order_items.
-- Mọi thay đổi đi qua các hàm dưới đây (gọi bằng supabase.rpc(...)),
-- để kiểm tra quyền + cập nhật tồn kho trong cùng một transaction.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. View: số lượng có thể bán theo chi nhánh + SKU
--    App đọc view này để hiện "Còn hàng / Hết hàng" ở từng chi nhánh.
-- ---------------------------------------------------------------------
drop view if exists public.v_inventory_available;
create view public.v_inventory_available
with (security_invoker = true)
as
select
  i.branch_id,
  b.code                                   as branch_code,
  b.name                                   as branch_name,
  i.variant_id,
  v.sku,
  v.product_id,
  v.color_code,
  v.color_name,
  v.size,
  i.quantity - i.reserved_quantity         as available_quantity
from public.inventory i
join public.branches b         on b.id = i.branch_id
join public.product_variants v on v.id = i.variant_id
where b.is_active and v.is_active;


-- ---------------------------------------------------------------------
-- 1b. View: danh sách sản phẩm cho màn Home / Search / Danh mục
--     Gộp sẵn danh mục, giá cuối, ảnh đại diện, tổng tồn kho → app chỉ
--     đọc 1 view, không phải tự join.
--     App: supabase.from('v_product_catalog').select('*').eq('category_slug','ao-thun')
--     Ảnh: supabase.storage.from(thumbnail_bucket).getPublicUrl(thumbnail_path)
-- ---------------------------------------------------------------------
drop view if exists public.v_product_catalog;
create view public.v_product_catalog
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
  p.created_at
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
where p.is_active;


-- ---------------------------------------------------------------------
-- 2. Hàm hỗ trợ: lấy hồ sơ của người đang đăng nhập
-- ---------------------------------------------------------------------
create or replace function public.current_profile()
returns public.profiles
language sql
stable
security definer
set search_path = public
as $$
  select * from public.profiles where id = auth.uid();
$$;


-- ---------------------------------------------------------------------
-- 3. add_to_cart — thêm vào giỏ; đã có cùng SKU thì cộng dồn (tối đa 10)
--    App: supabase.rpc('add_to_cart', { p_variant_id, p_quantity })
-- ---------------------------------------------------------------------
create or replace function public.add_to_cart(
  p_variant_id uuid,
  p_quantity   int default 1
)
returns public.cart_items
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_row  public.cart_items;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED: Bạn cần đăng nhập';
  end if;
  if p_quantity is null or p_quantity < 1 then
    raise exception 'INVALID_QUANTITY: Số lượng phải từ 1 trở lên';
  end if;
  if not exists (
    select 1
    from public.product_variants v
    join public.products p on p.id = v.product_id
    where v.id = p_variant_id and v.is_active and p.is_active
  ) then
    raise exception 'VARIANT_NOT_AVAILABLE: Sản phẩm không còn bán';
  end if;

  insert into public.cart_items (user_id, variant_id, quantity)
  values (v_uid, p_variant_id, least(p_quantity, 10))
  on conflict (user_id, variant_id)
  do update set quantity = least(public.cart_items.quantity + excluded.quantity, 10)
  returning * into v_row;

  return v_row;
end;
$$;


-- ---------------------------------------------------------------------
-- 4. place_order — đặt đơn nhận tại chi nhánh
--
--    p_items: mảng JSON [{ "variant_id": "...", "quantity": 2 }, ...]
--    App:
--      const { data, error } = await supabase.rpc('place_order', {
--        p_branch_id, p_items, p_customer_name, p_customer_phone, p_note })
--
--    Các bước (một transaction — lỗi ở đâu thì không có gì được ghi):
--      1. Gom các dòng trùng SKU, kiểm tra số lượng.
--      2. Khóa dòng tồn kho (FOR UPDATE) theo thứ tự variant_id để hai
--         khách đặt cùng lúc phải xếp hàng → không bán quá số có.
--      3. Thiếu hàng ở bất kỳ SKU nào → báo lỗi OUT_OF_STOCK kèm danh sách SKU.
--      4. Lấy giá từ database (sale_price nếu có, không thì base_price).
--      5. Tạo orders + order_items, tăng reserved_quantity, xóa món đã đặt
--         khỏi giỏ.
-- ---------------------------------------------------------------------
create or replace function public.place_order(
  p_branch_id       uuid,
  p_items           jsonb,
  p_customer_name   text,
  p_customer_phone  text,
  p_note            text default null
)
returns table (order_id uuid, order_code text, total_amount int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_order_id  uuid;
  v_code      text;
  v_total     int := 0;
  v_missing   text[] := '{}';
  r           record;
begin
  -- Kiểm tra đầu vào ---------------------------------------------------
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED: Bạn cần đăng nhập';
  end if;
  if coalesce(trim(p_customer_name), '') = '' or coalesce(trim(p_customer_phone), '') = '' then
    raise exception 'INVALID_CUSTOMER: Thiếu tên hoặc số điện thoại người nhận';
  end if;
  if not exists (select 1 from public.branches where id = p_branch_id and is_active) then
    raise exception 'INVALID_BRANCH: Chi nhánh không tồn tại hoặc đã ngừng hoạt động';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'EMPTY_ORDER: Đơn hàng chưa có sản phẩm';
  end if;

  -- Gom dòng trùng SKU vào bảng tạm ------------------------------------
  create temp table _req on commit drop as
  select (x ->> 'variant_id')::uuid    as variant_id,
         sum((x ->> 'quantity')::int)  as quantity
  from jsonb_array_elements(p_items) x
  group by 1;

  if exists (select 1 from _req where variant_id is null or quantity is null or quantity < 1) then
    raise exception 'INVALID_QUANTITY: Mỗi sản phẩm phải có variant_id và số lượng ≥ 1';
  end if;

  if exists (select 1 from _req q
             where not exists (select 1 from public.product_variants v where v.id = q.variant_id)) then
    raise exception 'VARIANT_NOT_FOUND: Có sản phẩm không tồn tại';
  end if;

  -- Khóa tồn kho (theo thứ tự variant_id để tránh deadlock) ---------------
  perform 1
  from public.inventory i
  where i.branch_id = p_branch_id
    and i.variant_id in (select variant_id from _req)
  order by i.variant_id
  for update;

  -- Kiểm tra còn hàng (đọc sau khi đã khóa nên số liệu là mới nhất) -------
  for r in
    select q.quantity, v.sku, (v.is_active and p.is_active) as on_sale,
           i.id as inventory_id, i.quantity - i.reserved_quantity as available
    from _req q
    join public.product_variants v on v.id = q.variant_id
    join public.products p         on p.id = v.product_id
    left join public.inventory i   on i.variant_id = q.variant_id
                                  and i.branch_id  = p_branch_id
    order by v.sku
  loop
    if not r.on_sale or r.inventory_id is null or r.available < r.quantity then
      v_missing := v_missing || r.sku;
    end if;
  end loop;

  if array_length(v_missing, 1) > 0 then
    raise exception 'OUT_OF_STOCK: %', array_to_string(v_missing, ', ');
  end if;

  -- Tạo đơn -------------------------------------------------------------
  v_code := 'DH' || to_char(now() at time zone 'Asia/Ho_Chi_Minh', 'YYYYMMDD')
            || '-' || lpad(nextval('public.order_code_seq')::text, 4, '0');

  insert into public.orders (order_code, user_id, branch_id, total_amount,
                             customer_name, customer_phone, note)
  values (v_code, v_uid, p_branch_id, 0,
          trim(p_customer_name), trim(p_customer_phone), p_note)
  returning id into v_order_id;

  insert into public.order_items (order_id, variant_id, product_id, quantity, unit_price)
  select v_order_id, q.variant_id, v.product_id, q.quantity,
         coalesce(p.sale_price, p.base_price)
  from _req q
  join public.product_variants v on v.id = q.variant_id
  join public.products p         on p.id = v.product_id;

  select sum(quantity * unit_price) into v_total
  from public.order_items where order_items.order_id = v_order_id;

  update public.orders set total_amount = v_total where id = v_order_id;

  -- Giữ hàng ------------------------------------------------------------
  update public.inventory i
  set reserved_quantity = i.reserved_quantity + q.quantity
  from _req q
  where i.branch_id = p_branch_id and i.variant_id = q.variant_id;

  -- Xóa món đã đặt khỏi giỏ ---------------------------------------------
  delete from public.cart_items c
  using _req q
  where c.user_id = v_uid and c.variant_id = q.variant_id;

  drop table _req;

  return query select v_order_id, v_code, v_total;
end;
$$;


-- ---------------------------------------------------------------------
-- 5. _apply_order_status — hàm NỘI BỘ: đổi trạng thái + cập nhật tồn kho.
--    Không kiểm tra quyền; chỉ được gọi từ update_order_status và
--    expire_overdue_orders. App không gọi trực tiếp.
-- ---------------------------------------------------------------------
create or replace function public._apply_order_status(
  p_order       public.orders,
  p_new_status  text
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.orders;
begin
  -- Tác động lên tồn kho
  if p_new_status in ('cancelled', 'expired') then
    -- Trả lại hàng đang giữ
    update public.inventory i
    set reserved_quantity = i.reserved_quantity - oi.quantity
    from public.order_items oi
    where oi.order_id = p_order.id
      and i.branch_id = p_order.branch_id
      and i.variant_id = oi.variant_id;

  elsif p_new_status = 'completed' then
    -- Khách đã nhận: trừ kho thật
    update public.inventory i
    set quantity          = i.quantity - oi.quantity,
        reserved_quantity = i.reserved_quantity - oi.quantity
    from public.order_items oi
    where oi.order_id = p_order.id
      and i.branch_id = p_order.branch_id
      and i.variant_id = oi.variant_id;
  end if;

  update public.orders
  set status          = p_new_status,
      pickup_deadline = case when p_new_status = 'ready_for_pickup'
                             then now() + interval '3 days'
                             else pickup_deadline end,
      completed_at    = case when p_new_status = 'completed'
                             then now() else completed_at end
  where id = p_order.id
  returning * into v_row;

  return v_row;
end;
$$;


-- ---------------------------------------------------------------------
-- 6. update_order_status — đổi trạng thái đơn (có kiểm tra quyền)
--    App: supabase.rpc('update_order_status',
--                      { p_order_id, p_new_status, p_reason })
--
--    Chuyển hợp lệ (sheet "Trạng thái đơn"):
--      pending          → confirmed         : manager
--      pending          → cancelled         : khách (chủ đơn), manager
--      confirmed        → ready_for_pickup  : manager
--      confirmed        → cancelled         : khách (chủ đơn), manager
--      ready_for_pickup → completed         : manager
--      ready_for_pickup → cancelled         : manager
--      ready_for_pickup → expired           : chỉ hệ thống (job), không qua hàm này
--    "manager" = manager của đúng chi nhánh của đơn, hoặc admin.
-- ---------------------------------------------------------------------
create or replace function public.update_order_status(
  p_order_id    uuid,
  p_new_status  text,
  p_reason      text default null
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me          public.profiles;
  v_order       public.orders;
  v_is_owner    boolean;
  v_is_manager  boolean;
  v_allowed     boolean := false;
begin
  select * into v_me from public.profiles where id = auth.uid();
  if v_me.id is null then
    raise exception 'NOT_AUTHENTICATED: Bạn cần đăng nhập';
  end if;

  -- Khóa đơn để không ai đổi trạng thái cùng lúc
  select * into v_order from public.orders where id = p_order_id for update;
  if v_order.id is null then
    raise exception 'ORDER_NOT_FOUND: Không tìm thấy đơn';
  end if;

  v_is_owner   := v_order.user_id = v_me.id;
  v_is_manager := v_me.role = 'admin'
                  or (v_me.role = 'manager' and v_me.branch_id = v_order.branch_id);

  v_allowed := case
    when v_order.status = 'pending'          and p_new_status = 'confirmed'        then v_is_manager
    when v_order.status = 'pending'          and p_new_status = 'cancelled'        then v_is_owner or v_is_manager
    when v_order.status = 'confirmed'        and p_new_status = 'ready_for_pickup' then v_is_manager
    when v_order.status = 'confirmed'        and p_new_status = 'cancelled'        then v_is_owner or v_is_manager
    when v_order.status = 'ready_for_pickup' and p_new_status = 'completed'        then v_is_manager
    when v_order.status = 'ready_for_pickup' and p_new_status = 'cancelled'        then v_is_manager
    else false
  end;

  if not v_allowed then
    raise exception 'INVALID_TRANSITION: Không thể chuyển đơn từ % sang %',
      v_order.status, p_new_status;
  end if;

  -- Ghi lý do hủy vào note
  if p_new_status = 'cancelled' and coalesce(trim(p_reason), '') <> '' then
    update public.orders
    set note = concat_ws(' | ', nullif(note, ''), 'Lý do hủy: ' || trim(p_reason))
    where id = v_order.id
    returning * into v_order;
  end if;

  return public._apply_order_status(v_order, p_new_status);
end;
$$;


-- ---------------------------------------------------------------------
-- 7. expire_overdue_orders — chuyển đơn quá hạn nhận sang expired
--    Chạy tự động mỗi giờ bằng pg_cron (mục 9). Trả về số đơn đã xử lý.
-- ---------------------------------------------------------------------
create or replace function public.expire_overdue_orders()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_count int := 0;
begin
  for v_order in
    select * from public.orders
    where status = 'ready_for_pickup' and pickup_deadline < now()
    for update skip locked
  loop
    perform public._apply_order_status(v_order, 'expired');
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;


-- ---------------------------------------------------------------------
-- 8. restock — nhập thêm hàng (manager của chi nhánh đó hoặc admin)
--    App: supabase.rpc('restock', { p_branch_id, p_variant_id, p_quantity })
-- ---------------------------------------------------------------------
create or replace function public.restock(
  p_branch_id   uuid,
  p_variant_id  uuid,
  p_quantity    int
)
returns public.inventory
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me  public.profiles;
  v_row public.inventory;
begin
  select * into v_me from public.profiles where id = auth.uid();
  if not (v_me.role = 'admin' or (v_me.role = 'manager' and v_me.branch_id = p_branch_id)) then
    raise exception 'FORBIDDEN: Chỉ manager của chi nhánh hoặc admin được nhập hàng';
  end if;
  if p_quantity is null or p_quantity < 1 then
    raise exception 'INVALID_QUANTITY: Số lượng nhập phải từ 1 trở lên';
  end if;

  insert into public.inventory (branch_id, variant_id, quantity)
  values (p_branch_id, p_variant_id, p_quantity)
  on conflict (branch_id, variant_id)
  do update set quantity = public.inventory.quantity + excluded.quantity
  returning * into v_row;

  return v_row;
end;
$$;


-- ---------------------------------------------------------------------
-- 9. Quyền gọi hàm
--    Mặc định Postgres cho mọi người gọi hàm → thu hồi rồi cấp lại đúng chỗ.
-- ---------------------------------------------------------------------
revoke execute on function public.current_profile()                         from public, anon;
revoke execute on function public.add_to_cart(uuid, int)                    from public, anon;
revoke execute on function public.place_order(uuid, jsonb, text, text, text) from public, anon;
revoke execute on function public.update_order_status(uuid, text, text)     from public, anon;
revoke execute on function public.restock(uuid, uuid, int)                  from public, anon;
revoke execute on function public._apply_order_status(public.orders, text)  from public, anon, authenticated;
revoke execute on function public.expire_overdue_orders()                   from public, anon, authenticated;

grant execute on function public.current_profile()                         to authenticated;
grant execute on function public.add_to_cart(uuid, int)                    to authenticated;
grant execute on function public.place_order(uuid, jsonb, text, text, text) to authenticated;
grant execute on function public.update_order_status(uuid, text, text)     to authenticated;
grant execute on function public.restock(uuid, uuid, int)                  to authenticated;

grant select on public.v_inventory_available to anon, authenticated;
grant select on public.v_product_catalog     to anon, authenticated;


-- ---------------------------------------------------------------------
-- 10. Job tự động: mỗi giờ (phút 0) quét đơn quá hạn nhận
--     Supabase: nếu báo lỗi "extension pg_cron does not exist", vào
--     Database → Extensions → bật pg_cron, rồi chạy lại riêng mục này.
-- ---------------------------------------------------------------------
create extension if not exists pg_cron;

select cron.schedule(
  'expire-overdue-orders',
  '0 * * * *',
  $$ select public.expire_overdue_orders(); $$
);
