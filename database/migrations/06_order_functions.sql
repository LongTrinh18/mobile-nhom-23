-- =====================================================================
-- 06_order_functions.sql — B5 + B6: tìm chi nhánh đáp ứng đơn, đặt hàng
-- hai cách nhận, trạng thái giao hàng, tồn kho, job tự hủy.
-- Chạy SAU 05_delivery_schema.sql. Cả file chạy trong một transaction.
--
-- Hàm app gọi (supabase.rpc):
--   find_fulfilling_branches  — B5, khách vãng lai cũng gọi được
--   place_order               — B6, thay bản cũ (đã DROP chữ ký cũ)
--   update_order_status       — giữ chữ ký cũ, thêm luồng giao hàng
-- Quy định: sheet "QĐ nghiệp vụ (mới)", "Trạng thái đơn (mới)",
-- "Tồn kho 2 cách nhận (mới)", "Mã lỗi (mới)".
-- =====================================================================

begin;


-- ---------------------------------------------------------------------
-- 1. _distance_km — khoảng cách (km) giữa hai tọa độ, công thức haversine.
--    Thiếu tọa độ → null.
-- ---------------------------------------------------------------------
create or replace function public._distance_km(
  lat1 numeric, lng1 numeric, lat2 numeric, lng2 numeric
)
returns numeric
language sql
immutable
set search_path = public
as $$
  select case
    when lat1 is null or lng1 is null or lat2 is null or lng2 is null then null
    else round((6371 * 2 * asin(sqrt(
           power(sin(radians((lat2 - lat1)::float8) / 2), 2)
           + cos(radians(lat1::float8)) * cos(radians(lat2::float8))
             * power(sin(radians((lng2 - lng1)::float8) / 2), 2)
         )))::numeric, 2)
  end;
$$;


-- ---------------------------------------------------------------------
-- 2. _normalize_items — đọc mảng [{ "variant_id": "...", "quantity": 2 }]
--    Gom dòng trùng SKU và kiểm tra giới hạn (QD10):
--      mỗi SKU 1–10 sản phẩm, mỗi đơn tối đa 20 SKU.
-- ---------------------------------------------------------------------
create or replace function public._normalize_items(p_items jsonb)
returns table (variant_id uuid, quantity int)
language plpgsql
immutable
set search_path = public
as $$
declare
  v_lines int;
  v_bad   int;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'EMPTY_ORDER: Đơn hàng chưa có sản phẩm';
  end if;

  begin
    select count(*),
           count(*) filter (where g.vid is null or g.has_null_qty
                              or g.min_qty < 1 or g.qty > 10)
      into v_lines, v_bad
    from (
      select (x ->> 'variant_id')::uuid        as vid,
             sum((x ->> 'quantity')::int)      as qty,
             min((x ->> 'quantity')::int)      as min_qty,
             bool_or(x ->> 'quantity' is null) as has_null_qty
      from jsonb_array_elements(p_items) x
      group by 1
    ) g;
  exception
    when invalid_text_representation or numeric_value_out_of_range then
      raise exception 'INVALID_QUANTITY: variant_id hoặc số lượng không đúng định dạng';
  end;

  if v_bad > 0 then
    raise exception 'INVALID_QUANTITY: Mỗi sản phẩm phải có variant_id và số lượng từ 1 đến 10';
  end if;
  if v_lines > 20 then
    raise exception 'TOO_MANY_ITEMS: Mỗi đơn tối đa 20 sản phẩm khác nhau';
  end if;

  return query
    select (x ->> 'variant_id')::uuid, sum((x ->> 'quantity')::int)::int
    from jsonb_array_elements(p_items) x
    group by 1;
end;
$$;


-- ---------------------------------------------------------------------
-- 3. find_fulfilling_branches — B5: chi nhánh nào đủ hàng cho cả đơn
--
--    App:
--      const { data } = await supabase.rpc('find_fulfilling_branches', {
--        p_items: [{ variant_id, quantity }, ...],
--        p_lat, p_lng })            // tọa độ khách, không có thì bỏ qua
--
--    Mỗi chi nhánh đang hoạt động trả một dòng:
--      can_fulfill   = true nếu đủ TẤT CẢ món
--      missing_items = [{ variant_id, sku, requested, available }] các món thiếu
--      distance_km   = null khi thiếu tọa độ khách hoặc chi nhánh
--    Thứ tự: chi nhánh đủ hàng trước → gần nhất → mã chi nhánh (QD15).
--    Kết quả chỉ để gợi ý; place_order kiểm tra lại sau khi khóa tồn kho.
-- ---------------------------------------------------------------------
create or replace function public.find_fulfilling_branches(
  p_items  jsonb,
  p_lat    numeric default null,
  p_lng    numeric default null
)
returns table (
  branch_id      uuid,
  branch_code    text,
  branch_name    text,
  address        text,
  phone          text,
  latitude       numeric,
  longitude      numeric,
  distance_km    numeric,
  can_fulfill    boolean,
  missing_items  jsonb
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public._normalize_items(p_items) q
    where not exists (select 1 from public.product_variants v where v.id = q.variant_id)
  ) then
    raise exception 'VARIANT_NOT_FOUND: Có sản phẩm không tồn tại';
  end if;

  return query
  with req as (
    select q.variant_id as vid, q.quantity as requested
    from public._normalize_items(p_items) q
  ),
  per_item as (
    select b.id as bid, r.vid, r.requested, v.sku,
           -- SKU hoặc sản phẩm ngừng bán, hoặc chi nhánh chưa có dòng tồn → 0
           case when v.is_active and p.is_active
                then coalesce(i.quantity - i.reserved_quantity, 0)
                else 0 end as available
    from public.branches b
    cross join req r
    join public.product_variants v on v.id = r.vid
    join public.products p         on p.id = v.product_id
    left join public.inventory i   on i.branch_id = b.id and i.variant_id = r.vid
    where b.is_active
  )
  select b.id, b.code, b.name, b.address, b.phone, b.latitude, b.longitude,
         public._distance_km(p_lat, p_lng, b.latitude, b.longitude) as dist,
         bool_and(pi.available >= pi.requested)                      as ok,
         coalesce(
           jsonb_agg(jsonb_build_object(
               'variant_id', pi.vid,
               'sku',        pi.sku,
               'requested',  pi.requested,
               'available',  pi.available) order by pi.sku)
             filter (where pi.available < pi.requested),
           '[]'::jsonb)
  from public.branches b
  join per_item pi on pi.bid = b.id
  group by b.id
  order by ok desc, dist asc nulls last, b.code;
end;
$$;


-- ---------------------------------------------------------------------
-- 4. _order_summary — hàm NỘI BỘ: dữ liệu trả về sau khi đặt (QD27)
-- ---------------------------------------------------------------------
create or replace function public._order_summary(p_order_id uuid)
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
  created_at        timestamptz
)
language sql
stable
set search_path = public
as $$
  select o.id, o.order_code, o.status, o.fulfillment_type,
         o.branch_id, b.name, b.address,
         o.subtotal_amount, o.discount_amount, o.shipping_fee, o.total_amount,
         o.voucher_code, o.payment_method, o.created_at
  from public.orders o
  join public.branches b on b.id = o.branch_id
  where o.id = p_order_id;
$$;


-- ---------------------------------------------------------------------
-- 5. place_order — B6: đặt đơn nhận tại cửa hàng hoặc giao hàng
--
--    App:
--      const { data, error } = await supabase.rpc('place_order', {
--        p_items,                 // [{ variant_id, quantity }] các dòng được chọn
--        p_fulfillment_type,      // 'pickup' | 'delivery'
--        p_customer_name, p_customer_phone,
--        p_idempotency_key,       // UUID tạo khi mở màn checkout (QD25)
--        p_branch_id,             // bắt buộc với pickup; delivery bỏ qua
--        p_delivery_address, p_delivery_lat, p_delivery_lng,   // delivery
--        p_voucher_code, p_note })
--
--    Các bước (một transaction — lỗi ở đâu thì không có gì được ghi):
--      1. Cùng (người dùng, idempotency_key) đã có đơn → trả lại đơn đó.
--      2. Kiểm tra đầu vào, gom dòng trùng SKU.
--      3. Khóa tồn kho theo thứ tự (branch_id, variant_id) → không bán quá
--         số có, không deadlock.
--      4. Pickup: chi nhánh khách chọn phải đủ toàn bộ hàng.
--         Delivery: chọn chi nhánh gần nhất đủ toàn bộ hàng.
--         Không chi nhánh nào đủ → báo lỗi, không tạo đơn một phần.
--      5. Server tính giá, giảm giá, phí ship (QD18–QD21).
--      6. Tạo orders + order_items, tăng reserved_quantity.
--    Giỏ hàng nằm trên máy (QD08) nên hàm không đụng tới cart_items.
-- ---------------------------------------------------------------------
drop function if exists public.place_order(uuid, jsonb, text, text, text);

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
  -- Mức phí theo PROJECT_SCOPE.md và giới hạn giao hàng (sheet "QĐ nghiệp vụ (mới)")
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

  -- Hai lần gọi cùng mã phải xếp hàng: lần sau đợi lần trước xong mới kiểm tra
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

    -- Đọc sau khi đã khóa nên số liệu là mới nhất
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
        raise exception 'OUT_OF_DELIVERY_AREA: % km', v_nearest;
      end if;
    end if;

    -- Khóa tồn kho các món này ở MỌI chi nhánh đang hoạt động
    perform 1
    from public.inventory i
    join public.branches b on b.id = i.branch_id
    where b.is_active
      and i.variant_id in (select q.variant_id from _req q)
    order by i.branch_id, i.variant_id
    for update of i;

    -- Hàm B5 đã sắp: đủ hàng → gần nhất → mã chi nhánh
    select f.branch_id into v_branch_id
    from public.find_fulfilling_branches(p_items, v_lat, v_lng) f
    where f.can_fulfill
    limit 1;

    if v_branch_id is null then
      -- Báo các món thiếu ở chi nhánh thiếu ít món nhất
      select f.branch_name || ' thiếu ' || string_agg(
               format('%s (cần %s, còn %s)', m ->> 'sku', m ->> 'requested', m ->> 'available'), ', ')
        into v_missing
      from (
        select * from public.find_fulfilling_branches(p_items, v_lat, v_lng) x
        order by jsonb_array_length(x.missing_items), x.distance_km nulls last, x.branch_code
        limit 1
      ) f
      cross join lateral jsonb_array_elements(f.missing_items) m
      group by f.branch_name;

      raise exception 'NO_BRANCH_AVAILABLE: %', v_missing;
    end if;
  end if;

  -- 5. Tiền: giá server, voucher, phí ship -------------------------------
  select sum(q.quantity * coalesce(p.sale_price, p.base_price))::int into v_subtotal
  from _req q
  join public.product_variants v on v.id = q.variant_id
  join public.products p         on p.id = v.product_id;

  if v_vcode is not null then
    select * into v_voucher from public.vouchers where code = v_vcode and is_active;
    if v_voucher.code is null or (v_voucher.applies_to = 'delivery' and v_type <> 'delivery') then
      raise exception 'INVALID_VOUCHER: %', v_vcode;
    end if;
    if v_voucher.discount_type = 'percent' then
      v_discount := round(v_subtotal * v_voucher.discount_value / 100.0);
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
-- 6. _apply_order_status — hàm NỘI BỘ: đổi trạng thái + cập nhật tồn kho
--    (sheet "Tồn kho 2 cách nhận (mới)")
--      cancelled / expired : reserved − n          (hàng chưa rời chi nhánh)
--      completed / shipping: quantity − n, reserved − n
--      delivery_failed     : quantity + n          (hoàn kho)
--      delivered           : không đổi kho         (đã trừ lúc xuất kho)
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
  if p_new_status in ('cancelled', 'expired', 'completed', 'shipping', 'delivery_failed') then
    -- Khóa theo cùng thứ tự với place_order để không deadlock
    perform 1
    from public.inventory i
    where i.branch_id = p_order.branch_id
      and i.variant_id in (select oi.variant_id from public.order_items oi where oi.order_id = p_order.id)
    order by i.variant_id
    for update;
  end if;

  if p_new_status in ('cancelled', 'expired') then
    update public.inventory i
    set reserved_quantity = i.reserved_quantity - oi.quantity
    from public.order_items oi
    where oi.order_id = p_order.id
      and i.branch_id = p_order.branch_id
      and i.variant_id = oi.variant_id;

  elsif p_new_status in ('completed', 'shipping') then
    update public.inventory i
    set quantity          = i.quantity - oi.quantity,
        reserved_quantity = i.reserved_quantity - oi.quantity
    from public.order_items oi
    where oi.order_id = p_order.id
      and i.branch_id = p_order.branch_id
      and i.variant_id = oi.variant_id;

  elsif p_new_status = 'delivery_failed' then
    update public.inventory i
    set quantity = i.quantity + oi.quantity
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
      shipped_at      = case when p_new_status = 'shipping'
                             then now() else shipped_at end,
      completed_at    = case when p_new_status in ('completed', 'delivered')
                             then now() else completed_at end,
      payment_status  = case when p_new_status in ('completed', 'delivered')
                             then 'paid' else payment_status end
  where id = p_order.id
  returning * into v_row;

  return v_row;
end;
$$;


-- ---------------------------------------------------------------------
-- 7. update_order_status — đổi trạng thái đơn (có kiểm tra quyền)
--    Chữ ký giữ nguyên nên app không phải sửa lời gọi.
--
--    Pickup (giữ nguyên tuần 1):
--      pending → confirmed → ready_for_pickup → completed
--      pending / confirmed → cancelled   : khách (chủ đơn), manager
--      ready_for_pickup    → cancelled   : manager
--      ready_for_pickup    → expired     : chỉ job
--    Delivery (mới):
--      pending → confirmed → shipping → delivered
--      shipping            → delivery_failed : manager (hoàn kho)
--      pending / confirmed → cancelled       : khách (chủ đơn), manager
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

  -- Ghi lý do hủy / giao thất bại vào note
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
-- 8. cancel_stale_pending_orders — đơn pending quá 24 giờ chưa xác nhận
--    thì tự hủy, trả hàng đang giữ (QD29). Chạy mỗi giờ (mục 10).
-- ---------------------------------------------------------------------
create or replace function public.cancel_stale_pending_orders()
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
    where status = 'pending' and created_at < now() - interval '24 hours'
    for update skip locked
  loop
    update public.orders
    set note = concat_ws(' | ', nullif(note, ''), 'Tự hủy: quá 24 giờ chưa xác nhận')
    where id = v_order.id
    returning * into v_order;

    perform public._apply_order_status(v_order, 'cancelled');
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;


-- ---------------------------------------------------------------------
-- 9. Quyền gọi hàm
-- ---------------------------------------------------------------------
revoke execute on function public._distance_km(numeric, numeric, numeric, numeric) from public, anon, authenticated;
revoke execute on function public._normalize_items(jsonb)                         from public, anon, authenticated;
revoke execute on function public._order_summary(uuid)                            from public, anon, authenticated;
revoke execute on function public.cancel_stale_pending_orders()                   from public, anon, authenticated;
revoke execute on function public.find_fulfilling_branches(jsonb, numeric, numeric) from public;
revoke execute on function public.place_order(jsonb, text, text, text, uuid, uuid, text, numeric, numeric, text, text)
  from public, anon;

grant execute on function public.find_fulfilling_branches(jsonb, numeric, numeric) to anon, authenticated;
grant execute on function public.place_order(jsonb, text, text, text, uuid, uuid, text, numeric, numeric, text, text)
  to authenticated;


-- ---------------------------------------------------------------------
-- 10. Job tự động: phút 30 mỗi giờ tự hủy đơn pending quá hạn
--     (job hết hạn nhận hàng ở file 02 vẫn chạy phút 0)
-- ---------------------------------------------------------------------
select cron.schedule(
  'cancel-stale-pending-orders',
  '30 * * * *',
  $$ select public.cancel_stale_pending_orders(); $$
);

commit;
