-- =====================================================================
-- 09_fix_checkout_flow.sql — sửa lỗi phát hiện khi rà soát luồng đặt hàng
-- Chạy SAU 01 → 08 (đúng thứ tự tên file), trong Supabase SQL Editor.
-- Cả file là một transaction: lỗi ở đâu thì không có gì thay đổi.
-- Chạy lại nhiều lần vẫn an toàn (create or replace / if exists).
--
--  1. place_buy_now_order (07) luôn lỗi: không ghi subtotal_amount (NOT NULL
--     từ file 05), không chống gọi lặp, không hỗ trợ giao hàng → xóa.
--     "Mua ngay" gọi thẳng place_order: hàm này không đụng tới giỏ hàng.
--  2. Đặt từ giỏ xong, món đã đặt vẫn nằm trong giỏ → thêm place_cart_order:
--     gọi place_order rồi xóa đúng các dòng giỏ đã đặt, trong CÙNG giao dịch.
--  3. place_order: tràn số int khi tính giảm giá; vùng giao hàng được kiểm tra
--     theo chi nhánh gần nhất bất kỳ thay vì chi nhánh thực sự giao.
--  4. Bán chạy chỉ tính đơn pickup 'completed' → tính cả đơn giao 'delivered'.
--  5. update_order_status: người ngoài (khách khác, manager chi nhánh khác)
--     nhận ORDER_NOT_FOUND thay vì INVALID_TRANSITION (không lộ đơn tồn tại).
--  6. restock: tài khoản không có hồ sơ bị chặn (trước đây lọt qua vì NULL).
--  7. collection_products: policy "using (true)" ở file 05 làm lộ bộ sưu tập
--     và sản phẩm đang ẩn → xóa, chỉ giữ policy chặt của file 06_home_sections.
-- =====================================================================
begin;

-- ---------------------------------------------------------------------
-- 1. Bỏ hàm mua ngay hỏng
-- ---------------------------------------------------------------------
drop function if exists public.place_buy_now_order(uuid, jsonb, text, text, text);


-- ---------------------------------------------------------------------
-- 3. place_order — giữ nguyên chữ ký và kết quả của file 06
-- ---------------------------------------------------------------------
create or replace function public.place_order(
  p_items             jsonb,
  p_fulfillment_type  text,
  p_customer_name     text,
  p_customer_phone    text,
  p_idempotency_key   uuid,
  p_branch_id         uuid    default null,
  p_delivery_address  text    default null,
  p_delivery_lat      numeric default null,
  p_delivery_lng      numeric default null,
  p_voucher_code      text    default null,
  p_note              text    default null
)
returns table (
  order_id          uuid,
  order_code        text,
  status            text,
  fulfillment_type  text,
  branch_id         uuid,
  branch_name       text,
  branch_address    text,
  subtotal_amount   int,
  discount_amount   int,
  shipping_fee      int,
  total_amount      int,
  voucher_code      text,
  payment_method    text,
  created_at        timestamptz,
  is_duplicate      boolean
)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  c_shipping_fee     constant int     := 30000;    -- QD20
  c_free_ship_above  constant int     := 500000;   -- QD20: tiền hàng sau giảm giá > mức này
  c_max_distance_km  constant numeric := 30;       -- giả định "trong TP.HCM", chưa chốt

  v_uid        uuid := auth.uid();
  v_type       text := lower(trim(coalesce(p_fulfillment_type, '')));
  v_phone      text := regexp_replace(coalesce(p_customer_phone, ''), '\s', '', 'g');
  v_address    text;
  v_lat        numeric;
  v_lng        numeric;
  v_vcode      text := nullif(upper(trim(coalesce(p_voucher_code, ''))), '');
  v_voucher    public.vouchers;
  v_existing   uuid;
  v_branch_id  uuid;
  v_nearest    numeric;
  v_missing    text;
  v_subtotal_b bigint;
  v_subtotal   int;
  v_discount   int := 0;
  v_ship       int := 0;
  v_order_id   uuid;
  v_code       text;
begin
  -- 1. Đăng nhập + chống gọi lặp ---------------------------------------
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED: Bạn cần đăng nhập';
  end if;
  if p_idempotency_key is null then
    raise exception 'INVALID_REQUEST: Thiếu idempotency_key';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_uid::text || ':' || p_idempotency_key::text, 0));

  select o.id into v_existing
  from public.orders o
  where o.user_id = v_uid and o.idempotency_key = p_idempotency_key;

  if v_existing is not null then
    return query select s.*, true from public._order_summary(v_existing) s;
    return;
  end if;

  -- 2. Kiểm tra đầu vào -------------------------------------------------
  if v_type not in ('pickup', 'delivery') then
    raise exception 'INVALID_FULFILLMENT: Cách nhận phải là pickup hoặc delivery';
  end if;
  if coalesce(trim(p_customer_name), '') = '' or v_phone !~ '^(0|\+84)[0-9]{9}$' then
    raise exception 'INVALID_CUSTOMER: Thiếu tên hoặc số điện thoại không hợp lệ';
  end if;

  if v_type = 'delivery' then
    v_address := nullif(trim(coalesce(p_delivery_address, '')), '');
    if v_address is null then
      raise exception 'MISSING_ADDRESS: Đơn giao hàng cần địa chỉ';
    end if;
    if p_delivery_lat is not null and p_delivery_lng is not null then
      if p_delivery_lat not between -90 and 90 or p_delivery_lng not between -180 and 180 then
        raise exception 'INVALID_REQUEST: Tọa độ không hợp lệ';
      end if;
      v_lat := p_delivery_lat;
      v_lng := p_delivery_lng;
    end if;
  end if;

  create temp table _req on commit drop as
    select * from public._normalize_items(p_items);

  select string_agg(q.variant_id::text, ', ') into v_missing
  from _req q
  where not exists (select 1 from public.product_variants v where v.id = q.variant_id);
  if v_missing is not null then
    raise exception 'VARIANT_NOT_FOUND: %', v_missing;
  end if;

  select string_agg(v.sku, ', ' order by v.sku) into v_missing
  from _req q
  join public.product_variants v on v.id = q.variant_id
  join public.products p         on p.id = v.product_id
  where not (v.is_active and p.is_active);
  if v_missing is not null then
    raise exception 'VARIANT_NOT_AVAILABLE: %', v_missing;
  end if;

  -- 3–4. Khóa tồn kho và chọn chi nhánh ---------------------------------
  if v_type = 'pickup' then
    if p_branch_id is null
       or not exists (select 1 from public.branches where id = p_branch_id and is_active) then
      raise exception 'INVALID_BRANCH: Chi nhánh không tồn tại hoặc đã ngừng hoạt động';
    end if;

    perform 1
    from public.inventory i
    where i.branch_id = p_branch_id
      and i.variant_id in (select q.variant_id from _req q)
    order by i.variant_id
    for update;

    select string_agg(format('%s (cần %s, còn %s)',
                             m ->> 'sku', m ->> 'requested', m ->> 'available'), ', ')
      into v_missing
    from public.find_fulfilling_branches(p_items) f
    cross join lateral jsonb_array_elements(f.missing_items) m
    where f.branch_id = p_branch_id;

    if v_missing is not null then
      raise exception 'OUT_OF_STOCK: %', v_missing;
    end if;
    v_branch_id := p_branch_id;

  else
    if v_lat is not null then
      select min(public._distance_km(v_lat, v_lng, b.latitude, b.longitude)) into v_nearest
      from public.branches b
      where b.is_active;
      if v_nearest > c_max_distance_km then
        raise exception 'OUT_OF_DELIVERY_AREA: % km', round(v_nearest, 1);
      end if;
    end if;

    perform 1
    from public.inventory i
    join public.branches b on b.id = i.branch_id
    where b.is_active
      and i.variant_id in (select q.variant_id from _req q)
    order by i.branch_id, i.variant_id
    for update of i;

    -- Đủ hàng → gần nhất → mã chi nhánh; chi nhánh giao phải nằm trong vùng giao
    select f.branch_id into v_branch_id
    from public.find_fulfilling_branches(p_items, v_lat, v_lng) f
    where f.can_fulfill
      and (f.distance_km is null or f.distance_km <= c_max_distance_km)
    limit 1;

    if v_branch_id is null then
      select f.branch_name || ' thiếu ' || string_agg(
               format('%s (cần %s, còn %s)', m ->> 'sku', m ->> 'requested', m ->> 'available'), ', ')
        into v_missing
      from (
        select * from public.find_fulfilling_branches(p_items, v_lat, v_lng) x
        where x.distance_km is null or x.distance_km <= c_max_distance_km
        order by jsonb_array_length(x.missing_items), x.distance_km nulls last, x.branch_code
        limit 1
      ) f
      cross join lateral jsonb_array_elements(f.missing_items) m
      group by f.branch_name;

      raise exception 'NO_BRANCH_AVAILABLE: %', coalesce(v_missing, 'không có chi nhánh trong vùng giao');
    end if;
  end if;

  -- 5. Tiền: giá server, voucher, phí ship (tính bằng bigint/numeric để không tràn số)
  select sum(q.quantity::bigint * coalesce(p.sale_price, p.base_price)) into v_subtotal_b
  from _req q
  join public.product_variants v on v.id = q.variant_id
  join public.products p         on p.id = v.product_id;

  if v_subtotal_b > 2000000000 then
    raise exception 'INVALID_QUANTITY: Giá trị đơn vượt giới hạn cho phép';
  end if;
  v_subtotal := v_subtotal_b::int;

  if v_vcode is not null then
    select * into v_voucher from public.vouchers where code = v_vcode and is_active;
    if v_voucher.code is null or (v_voucher.applies_to = 'delivery' and v_type <> 'delivery') then
      raise exception 'INVALID_VOUCHER: %', v_vcode;
    end if;
    if v_voucher.discount_type = 'percent' then
      v_discount := round(v_subtotal::numeric * v_voucher.discount_value / 100)::int;
    end if;
  end if;

  if v_type = 'delivery' then
    v_ship := case when v_subtotal - v_discount > c_free_ship_above then 0 else c_shipping_fee end;
    if v_voucher.discount_type = 'free_shipping' then
      v_ship := 0;
    end if;
  end if;

  -- 6. Tạo đơn + giữ hàng ------------------------------------------------
  v_code := 'DH' || to_char(now() at time zone 'Asia/Ho_Chi_Minh', 'YYYYMMDD')
            || '-' || lpad(nextval('public.order_code_seq')::text, 4, '0');

  insert into public.orders (
    order_code, user_id, branch_id, fulfillment_type,
    subtotal_amount, discount_amount, shipping_fee, total_amount, voucher_code,
    payment_method, customer_name, customer_phone,
    delivery_address, delivery_lat, delivery_lng, note, idempotency_key)
  values (
    v_code, v_uid, v_branch_id, v_type,
    v_subtotal, v_discount, v_ship, v_subtotal - v_discount + v_ship, v_voucher.code,
    'cod', trim(p_customer_name), v_phone,
    v_address, v_lat, v_lng, nullif(trim(coalesce(p_note, '')), ''), p_idempotency_key)
  returning id into v_order_id;

  insert into public.order_items (order_id, variant_id, product_id, quantity, unit_price)
  select v_order_id, q.variant_id, v.product_id, q.quantity,
         coalesce(p.sale_price, p.base_price)
  from _req q
  join public.product_variants v on v.id = q.variant_id
  join public.products p         on p.id = v.product_id;

  update public.inventory i
  set reserved_quantity = i.reserved_quantity + q.quantity
  from _req q
  where i.branch_id = v_branch_id and i.variant_id = q.variant_id;

  drop table _req;

  return query select s.*, false from public._order_summary(v_order_id) s;
end;
$$;


-- ---------------------------------------------------------------------
-- 2. place_cart_order — đặt các món đã chọn trong giỏ rồi xóa chúng khỏi giỏ
--    App: supabase.rpc('place_cart_order', { ...giống place_order })
--    Gọi lại cùng idempotency_key → trả đơn cũ, KHÔNG xóa giỏ lần nữa.
-- ---------------------------------------------------------------------
create or replace function public.place_cart_order(
  p_items             jsonb,
  p_fulfillment_type  text,
  p_customer_name     text,
  p_customer_phone    text,
  p_idempotency_key   uuid,
  p_branch_id         uuid    default null,
  p_delivery_address  text    default null,
  p_delivery_lat      numeric default null,
  p_delivery_lng      numeric default null,
  p_voucher_code      text    default null,
  p_note              text    default null
)
returns table (
  order_id          uuid,
  order_code        text,
  status            text,
  fulfillment_type  text,
  branch_id         uuid,
  branch_name       text,
  branch_address    text,
  subtotal_amount   int,
  discount_amount   int,
  shipping_fee      int,
  total_amount      int,
  voucher_code      text,
  payment_method    text,
  created_at        timestamptz,
  is_duplicate      boolean
)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  r record;
begin
  for r in
    select * from public.place_order(
      p_items, p_fulfillment_type, p_customer_name, p_customer_phone, p_idempotency_key,
      p_branch_id, p_delivery_address, p_delivery_lat, p_delivery_lng, p_voucher_code, p_note)
  loop
    if not r.is_duplicate then
      delete from public.cart_items c
      where c.user_id = auth.uid()
        and c.variant_id in (select (x ->> 'variant_id')::uuid from jsonb_array_elements(p_items) x);
    end if;

    order_id := r.order_id;         order_code := r.order_code;       status := r.status;
    fulfillment_type := r.fulfillment_type;                           branch_id := r.branch_id;
    branch_name := r.branch_name;   branch_address := r.branch_address;
    subtotal_amount := r.subtotal_amount;  discount_amount := r.discount_amount;
    shipping_fee := r.shipping_fee; total_amount := r.total_amount;   voucher_code := r.voucher_code;
    payment_method := r.payment_method;    created_at := r.created_at; is_duplicate := r.is_duplicate;
    return next;
  end loop;
end;
$$;


-- ---------------------------------------------------------------------
-- 4. Bán chạy: đơn hoàn thành của cả hai cách nhận
-- ---------------------------------------------------------------------
create or replace function public.get_home_best_sellers()
returns table (product_id uuid, units_sold bigint)
language sql
stable
security definer
set search_path = public
as $$
  select oi.product_id, sum(oi.quantity)::bigint as units_sold
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  join public.products p on p.id = oi.product_id
  where o.status in ('completed', 'delivered')
    and coalesce(o.completed_at, o.created_at) >= now() - interval '30 days'
    and p.is_active
  group by oi.product_id
  order by sum(oi.quantity) desc, oi.product_id;
$$;


-- ---------------------------------------------------------------------
-- 5. update_order_status — chỉ khác file 06 ở bước kiểm tra người ngoài
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

  select * into v_order from public.orders where id = p_order_id for update;
  if v_order.id is null then
    raise exception 'ORDER_NOT_FOUND: Không tìm thấy đơn';
  end if;

  v_is_owner   := v_order.user_id = v_me.id;
  v_is_manager := v_me.role = 'admin'
                  or (v_me.role = 'manager' and v_me.branch_id = v_order.branch_id);

  -- Người không được xem đơn thì coi như đơn không tồn tại
  if not (v_is_owner or v_is_manager) then
    raise exception 'ORDER_NOT_FOUND: Không tìm thấy đơn';
  end if;

  if v_order.fulfillment_type = 'pickup' then
    v_allowed := case
      when v_order.status = 'pending'          and p_new_status = 'confirmed'        then v_is_manager
      when v_order.status = 'pending'          and p_new_status = 'cancelled'        then v_is_owner or v_is_manager
      when v_order.status = 'confirmed'        and p_new_status = 'ready_for_pickup' then v_is_manager
      when v_order.status = 'confirmed'        and p_new_status = 'cancelled'        then v_is_owner or v_is_manager
      when v_order.status = 'ready_for_pickup' and p_new_status = 'completed'        then v_is_manager
      when v_order.status = 'ready_for_pickup' and p_new_status = 'cancelled'        then v_is_manager
      else false
    end;
  else
    v_allowed := case
      when v_order.status = 'pending'   and p_new_status = 'confirmed'       then v_is_manager
      when v_order.status = 'pending'   and p_new_status = 'cancelled'       then v_is_owner or v_is_manager
      when v_order.status = 'confirmed' and p_new_status = 'shipping'        then v_is_manager
      when v_order.status = 'confirmed' and p_new_status = 'cancelled'       then v_is_owner or v_is_manager
      when v_order.status = 'shipping'  and p_new_status = 'delivered'       then v_is_manager
      when v_order.status = 'shipping'  and p_new_status = 'delivery_failed' then v_is_manager
      else false
    end;
  end if;

  if not v_allowed then
    raise exception 'INVALID_TRANSITION: Không thể chuyển đơn từ % sang %',
      v_order.status, p_new_status;
  end if;

  if p_new_status in ('cancelled', 'delivery_failed') and coalesce(trim(p_reason), '') <> '' then
    update public.orders
    set note = concat_ws(' | ', nullif(note, ''),
                         case when p_new_status = 'cancelled' then 'Lý do hủy: '
                              else 'Giao thất bại: ' end || trim(p_reason))
    where id = v_order.id
    returning * into v_order;
  end if;

  return public._apply_order_status(v_order, p_new_status);
end;
$$;


-- ---------------------------------------------------------------------
-- 6. restock — người không có hồ sơ (role NULL) không được nhập hàng
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
  if v_me.id is null
     or not coalesce(v_me.role = 'admin' or (v_me.role = 'manager' and v_me.branch_id = p_branch_id), false) then
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
-- 7. Bộ sưu tập: không lộ bộ sưu tập / sản phẩm đang ẩn
--    Hai file 05 và 06_home_sections đều "create table if not exists collections"
--    với cột khác nhau → bổ sung đủ cột cho cả hai thứ tự chạy.
-- ---------------------------------------------------------------------
drop policy if exists "collection_products: mọi người xem" on public.collection_products;

alter table public.collections
  add column if not exists cover_image_path text,
  add column if not exists created_at timestamptz not null default now();

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'collection_products'
                 and policyname = 'collection_products_public_active') then
    create policy collection_products_public_active on public.collection_products for select to anon, authenticated using (
      exists (select 1 from public.collections c where c.id = collection_id and c.is_active)
      and exists (select 1 from public.products p where p.id = product_id and p.is_active)
    );
  end if;
end;
$$;


-- ---------------------------------------------------------------------
-- Quyền gọi hàm
-- ---------------------------------------------------------------------
revoke execute on function public.place_cart_order(jsonb, text, text, text, uuid, uuid, text, numeric, numeric, text, text)
  from public, anon;
grant execute on function public.place_cart_order(jsonb, text, text, text, uuid, uuid, text, numeric, numeric, text, text)
  to authenticated;
revoke execute on function public.place_order(jsonb, text, text, text, uuid, uuid, text, numeric, numeric, text, text)
  from public, anon;
grant execute on function public.place_order(jsonb, text, text, text, uuid, uuid, text, numeric, numeric, text, text)
  to authenticated;
revoke execute on function public.update_order_status(uuid, text, text) from public, anon;
grant execute on function public.update_order_status(uuid, text, text) to authenticated;
revoke execute on function public.restock(uuid, uuid, int) from public, anon;
grant execute on function public.restock(uuid, uuid, int) to authenticated;
revoke all on function public.get_home_best_sellers() from public;
grant execute on function public.get_home_best_sellers() to anon, authenticated;

notify pgrst, 'reload schema';
commit;

-- =====================================================================
-- Kiểm tra nhanh sau khi chạy:
--   select proname from pg_proc where proname in ('place_cart_order', 'place_buy_now_order');
--   -- chỉ còn place_cart_order
--   select policyname from pg_policies where tablename = 'collection_products';
--   -- không còn "collection_products: mọi người xem"
-- =====================================================================
