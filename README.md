# Mobile Nhóm 23 — UNIQLO

Ứng dụng bán quần áo nhiều chi nhánh, khách đặt online và **nhận hàng tại cửa hàng**. Có chatbot tư vấn size/giá/sản phẩm và gợi ý sản phẩm (Apriori).

| Phần | Công nghệ |
|---|---|
| App | React Native, Expo, TypeScript |
| Backend + Database | Supabase (PostgreSQL, Auth, Storage, RLS) |

## Cấu trúc thư mục

```
mobile-nhom-23/
├── frontend/                 App Expo
│   ├── .env.example          Mẫu cấu hình (commit)
│   ├── .env                  Cấu hình thật (KHÔNG commit, mỗi người tự tạo)
│   └── src/
│       ├── app/              Màn hình (expo-router)
│       ├── api/              Hàm gọi Supabase — màn hình chỉ gọi qua đây
│       └── lib/supabase.ts   Tạo client Supabase dùng chung
├── database/
│   ├── migrations/           01_schema → 02_functions → 03_seed → 04_rls
│   ├── docs/                 ERD (mở bằng app.diagrams.net)
│   └── README.md             Hướng dẫn chi tiết dựng database
├── backend/                  Dùng từ tuần 5 (chatbot, Apriori)
└── docs/                     Tài liệu nhóm
```

## Bắt đầu nhanh

Yêu cầu: Node.js 20+, app **Expo Go** trên điện thoại (hoặc máy ảo Android).

```bash
git clone <repo-url>
cd mobile-nhom-23/frontend
npm install
```

Tạo file `.env` (xem mục bên dưới), rồi chạy:

```bash
npx expo start -c
```

Quét mã QR bằng Expo Go. `-c` để xóa cache — bắt buộc mỗi lần sửa `.env`.

## Cấu hình `.env`

```powershell
cd frontend
Copy-Item .env.example .env      # Git Bash / macOS: cp .env.example .env
```

Mở `frontend/.env`, điền 2 giá trị (xin B gửi riêng qua tin nhắn, hoặc tự lấy nếu có quyền vào project):

| Biến | Lấy ở đâu trên Supabase | Ví dụ |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | Project Settings → Data API → **Project URL** | `https://abcdxyz.supabase.co` |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Project Settings → **API Keys** → Publishable key | `sb_publishable_...` |

Lưu ý khi điền:
- URL **chỉ phần gốc**, KHÔNG có `/rest/v1/` ở cuối (thư viện tự thêm).
- Không bọc giá trị trong dấu nháy, không có khoảng trắng quanh dấu `=`.
- Không tạo `.env` (hoặc để trống 2 giá trị) → app chạy với 5 sản phẩm mẫu để demo giao diện.

## Dựng database (chỉ B làm 1 lần)

1. Supabase → **Database → Extensions** → bật `pg_cron`.
2. Supabase → **SQL Editor** → tab **New** → dán toàn bộ từng file rồi bấm **Run** (Ctrl + Enter), đúng thứ tự:
   `01_schema.sql` → `02_functions.sql` → `03_seed.sql` → `04_rls.sql`
3. Tạo tài khoản test và gán vai trò: xem `database/README.md`.

Có thể chạy từ VS Code bằng extension **PostgreSQL** (Microsoft) hoặc `psql`, dùng chuỗi kết nối ở nút **Connect → Connection String → Session pooler**. Chuỗi này chứa mật khẩu database — không lưu vào file nào trong repo.

## Tài khoản test

| Email | Vai trò |
|---|---|
| `khach@test.com` | Khách hàng |
| `quanly@test.com` | Quản lý chi nhánh CN01 |
| `admin@test.com` | Admin |

Mật khẩu: hỏi B.

## Gọi dữ liệu trong app

Màn hình import từ `src/api`, không gọi Supabase trực tiếp:

```ts
import { getCatalog, getProductDetail, addToCart, placeOrder, friendlyMessage, imageUrl } from '@/api';

const items = await getCatalog({ categorySlug: 'ao-thun', sort: 'price_asc' });
```

| File | Chức năng |
|---|---|
| `catalogApi.ts` | Sản phẩm, danh mục, chi nhánh, tồn kho, bảng size |
| `cartApi.ts` | Giỏ hàng |
| `orderApi.ts` | Đặt đơn, xem đơn, hủy / đổi trạng thái |
| `authApi.ts` | Đăng ký, đăng nhập, hồ sơ |
| `adminApi.ts` | Nhập hàng, đổi vai trò, upload ảnh/video |
| `errors.ts` | Mã lỗi + `friendlyMessage()` để hiện thông báo tiếng Việt |

Quy tắc: đơn hàng và tồn kho **chỉ ghi qua hàm** (`placeOrder`, `updateOrderStatus`, `restock`). Ghi thẳng vào bảng sẽ bị database từ chối.

## Bảo mật

- `.env.example` chỉ chứa giá trị mẫu — **không** điền key thật.
- Trong `frontend/` chỉ dùng **publishable key**. Tuyệt đối không đưa secret key (`sb_secret_...`), `service_role`, mật khẩu database hay API key LLM vào app — mọi biến `EXPO_PUBLIC_*` đều bị đóng gói vào app.
- Gửi key cho nhau qua tin nhắn riêng, không gửi trong nhóm công khai.

## Lỗi thường gặp

| Hiện tượng | Cách xử lý |
|---|---|
| Sửa `.env` nhưng app vẫn dùng giá trị cũ | Chạy lại `npx expo start -c` |
| Lỗi 404 khi gọi API | URL trong `.env` có `/rest/v1/` ở cuối → xóa đi |
| `Invalid API key` | Copy thiếu key, hoặc dán nhầm key khác project |
| App hiện "chưa kết nối máy chủ" | `.env` chưa có hoặc sai tên biến |
| Ảnh không hiện | Chưa upload ảnh vào bucket, hoặc sai tên file so với `product_media.path` |
| Đặt hàng báo hết hàng | Đúng nghiệp vụ: SKU đó hết ở chi nhánh đã chọn, chọn chi nhánh khác |
