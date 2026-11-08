-- 05_customer_groups.sql
-- Run after 01_schema.sql through 04_rls.sql in Supabase SQL Editor.
-- Separates customer age group from gender; existing product/SKU/order data is preserved.
begin;

alter table public.categories add column if not exists customer_group text;
update public.categories
set customer_group = case when gender in ('men', 'women') then gender else 'unisex' end
where customer_group is null;
alter table public.categories alter column customer_group set default 'unisex';
alter table public.categories alter column customer_group set not null;

do $$
begin
  if not exists (select 1 from pg_constraint
                 where conrelid = 'public.categories'::regclass and conname = 'categories_customer_group_check') then
    alter table public.categories add constraint categories_customer_group_check
      check (customer_group in ('men', 'women', 'kids', 'baby', 'unisex'));
  end if;
end;
$$;

-- Category definitions only. Add real products/SKUs and stock before selling to these groups.
insert into public.categories (slug, name, code_prefix, gender, customer_group, size_type, sort_order) values
  ('nu-ao-so-mi',       'Áo sơ mi nữ',       'WSH', 'women',  'women', 'letter', 12),
  ('nu-vay-dam',        'Váy & đầm',         'WDR', 'women',  'women', 'letter', 13),
  ('nu-quan',           'Quần nữ',           'WPT', 'women',  'women', 'waist',  14),
  ('tre-em-ao-thun',    'Áo thun trẻ em',    'KTS', 'unisex', 'kids',  'letter', 21),
  ('tre-em-ao-khoac',   'Áo khoác trẻ em',   'KJK', 'unisex', 'kids',  'letter', 22),
  ('tre-em-quan',       'Quần trẻ em',       'KPT', 'unisex', 'kids',  'letter', 23),
  ('tre-em-do-mac-nha', 'Đồ mặc nhà trẻ em', 'KSW', 'unisex', 'kids',  'letter', 24),
  ('em-be-bodysuit',    'Bodysuit em bé',    'BBD', 'unisex', 'baby',  'letter', 31),
  ('em-be-romper',      'Đồ liền thân em bé','BRP', 'unisex', 'baby',  'letter', 32),
  ('em-be-do-ngu',      'Đồ ngủ em bé',      'BSL', 'unisex', 'baby',  'letter', 33),
  ('em-be-phu-kien',    'Phụ kiện em bé',    'BAC', 'unisex', 'baby',  'letter', 34)
on conflict (slug) do update set customer_group = excluded.customer_group;

commit;
