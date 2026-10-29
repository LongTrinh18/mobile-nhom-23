# BÁO CÁO PHÂN TÍCH PHẠM VI DỰ ÁN (PROJECT SCOPE DOCUMENT)
**Dự án:** Ứng dụng Di động Mua sắm Thời trang Đa chi nhánh - UNIQLO Mobile (Nhóm 23)

---

## 1. TỔNG QUAN VỀ DỰ ÁN
* **Tên dự án:** UNIQLO Mobile Application
* **Công nghệ sử dụng:** React Native (Expo SDK 57), TypeScript, Expo Router v57, Supabase Backend.
* **Mục tiêu:** Xây dựng ứng dụng di động cho phép người dùng xem sản phẩm, kiểm tra tồn kho theo từng chi nhánh cửa hàng, quản lý giỏ hàng và đặt hàng theo phương thức COD.

---

## 2. PHẠM VI TÍNH NĂNG TRONG DỰ ÁN (IN-SCOPE)

Phạm vi công việc và tính năng mà ứng dụng **SẼ THỰC HIỆN**:

### 2.1. Phân hệ Quản lý Danh mục & Sản phẩm (Catalog & Inventory)
* **Trang chủ (Home):** Hiển thị Banner khuyến mãi, phím tắt Giỏ hàng, danh sách Sản phẩm nổi bật.
* **Danh mục sản phẩm (Product List):** Tìm kiếm sản phẩm theo tên, lọc sản phẩm theo danh mục (Áo, Quần, Phụ kiện...).
* **Chi tiết sản phẩm (Product Detail):**
  * Xem hình ảnh, mô tả, bảng giá VND.
  * Lựa chọn biến thể **Kích thước (Size)** và **Màu sắc**.
  * Lựa chọn **Chi nhánh nhận hàng/mua hàng**.
  * Kiểm tra và hiển thị **Số lượng tồn kho khả dụng** tương ứng theo tổ hợp (SKU + Chi nhánh).
  * Khóa nút mua khi sản phẩm hết hàng hoặc vượt quá số lượng tồn kho.

### 2.2. Phân hệ Giỏ hàng (Cart Management)
* **Quản lý giỏ hàng:**
  * Thêm sản phẩm vào giỏ hàng (Phân biệt rõ cùng 1 sản phẩm nhưng khác Chi nhánh hoặc khác Size/Màu).
  * Tăng/giảm số lượng sản phẩm (Có kiểm tra giới hạn tồn kho tối đa).
  * Xóa từng sản phẩm hoặc Dọn sạch toàn bộ giỏ hàng (Clear All).
* **Mã giảm giá (Voucher):** Nhập mã giảm giá (ví dụ: `UNIQLO10`, `FREESHIP`) và tự động trừ tiền/phí ship.
* **Bóc tách chi phí:** Tạm tính tiền hàng, Phí giao hàng dự kiến, Giảm giá và Tổng tiền cuối cùng.

### 2.3. Phân hệ Thanh toán & Đặt hàng COD (Checkout & Order)
* **Thông tin giao hàng:** Nhập Họ tên, Số điện thoại (có validate SĐT Việt Nam), Địa chỉ nhận hàng chi tiết và Ghi chú giao hàng.
* **Phương thức thanh toán:** Hỗ trợ phương thức **Thanh toán khi nhận hàng (COD)** làm phương thức chính, cùng lựa chọn Chuyển khoản/Ví điện tử mô phỏng.
* **Xác nhận đặt hàng thành công:** Sinh Mã đơn hàng duy nhất (ví dụ `#UQ-849201`), tóm tắt tổng số tiền mặt cần chuẩn bị trả khi nhận hàng và hẹn thời gian giao dự kiến.

### 2.4. Phân hệ Xác thực Tài khoản (Authentication)
* **Đăng nhập & Đăng ký:** Cho phép người dùng tạo tài khoản mới và đăng nhập bằng Email/Password qua Supabase Auth.
* **Tài khoản cá nhân:** Xem thông tin cá nhân và đăng xuất.

---

## 3. PHẠM VI NGOÀI DỰ ÁN (OUT-OF-SCOPE)

Những tính năng/công việc **KHÔNG THỰC HIỆN** trong phạm vi đồ án hiện tại (để tránh phình phạm vi dự án):

1. **Thanh toán trực tuyến thực tế:** Không tích hợp cổng thanh toán trực tiếp qua Ngân hàng/Thẻ quốc tế Visa/Mastercard (Chỉ dừng ở mô phỏng giao diện và tập trung vào COD).
2. **Tích hợp Đơn vị Vận chuyển thực tế:** Không kết nối API thực tế của GHTK, GHN, ViettelPost để lấy phí ship thời gian thực (Sử dụng mức phí định mức 30.000₫ hoặc Freeship cho đơn > 500k).
3. **Màn hình Quản trị viên (Admin Portal) trên Mobile:** Việc quản lý nhập kho, tạo sản phẩm mới do Admin thực hiện trực tiếp trên Supabase Dashboard hoặc hệ thống Web Backend riêng.

---

## 4. SẢN PHẨM BÀN GIAO (DELIVERABLES)

1. **Mã nguồn ứng dụng Mobile:** Thư mục `frontend/` chạy trên Expo SDK 57 (hỗ trợ Android, iOS, Web).
2. **Cơ sở dữ liệu Database:** Schema SQL, Seed Data mẫu và các chính sách RLS trên Supabase.
3. **Tài liệu Kỹ thuật Dự án:**
   * `docs/PROJECT_SCOPE.md` (Báo cáo Phân tích Phạm vi Dự án).
   * `docs/USE_CASES.md` (Tài liệu & Sơ đồ Thiết kế Use Case).
   * `docs/CONTRACT_B_C.md` (Hợp đồng Tích hợp Dữ liệu giữa các nhóm).
