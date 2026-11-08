-- 07_buy_now.sql
-- Run after 01..06 in Supabase SQL Editor.
-- Independent purchase: reuses the existing transaction rules and preserves all cart rows.
-- Do not replace this with place_order on the client: that RPC consumes the shopping cart.
begin;

create or replace function public.place_buy_now_order(
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

  if (select count(*) from _req) <> 1 or exists (select 1 from _req where quantity > 10) then
    raise exception 'INVALID_QUANTITY: Mua ngay chỉ gồm một SKU với số lượng từ 1 đến 10';
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

  -- Mua ngay giữ nguyên giỏ hàng ---------------------------------------
  drop table _req;

  return query select v_order_id, v_code, v_total;
end;
$$;

revoke all on function public.place_buy_now_order(uuid, jsonb, text, text, text) from public, anon;
grant execute on function public.place_buy_now_order(uuid, jsonb, text, text, text) to authenticated;
notify pgrst, 'reload schema';
commit;
