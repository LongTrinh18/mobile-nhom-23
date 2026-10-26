# Hướng dẫn thực hiện toàn bộ tuần 1 — Người A

**Đồ án:** Mobile Nhóm 23 – UNIQLO (ứng dụng bán quần áo nhiều chi nhánh).  
**Công nghệ:** React Native + Expo + TypeScript + Expo Router + Supabase.  
**Nguồn:** File `Tuan_1_A(1).xlsx`, phối hợp với `Tuan_1_B(1).xlsx` và `Tuan_1_C(1).xlsx`.

> Bộ mã này là bản minh họa triển khai để ghép vào Expo project đã tạo. Các màn hình giỏ hàng và checkout hiện là **demo tạm thời**, do người C sở hữu sau khi nhóm tích hợp. **Không có thao tác thanh toán, ghi đơn hàng hoặc sửa tồn kho thật**.

## Chuẩn bị chung

1. Vào thư mục Git repository thật, ví dụ `C:\Users\JuLong\uniqlo-mobile`.
2. Chạy `git status` để kiểm tra mã nguồn không có thay đổi chưa lưu.
3. Chạy `git switch main`, `git pull origin main` để cập nhật mã mới nhất.
4. Giải nén ZIP, chạy `apply_A.ps1` như hướng dẫn trong `README_A.md`.
5. Xác định thư mục Expo root: nơi chứa `package.json`, ở gốc repo hoặc `frontend/`.
6. Từ Expo root, cài `npx expo install @supabase/supabase-js react-native-url-polyfill`.
7. Chạy `npx tsc --noEmit` trước, sau đó `npx expo start --clear`, mở Android Emulator, nhấn `a`.

## A01 – GitHub + Expo (N1)

**Mục tiêu:** Một Expo project dùng chung, B/C có thể clone và chạy, có commit và branch chính `main`.

- Kiểm tra repo `LongTrinh18/mobile-nhom-23`, branch `main` chứa Expo app.
- Mỗi thành viên dùng tài khoản GitHub riêng, người A cấp quyền truy cập/chỉnh sửa.
- B/C làm `git clone <URL>`, `cd <expo-root>`, `npm install`, `npx expo start` và gửi ảnh chạy app.
- Nếu đã chia ba thư mục `frontend/backend/database`, lệnh `npx expo start` cần chạy từ `frontend`.
- **Minh chứng Jira:** link repository, link commit đầu tiên và ảnh app trên emulator hoặc điện thoại của A/B/C.
- **Chưa thể coi hoàn thành 100%** nếu B và C chưa xác nhận clone/chạy thành công.

## A02 – Theme, dữ liệu chung (N2, Jira SCRUM-6)

**Các file:** `src/theme/theme.ts`, `src/types/shop.ts`, `docs/CONTRACT_B_C.md`.

1. A mở `src/theme/theme.ts`, giải thích cho C các biến `colors`, `spacing`, `radius`, `font`.
2. A/C chốt màu chính, chữ, khoảng cách, kiểu thẻ và button; không tự chọn mỗi màn hình một phong cách.
3. A/B thống nhất bốn bảng để đọc: `products`, `product_variants`, `branches`, `inventory`.
4. A/C thống nhất `CartItem` chứa đủ `skuId`, `branchId`, `quantity`, giá tại thời điểm thêm giỏ.
5. Cả nhóm xác nhận hợp đồng dữ liệu trong `docs/CONTRACT_B_C.md`.

**Tiêu chí nghiệm thu:** theme được import từ tất cả màn hình mới; B biết chính xác bảng/cột adapter cần; C có thể sử dụng `useCart()` mà không đoán cấu trúc dữ liệu. **Đưa vào Jira:** link PR + bình luận xác nhận B/C.

## A03 – Component chung & Expo Router (N2–3, Jira SCRUM-7)

**Các file:** `src/components/shop/Button.tsx`, `Input.tsx`, `ProductCard.tsx`, `CatalogStatus.tsx` và `src/app/_layout.tsx`.

1. `Button` nhận `title`, `onPress`, `disabled`, `loading`, `variant`. Nhờ vậy C dùng cùng Button cho trang đăng nhập/checkout.
2. `Input` nhận `label`, `value`, `onChangeText`, `error`, `keyboardType`. Đây là component C dùng ở form.
3. `ProductCard` nhận `product`, `onPress`; hiển thị danh mục, tên, giá và ảnh thật nếu DB có `image_url`.
4. `CatalogStatus` hiển thị **đang tải, lỗi, trống**; tuyệt đối không thay lỗi Supabase bằng mock một cách im lặng.
5. `src/app/_layout.tsx` tạo `Stack` và bọc `CartProvider` để Cart của C có thể nhận sản phẩm từ Detail của A.
6. Các file trong `src/app` tương ứng route thực tế: `/`, `/products`, `/products/[id]`, `/cart`, `/checkout`, `/account`.

**Kiểm thử:** từ Home mở danh mục → chi tiết → giỏ → checkout → back, không bị lỗi route. **Jira:** link PR/screenshot điều hướng.

## A04 – Home, Catalog, Detail (N3–4, Jira SCRUM-8)

**Các file:** `src/app/index.tsx`, `src/app/products/index.tsx`, `src/app/products/[id].tsx`, `src/data/mock-catalog.ts`.

1. Mở app: Home có banner, nút khám phá, bốn sản phẩm nổi bật.
2. Mở danh mục: xem năm sản phẩm mẫu, lọc theo danh mục và tìm tên.
3. Chọn một ProductCard: qua đúng `/products/[id]`.
4. Trong detail: chọn kích thước. Màu hiện ra là những màu **có biến thể thực tế** của size đó (không tạo SKU không tồn tại).
5. Đổi màu, kiểm tra SKU đổi theo; đổi chi nhánh, kiểm tra tồn kho thay đổi tương ứng.
6. Tăng/giảm số lượng và thử SKU hết hàng: nút thêm giỏ phải bị vô hiệu hóa.
7. Hiện giá tiền bằng VND, không sử dụng số thập phân của USD.

**Dữ liệu demo:** 5 sản phẩm, 3 chi nhánh, 15 SKU, 45 bản ghi tồn kho. Sản phẩm "Quần jeans slim", size `30`, chi nhánh `Thủ Đức` có tồn `0` để test nút bị khóa.

**Minh chứng Jira:** ảnh Home, List, Detail, video thử size–màu–chi nhánh.

## A05 – Đọc dữ liệu từ Supabase của B (N5, Jira SCRUM-9)

**Các file:** `src/lib/supabase.ts`, `src/services/catalog-service.ts`, `src/features/catalog/useCatalog.ts`.

1. Hỏi B: project URL, publishable key, xác nhận bảng/cột và RLS SELECT.
2. Trong Expo root tạo `.env`, với **hai biến** `EXPO_PUBLIC_SUPABASE_URL` và `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
3. Không commit `.env`; kiểm tra `git status` và `.gitignore`.
4. Tắt Metro cũ và chạy `npx expo start --clear` để nạp các biến `EXPO_PUBLIC_`.
5. Mở danh mục: app gọi Supabase trực tiếp qua `catalog-service.ts`; kiểm tra năm sản phẩm và các SKU/chi nhánh.
6. Nếu Supabase trả lỗi, đọc thông báo trên UI. Nhóm cần kiểm tra tên bảng/cột, RLS, API URL, key và Internet. Không coi mock là bằng chứng kết nối thật.
7. Kiểm tra trạng thái `loading`, `empty`, `error` khi tải, thiếu dữ liệu hoặc cấu hình chưa đúng.

**Nếu tên bảng B khác:** chỉ sửa phần mapping tại `catalog-service.ts`, tránh thay mọi component. **Không được dùng `service_role` hoặc secret key trên Expo.** B là người quyết định và kiểm thử chính sách RLS.

**Minh chứng Jira:** màn hình năm sản phẩm từ DB, số lượng tồn thay đổi theo chi nhánh, link PR, bình luận B đã xác nhận query và RLS. A05 chỉ Done sau khi kiểm thử với DB thật.

## A06 – Ghép SKU với Cart của C (N6, Jira SCRUM-10)

**File giao tiếp:** `src/context/CartContext.tsx` + `src/types/shop.ts`. 

1. A chọn một sản phẩm, size, màu, chi nhánh và số lượng.
2. A gọi `addItem(...)` với `productId`, `skuId`, `skuCode`, `size`, `color`, `branchId`, `branchName`, `unitPriceVnd`, `quantity`, `maxAvailable`.
3. C lấy giỏ qua `const {items, updateQuantity, removeItem, totalVnd} = useCart()`.
4. Nếu cùng `skuId` **và cùng** `branchId`, cộng số lượng vào cùng dòng; nếu khác chi nhánh thì tạo dòng riêng.
5. Giới hạn cộng giỏ bằng `maxAvailable` (chỉ là ảnh chụp tồn kho tại thời điểm tải, không giữ hàng).
6. Người C thay `cart.tsx`/`checkout.tsx` demo bằng màn hình của mình, nhưng **giữ** `CartProvider` và chuẩn dữ liệu nếu hai bên đã chốt.
7. Cùng C kiểm tra toàn luồng, năm sản phẩm DB có thể mở detail, thêm giỏ và vào form COD demo.

**Minh chứng Jira:** màn hình chi tiết + item trong giỏ có đúng mã SKU và chi nhánh; PR tích hợp A/C được review. Không đánh dấu Done nếu mới chạy Cart demo của A mà chưa ghép với C.

## A07 – Kiểm thử, README, video bàn giao (N7, Jira SCRUM-11)

1. Chạy `npx tsc --noEmit` và sửa lỗi TypeScript nếu có.
2. Chạy `npx expo start --clear`, kiểm tra trên Android Emulator (nên thử thêm máy thật khi có điều kiện).
3. Chạy các trường hợp trong `docs/TEST_PLAN_A.md`. Ghi rõ PASS/FAIL và ảnh chứng minh.
4. Demo: Home → Catalog → Detail → size/màu/chi nhánh → Cart → COD demo.
5. Có một kịch bản hết hàng; không cho thêm item vượt quá tồn.
6. Thu video 1–3 phút và cập nhật link vào `SCRUM-11`.
7. Viết/cập nhật README gốc: các bước clone, cài, chạy app, cấu hình `.env`, vai trò A/B/C và giới hạn demo.
8. Merge qua Pull Request đã được người khác review. Chỉ đánh dấu Done khi đội đã cùng chạy thử bản tích hợp.

## Đưa mã nguồn lên GitHub và cập nhật Jira

- Tạo branch riêng với Jira key trong tên, ví dụ `feature/SCRUM-6-11-a-catalog`.
- Sau khi hoàn thành theo giai đoạn: `git add -A`, `git commit -m "SCRUM-7 SCRUM-8 feat: shared components and product UI"`, `git push -u origin feature/SCRUM-6-11-a-catalog`.
- Vào GitHub → Pull requests → New pull request → `base main`, `compare` branch A → Create.
- B hoặc C review, sau đó merge.
- Vào từng `SCRUM-6` đến `SCRUM-11`, điền link PR, ảnh/video, checklist nghiệm thu và chuyển trạng thái đúng thực tế.
- Screenshot Jira hiện còn nút **Start sprint**. Nếu nhóm chưa nhấn, đây mới là Sprint kế hoạch; nên thống nhất lại thời gian N1–N7, sau đó mới bắt đầu Sprint.
