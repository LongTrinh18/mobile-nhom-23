-- 06_home_sections.sql
-- Run after 01..05 in Supabase SQL Editor.
-- Public home merchandising: aggregate completed sales, curated collections.
begin;

-- Returns only aggregate product totals, never orders or customer identities.
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
  where o.status = 'completed'
    and coalesce(o.completed_at, o.created_at) >= now() - interval '30 days'
    and p.is_active
  group by oi.product_id
  order by sum(oi.quantity) desc, oi.product_id;
$$;
revoke all on function public.get_home_best_sellers() from public;
grant execute on function public.get_home_best_sellers() to anon, authenticated;

create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null check (length(trim(name)) > 0),
  description text,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create table if not exists public.collection_products (
  collection_id uuid not null references public.collections(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  sort_order int not null default 0,
  primary key (collection_id, product_id)
);
create index if not exists collection_products_product_idx on public.collection_products(product_id);
alter table public.collections enable row level security;
alter table public.collection_products enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'collections' and policyname = 'collections_public_active') then
    create policy collections_public_active on public.collections for select to anon, authenticated using (is_active);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'collections' and policyname = 'collections_admin_manage') then
    create policy collections_admin_manage on public.collections for all to authenticated
      using (public.is_admin()) with check (public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'collection_products' and policyname = 'collection_products_public_active') then
    create policy collection_products_public_active on public.collection_products for select to anon, authenticated using (
      exists (select 1 from public.collections c where c.id = collection_id and c.is_active)
      and exists (select 1 from public.products p where p.id = product_id and p.is_active)
    );
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'collection_products' and policyname = 'collection_products_admin_manage') then
    create policy collection_products_admin_manage on public.collection_products for all to authenticated
      using (public.is_admin()) with check (public.is_admin());
  end if;
end;
$$;
revoke all on public.collections, public.collection_products from anon, authenticated;
grant select on public.collections, public.collection_products to anon, authenticated;
grant insert, update, delete on public.collections, public.collection_products to authenticated;
grant all on public.collections, public.collection_products to service_role;

-- Editorial starter collections use existing product codes; no fake orders or sales are created.
insert into public.collections (slug, name, description, sort_order) values
  ('everyday-essentials', 'Thiết yếu mỗi ngày', 'Các thiết kế cơ bản dễ phối cho ngày thường.', 1),
  ('smart-casual', 'Công sở tối giản', 'Sơ mi và quần dài gọn gàng cho ngày đi làm.', 2)
on conflict (slug) do nothing;

insert into public.collection_products (collection_id, product_id, sort_order)
select c.id, p.id, x.sort_order
from (values
  ('everyday-essentials', 'AT001', 1),
  ('everyday-essentials', 'AK001', 2),
  ('smart-casual', 'SM001', 1),
  ('smart-casual', 'QK001', 2)
) x(collection_slug, product_code, sort_order)
join public.collections c on c.slug = x.collection_slug
join public.products p on p.code = x.product_code
on conflict (collection_id, product_id) do nothing;

notify pgrst, 'reload schema';
commit;
