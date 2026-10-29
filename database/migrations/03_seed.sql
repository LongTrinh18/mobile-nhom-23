-- =====================================================================
-- 03_seed.sql — Dữ liệu mẫu tuần 1
-- 3 chi nhánh · 5 danh mục · 5 sản phẩm · 15 SKU · 45 dòng tồn kho
-- bảng size · ảnh/video · 5 chính sách
-- Chạy SAU 01 và 02. Chạy lại nhiều lần không bị trùng (on conflict do nothing).
--
-- KHÔNG seed: profiles, orders, cart_items (cần tài khoản thật).
--   → Tạo tài khoản test ở Authentication → Users, rồi xem cuối file.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Chi nhánh
-- ---------------------------------------------------------------------
insert into public.branches (code, name, address, phone, open_time, close_time, image_path) values
  ('CN01', 'Chi nhánh Quận 1',  '135 Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP.HCM',          '028 3822 0001', '09:00', '22:00', 'branches/cn01.webp'),
  ('CN02', 'Chi nhánh Quận 7',  '101 Tôn Dật Tiên, Phường Tân Phú, Quận 7, TP.HCM',          '028 3822 0002', '09:00', '22:00', 'branches/cn02.webp'),
  ('CN03', 'Chi nhánh Thủ Đức', '216 Võ Văn Ngân, Phường Bình Thọ, TP. Thủ Đức, TP.HCM',     '028 3822 0003', '09:30', '21:30', 'branches/cn03.webp')
on conflict (code) do nothing;


-- ---------------------------------------------------------------------
-- 2. Danh mục
-- ---------------------------------------------------------------------
insert into public.categories (slug, name, code_prefix, gender, size_type, image_path, sort_order) values
  ('ao-thun',   'Áo thun',   'AT', 'unisex', 'letter', 'categories/ao-thun.webp',   1),
  ('so-mi',     'Áo sơ mi',  'SM', 'men',    'letter', 'categories/so-mi.webp',     2),
  ('ao-khoac',  'Áo khoác',  'AK', 'unisex', 'letter', 'categories/ao-khoac.webp',  3),
  ('quan-jean', 'Quần jean', 'QJ', 'men',    'waist',  'categories/quan-jean.webp', 4),
  ('quan-kaki', 'Quần kaki', 'QK', 'men',    'waist',  'categories/quan-kaki.webp', 5)
on conflict (slug) do nothing;


-- ---------------------------------------------------------------------
-- 3. Sản phẩm (giá VND; sale_price null = không giảm)
-- ---------------------------------------------------------------------
insert into public.products (code, name, description, category_id, material, fit, base_price, sale_price)
select x.code, x.name, x.description, c.id, x.material, x.fit, x.base_price, x.sale_price
from (values
  ('AT001', 'Áo thun cotton cổ tròn',
   'Áo thun cổ tròn vải cotton dày vừa, thấm hút mồ hôi, form regular mặc thoải mái hằng ngày. Giặt máy được, ít nhăn.',
   'ao-thun', '100% cotton', 'regular', 199000, 149000),
  ('SM001', 'Áo sơ mi Oxford dài tay',
   'Sơ mi vải Oxford dệt chéo, form slim ôm nhẹ, hợp đi làm và đi học. Form slim nên nếu thích rộng hãy chọn lên 1 size.',
   'so-mi', '100% cotton Oxford', 'slim', 399000, null),
  ('AK001', 'Áo khoác gió chống nắng',
   'Áo khoác mỏng nhẹ chống tia UV, cản gió, có mũ trùm. Gấp gọn bỏ túi được.',
   'ao-khoac', '100% polyester', 'regular', 499000, 399000),
  ('QJ001', 'Quần jean slim fit',
   'Quần jean co giãn nhẹ, ống côn vừa, màu xanh wash cổ điển.',
   'quan-jean', '98% cotton, 2% spandex', 'slim', 599000, null),
  ('QK001', 'Quần kaki ống đứng',
   'Quần kaki ống đứng lịch sự, vải dày dặn đứng form, phù hợp đi làm.',
   'quan-kaki', '97% cotton, 3% spandex', 'regular', 499000, null)
) as x(code, name, description, cat_slug, material, fit, base_price, sale_price)
join public.categories c on c.slug = x.cat_slug
on conflict (code) do nothing;


-- ---------------------------------------------------------------------
-- 4. SKU — tổng 15
--    AT001: đen/trắng × S, M, L  (6)
--    SM001: xanh × M, L           (2)
--    AK001: navy × M, L           (2)
--    QJ001: xanh × 30, 31, 32     (3)
--    QK001: be × 30, 32           (2)
-- ---------------------------------------------------------------------
insert into public.product_variants (product_id, sku, color_code, color_name, size)
select p.id,
       p.code || '-' || upper(x.color_code) || '-' || x.size,
       x.color_code, x.color_name, x.size
from (values
  ('AT001', 'black', 'Đen',          'S'),
  ('AT001', 'black', 'Đen',          'M'),
  ('AT001', 'black', 'Đen',          'L'),
  ('AT001', 'white', 'Trắng',        'S'),
  ('AT001', 'white', 'Trắng',        'M'),
  ('AT001', 'white', 'Trắng',        'L'),
  ('SM001', 'blue',  'Xanh nhạt',    'M'),
  ('SM001', 'blue',  'Xanh nhạt',    'L'),
  ('AK001', 'navy',  'Xanh navy',    'M'),
  ('AK001', 'navy',  'Xanh navy',    'L'),
  ('QJ001', 'blue',  'Xanh jean',    '30'),
  ('QJ001', 'blue',  'Xanh jean',    '31'),
  ('QJ001', 'blue',  'Xanh jean',    '32'),
  ('QK001', 'beige', 'Be',           '30'),
  ('QK001', 'beige', 'Be',           '32')
) as x(product_code, color_code, color_name, size)
join public.products p on p.code = x.product_code
on conflict (sku) do nothing;


-- ---------------------------------------------------------------------
-- 5. Tồn kho — mỗi SKU ở cả 3 chi nhánh (45 dòng)
--    Số lượng mặc định 5–20. Cố ý cho 3 dòng HẾT HÀNG để test:
--      AT001-WHITE-S ở CN03, SM001-BLUE-L ở CN01, QJ001-BLUE-30 ở CN02
-- ---------------------------------------------------------------------
insert into public.inventory (branch_id, variant_id, quantity)
select b.id, v.id,
       case
         when (b.code, v.sku) in (('CN03', 'AT001-WHITE-S'),
                                  ('CN01', 'SM001-BLUE-L'),
                                  ('CN02', 'QJ001-BLUE-30')) then 0
         else 5 + (abs(hashtext(b.code || v.sku)) % 16)       -- 5..20, cố định mỗi lần chạy
       end
from public.branches b
cross join public.product_variants v
on conflict (branch_id, variant_id) do nothing;


-- ---------------------------------------------------------------------
-- 6. Bảng size theo danh mục (product_id = null)
--    Khoảng chiều cao / cân nặng giữa các size có chồng lấn nhẹ là cố ý:
--    chatbot sẽ gợi ý size ưu tiên + size thay thế khi khách nằm ở vùng giữa.
-- ---------------------------------------------------------------------

-- 6a. Áo (áo thun, sơ mi, áo khoác): size chữ
insert into public.size_charts (category_id, product_id, size,
                                height_min_cm, height_max_cm, weight_min_kg, weight_max_kg,
                                chest_cm, length_cm)
select c.id, null, x.size, x.h_min, x.h_max, x.w_min, x.w_max, x.chest, x.len
from (values
  ('XS',  150, 160, 40, 48,  82, 64),
  ('S',   158, 165, 47, 55,  88, 66),
  ('M',   163, 170, 54, 62,  94, 68),
  ('L',   168, 175, 61, 70, 100, 70),
  ('XL',  173, 180, 69, 78, 106, 72),
  ('XXL', 178, 188, 77, 90, 112, 74)
) as x(size, h_min, h_max, w_min, w_max, chest, len)
cross join public.categories c
where c.slug in ('ao-thun', 'so-mi', 'ao-khoac')
on conflict do nothing;

-- 6b. Quần (jean, kaki): size số eo
insert into public.size_charts (category_id, product_id, size,
                                height_min_cm, height_max_cm, weight_min_kg, weight_max_kg,
                                waist_cm, length_cm)
select c.id, null, x.size, x.h_min, x.h_max, x.w_min, x.w_max, x.waist, x.len
from (values
  ('28', 155, 165, 45, 52, 71,  98),
  ('29', 158, 168, 50, 56, 74,  99),
  ('30', 160, 170, 54, 60, 76, 100),
  ('31', 163, 172, 58, 64, 79, 101),
  ('32', 165, 175, 62, 68, 81, 102),
  ('33', 168, 178, 66, 72, 84, 103),
  ('34', 170, 180, 70, 77, 86, 104),
  ('36', 172, 185, 76, 85, 91, 105)
) as x(size, h_min, h_max, w_min, w_max, waist, len)
cross join public.categories c
where c.slug in ('quan-jean', 'quan-kaki')
on conflict do nothing;

-- 6c. Ví dụ bảng size RIÊNG cho 1 sản phẩm: SM001 form slim, chật hơn
--     bảng chung ~3 kg → chatbot ưu tiên bảng này khi hỏi về SM001.
insert into public.size_charts (category_id, product_id, size,
                                height_min_cm, height_max_cm, weight_min_kg, weight_max_kg,
                                chest_cm, length_cm)
select p.category_id, p.id, x.size, x.h_min, x.h_max, x.w_min, x.w_max, x.chest, x.len
from (values
  ('XS',  150, 160, 38, 45,  80, 66),
  ('S',   158, 165, 44, 52,  86, 68),
  ('M',   163, 170, 51, 59,  92, 70),
  ('L',   168, 175, 58, 67,  98, 72),
  ('XL',  173, 180, 66, 75, 104, 74),
  ('XXL', 178, 188, 74, 86, 110, 76)
) as x(size, h_min, h_max, w_min, w_max, chest, len)
cross join public.products p
where p.code = 'SM001'
on conflict do nothing;


-- ---------------------------------------------------------------------
-- 7. Ảnh và video (chỉ đường dẫn — upload file đúng tên vào bucket là app hiện)
--    Mỗi màu: 1.webp (ảnh đại diện), 2.webp (mặt sau). AT001 có thêm 1 video.
-- ---------------------------------------------------------------------
insert into public.product_media (product_id, color_code, media_type, bucket, path, sort_order)
select distinct p.id, v.color_code, 'image', 'product-images',
       'products/' || p.code || '/' || v.color_code || '/' || n || '.webp', n
from public.product_variants v
join public.products p on p.id = v.product_id
cross join generate_series(1, 2) as n
where not exists (
  select 1 from public.product_media m
  where m.path = 'products/' || p.code || '/' || v.color_code || '/' || n || '.webp'
);

insert into public.product_media (product_id, color_code, media_type, bucket, path, sort_order)
select p.id, null, 'video', 'product-video', 'products/AT001/common/1.mp4', 10
from public.products p
where p.code = 'AT001'
  and not exists (select 1 from public.product_media m where m.path = 'products/AT001/common/1.mp4');


-- ---------------------------------------------------------------------
-- 8. Chính sách cửa hàng (chatbot dùng ở giai đoạn RAG; embedding điền sau)
-- ---------------------------------------------------------------------
insert into public.store_policies (topic, title, content)
select x.topic, x.title, x.content
from (values
  ('return', 'Chính sách đổi trả',
   'Khách được đổi size hoặc màu trong vòng 7 ngày kể từ ngày nhận hàng, tại bất kỳ chi nhánh nào. Sản phẩm phải còn nguyên tem mác, chưa giặt, chưa qua sử dụng và kèm hóa đơn. Mỗi đơn được đổi tối đa 1 lần. Sản phẩm giảm giá trên 50% không áp dụng đổi trả.'),
  ('pickup', 'Nhận hàng tại cửa hàng',
   'Sau khi đặt đơn trên app, cửa hàng sẽ xác nhận và soạn hàng. Khi đơn chuyển sang trạng thái "Sẵn sàng nhận", khách có 3 ngày để đến chi nhánh đã chọn nhận hàng. Mang theo mã đơn (ví dụ DH20261022-0001) và số điện thoại đặt hàng. Quá 3 ngày đơn sẽ tự hủy và hàng được trả về kho.'),
  ('payment', 'Thanh toán',
   'Khách thanh toán khi nhận hàng tại quầy bằng tiền mặt, thẻ ATM/Visa/Mastercard hoặc quét mã QR ngân hàng. App chưa hỗ trợ thanh toán trước.'),
  ('cancel', 'Hủy đơn',
   'Khách tự hủy đơn trên app khi đơn đang ở trạng thái "Chờ xác nhận" hoặc "Đã xác nhận". Khi đơn đã "Sẵn sàng nhận", vui lòng liên hệ chi nhánh để hủy.'),
  ('size', 'Hướng dẫn chọn size',
   'Mỗi sản phẩm có bảng size theo chiều cao và cân nặng. Nếu số đo nằm giữa hai size: thích mặc ôm chọn size nhỏ, thích rộng rãi chọn size lớn. Sản phẩm form slim nên chọn lên 1 size nếu bạn có bụng hoặc vai rộng.')
) as x(topic, title, content)
where not exists (select 1 from public.store_policies s where s.title = x.title);


-- =====================================================================
-- SAU KHI SEED: tạo tài khoản test
--   1. Authentication → Users → Add user → tạo 2 tài khoản, ví dụ:
--        khach@test.com   (khách hàng)
--        quanly@test.com  (quản lý CN01)
--      Trigger ở file 01 tự tạo dòng profiles với role = 'customer'.
--   2. Chạy câu dưới để đổi quanly@test.com thành manager của CN01:
--
-- update public.profiles
-- set role = 'manager',
--     branch_id = (select id from public.branches where code = 'CN01')
-- where id = (select id from auth.users where email = 'quanly@test.com');
--
-- Kiểm tra nhanh:
--   select count(*) from public.product_variants;   -- 15
--   select count(*) from public.inventory;          -- 45
--   select * from public.v_inventory_available where available_quantity = 0;  -- 3 dòng
-- =====================================================================
