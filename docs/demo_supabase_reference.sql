-- REFERENCE DEMO ONLY. Only use in a NEW / EMPTY Supabase project with B's approval.
-- If B has an existing schema, adapt src/services/catalog-service.ts INSTEAD.
-- TEXT ids simplify demo seed data; B may choose UUID ids in production.
BEGIN;

create table if not exists public.products (
 id text primary key,
 name text not null,
 description text,
 category text,
 price_vnd integer not null check (price_vnd >= 0),
 image_url text
);
create table if not exists public.product_variants (
 id text primary key,
 product_id text not null references public.products(id),
 sku text unique not null,
 size text not null,
 color text not null,
 unique(product_id,size,color)
);
create table if not exists public.branches (
 id text primary key,
 name text not null,
 address text
);
create table if not exists public.inventory (
 sku_id text not null references public.product_variants(id),
 branch_id text not null references public.branches(id),
 quantity integer not null default 0 check(quantity >= 0),
 primary key(sku_id,branch_id)
);

-- 5 products
insert into public.products(id,name,category,description,price_vnd,image_url) values ('p01','Áo thun cotton','Áo','Áo thun cotton mềm, phom dáng cơ bản, dễ phối đồ hằng ngày.',199000,null) on conflict (id) do nothing;
insert into public.products(id,name,category,description,price_vnd,image_url) values ('p02','Áo sơ mi Oxford','Áo','Sơ mi chất liệu Oxford, phong cách tối giản, phù hợp công sở.',499000,null) on conflict (id) do nothing;
insert into public.products(id,name,category,description,price_vnd,image_url) values ('p03','Quần jeans slim','Quần','Quần denim co giãn nhẹ, ống slim, thoải mái khi di chuyển.',599000,null) on conflict (id) do nothing;
insert into public.products(id,name,category,description,price_vnd,image_url) values ('p04','Áo khoác nhẹ','Áo khoác','Áo khoác nhẹ tiện dụng, thích hợp thời tiết chuyển mùa.',699000,null) on conflict (id) do nothing;
insert into public.products(id,name,category,description,price_vnd,image_url) values ('p05','Quần short kaki','Quần','Quần short kaki thoáng mát, thích hợp cho hoạt động thường ngày.',349000,null) on conflict (id) do nothing;
-- 3 branches
insert into public.branches(id,name,address) values ('b01','Chi nhánh Thủ Đức','TP. Thủ Đức, TP.HCM') on conflict(id) do nothing;
insert into public.branches(id,name,address) values ('b02','Chi nhánh Quận 1','Quận 1, TP.HCM') on conflict(id) do nothing;
insert into public.branches(id,name,address) values ('b03','Chi nhánh Bình Thạnh','Bình Thạnh, TP.HCM') on conflict(id) do nothing;
-- 15 SKUs
insert into public.product_variants(id,product_id,sku,size,color) values ('sku-1-1','p01','MN23-1-1','S','Trắng') on conflict(id) do nothing;
insert into public.product_variants(id,product_id,sku,size,color) values ('sku-1-2','p01','MN23-1-2','M','Trắng') on conflict(id) do nothing;
insert into public.product_variants(id,product_id,sku,size,color) values ('sku-1-3','p01','MN23-1-3','L','Đen') on conflict(id) do nothing;
insert into public.product_variants(id,product_id,sku,size,color) values ('sku-2-1','p02','MN23-2-1','S','Xanh dương') on conflict(id) do nothing;
insert into public.product_variants(id,product_id,sku,size,color) values ('sku-2-2','p02','MN23-2-2','M','Xanh dương') on conflict(id) do nothing;
insert into public.product_variants(id,product_id,sku,size,color) values ('sku-2-3','p02','MN23-2-3','L','Trắng') on conflict(id) do nothing;
insert into public.product_variants(id,product_id,sku,size,color) values ('sku-3-1','p03','MN23-3-1','29','Xanh denim') on conflict(id) do nothing;
insert into public.product_variants(id,product_id,sku,size,color) values ('sku-3-2','p03','MN23-3-2','30','Xanh denim') on conflict(id) do nothing;
insert into public.product_variants(id,product_id,sku,size,color) values ('sku-3-3','p03','MN23-3-3','31','Đen') on conflict(id) do nothing;
insert into public.product_variants(id,product_id,sku,size,color) values ('sku-4-1','p04','MN23-4-1','S','Be') on conflict(id) do nothing;
insert into public.product_variants(id,product_id,sku,size,color) values ('sku-4-2','p04','MN23-4-2','M','Be') on conflict(id) do nothing;
insert into public.product_variants(id,product_id,sku,size,color) values ('sku-4-3','p04','MN23-4-3','L','Đen') on conflict(id) do nothing;
insert into public.product_variants(id,product_id,sku,size,color) values ('sku-5-1','p05','MN23-5-1','S','Kaki') on conflict(id) do nothing;
insert into public.product_variants(id,product_id,sku,size,color) values ('sku-5-2','p05','MN23-5-2','M','Kaki') on conflict(id) do nothing;
insert into public.product_variants(id,product_id,sku,size,color) values ('sku-5-3','p05','MN23-5-3','L','Đen') on conflict(id) do nothing;
-- 45 inventory rows
insert into public.inventory(sku_id,branch_id,quantity) values ('sku-1-1','b01',1) on conflict(sku_id,branch_id) do nothing;
insert into public.inventory(sku_id,branch_id,quantity) values ('sku-1-1','b02',4) on conflict(sku_id,branch_id) do nothing;
insert into public.inventory(sku_id,branch_id,quantity) values ('sku-1-1','b03',7) on conflict(sku_id,branch_id) do nothing;
insert into public.inventory(sku_id,branch_id,quantity) values ('sku-1-2','b01',3) on conflict(sku_id,branch_id) do nothing;
insert into public.inventory(sku_id,branch_id,quantity) values ('sku-1-2','b02',6) on conflict(sku_id,branch_id) do nothing;
insert into public.inventory(sku_id,branch_id,quantity) values ('sku-1-2','b03',9) on conflict(sku_id,branch_id) do nothing;
insert into public.inventory(sku_id,branch_id,quantity) values ('sku-1-3','b01',5) on conflict(sku_id,branch_id) do nothing;
insert into public.inventory(sku_id,branch_id,quantity) values ('sku-1-3','b02',8) on conflict(sku_id,branch_id) do nothing;
insert into public.inventory(sku_id,branch_id,quantity) values ('sku-1-3','b03',2) on conflict(sku_id,branch_id) do nothing;
insert into public.inventory(sku_id,branch_id,quantity) values ('sku-2-1','b01',2) on conflict(sku_id,branch_id) do nothing;
insert into public.inventory(sku_id,branch_id,quantity) values ('sku-2-1','b02',5) on conflict(sku_id,branch_id) do nothing;
insert into public.inventory(sku_id,branch_id,quantity) values ('sku-2-1','b03',8) on conflict(sku_id,branch_id) do nothing;
insert into public.inventory(sku_id,branch_id,quantity) values ('sku-2-2','b01',4) on conflict(sku_id,branch_id) do nothing;
insert into public.inventory(sku_id,branch_id,quantity) values ('sku-2-2','b02',7) on conflict(sku_id,branch_id) do nothing;
insert into public.inventory(sku_id,branch_id,quantity) values ('sku-2-2','b03',1) on conflict(sku_id,branch_id) do nothing;
insert into public.inventory(sku_id,branch_id,quantity) values ('sku-2-3','b01',6) on conflict(sku_id,branch_id) do nothing;
insert into public.inventory(sku_id,branch_id,quantity) values ('sku-2-3','b02',9) on conflict(sku_id,branch_id) do nothing;
insert into public.inventory(sku_id,branch_id,quantity) values ('sku-2-3','b03',3) on conflict(sku_id,branch_id) do nothing;
insert into public.inventory(sku_id,branch_id,quantity) values ('sku-3-1','b01',3) on conflict(sku_id,branch_id) do nothing;
insert into public.inventory(sku_id,branch_id,quantity) values ('sku-3-1','b02',6) on conflict(sku_id,branch_id) do nothing;
insert into public.inventory(sku_id,branch_id,quantity) values ('sku-3-1','b03',9) on conflict(sku_id,branch_id) do nothing;
insert into public.inventory(sku_id,branch_id,quantity) values ('sku-3-2','b01',0) on conflict(sku_id,branch_id) do nothing;
insert into public.inventory(sku_id,branch_id,quantity) values ('sku-3-2','b02',8) on conflict(sku_id,branch_id) do nothing;
insert into public.inventory(sku_id,branch_id,quantity) values ('sku-3-2','b03',2) on conflict(sku_id,branch_id) do nothing;
insert into public.inventory(sku_id,branch_id,quantity) values ('sku-3-3','b01',7) on conflict(sku_id,branch_id) do nothing;
insert into public.inventory(sku_id,branch_id,quantity) values ('sku-3-3','b02',1) on conflict(sku_id,branch_id) do nothing;
insert into public.inventory(sku_id,branch_id,quantity) values ('sku-3-3','b03',4) on conflict(sku_id,branch_id) do nothing;
insert into public.inventory(sku_id,branch_id,quantity) values ('sku-4-1','b01',4) on conflict(sku_id,branch_id) do nothing;
insert into public.inventory(sku_id,branch_id,quantity) values ('sku-4-1','b02',7) on conflict(sku_id,branch_id) do nothing;
insert into public.inventory(sku_id,branch_id,quantity) values ('sku-4-1','b03',1) on conflict(sku_id,branch_id) do nothing;
insert into public.inventory(sku_id,branch_id,quantity) values ('sku-4-2','b01',6) on conflict(sku_id,branch_id) do nothing;
insert into public.inventory(sku_id,branch_id,quantity) values ('sku-4-2','b02',9) on conflict(sku_id,branch_id) do nothing;
insert into public.inventory(sku_id,branch_id,quantity) values ('sku-4-2','b03',3) on conflict(sku_id,branch_id) do nothing;
insert into public.inventory(sku_id,branch_id,quantity) values ('sku-4-3','b01',8) on conflict(sku_id,branch_id) do nothing;
insert into public.inventory(sku_id,branch_id,quantity) values ('sku-4-3','b02',2) on conflict(sku_id,branch_id) do nothing;
insert into public.inventory(sku_id,branch_id,quantity) values ('sku-4-3','b03',5) on conflict(sku_id,branch_id) do nothing;
insert into public.inventory(sku_id,branch_id,quantity) values ('sku-5-1','b01',5) on conflict(sku_id,branch_id) do nothing;
insert into public.inventory(sku_id,branch_id,quantity) values ('sku-5-1','b02',8) on conflict(sku_id,branch_id) do nothing;
insert into public.inventory(sku_id,branch_id,quantity) values ('sku-5-1','b03',2) on conflict(sku_id,branch_id) do nothing;
insert into public.inventory(sku_id,branch_id,quantity) values ('sku-5-2','b01',7) on conflict(sku_id,branch_id) do nothing;
insert into public.inventory(sku_id,branch_id,quantity) values ('sku-5-2','b02',1) on conflict(sku_id,branch_id) do nothing;
insert into public.inventory(sku_id,branch_id,quantity) values ('sku-5-2','b03',4) on conflict(sku_id,branch_id) do nothing;
insert into public.inventory(sku_id,branch_id,quantity) values ('sku-5-3','b01',9) on conflict(sku_id,branch_id) do nothing;
insert into public.inventory(sku_id,branch_id,quantity) values ('sku-5-3','b02',3) on conflict(sku_id,branch_id) do nothing;
insert into public.inventory(sku_id,branch_id,quantity) values ('sku-5-3','b03',6) on conflict(sku_id,branch_id) do nothing;
-- Minimal read-only RLS for public catalog. No anonymous writes.
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.branches enable row level security;
alter table public.inventory enable row level security;
grant select on public.products,public.product_variants,public.branches,public.inventory to anon, authenticated;
-- Restrict writes by anon. Production security should be owned/reviewed by B.
revoke insert, update, delete on public.products,public.product_variants,public.branches,public.inventory from anon;
create policy "demo_products_read" on public.products for select to anon, authenticated using (true);
create policy "demo_variants_read" on public.product_variants for select to anon, authenticated using (true);
create policy "demo_branches_read" on public.branches for select to anon, authenticated using (true);
create policy "demo_inventory_read" on public.inventory for select to anon, authenticated using (true);
COMMIT;
-- Verify: select count(*) from public.products; --5
-- Verify: select count(*) from public.product_variants; --15
-- Verify: select count(*) from public.branches; --3
-- Verify: select count(*) from public.inventory; --45
