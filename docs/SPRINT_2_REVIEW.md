# BÁO CÁO CẬP NHẬT TÀI LIỆU SPRINT 2 
**Dự án:** Ứng dụng Di động Mua sắm Thời trang UNIQLO Mobile (Nhóm 23)

---

## 1. MỤC TIÊU SPRINT 2
Hoàn thiện 100% Core Shopping Flow (Luồng Mua sắm Cốt lõi) từ khâu xem sản phẩm đến khâu thanh toán và quản lý đơn hàng. Bao gồm việc tinh chỉnh UI/UX đạt chuẩn ứng dụng thương mại điện tử chuyên nghiệp (mang phong cách Shopee, UNIQLO).

---

## 2. KẾT QUẢ KIỂM TRA LUỒNG MUA HÀNG (END-TO-END E-COMMERCE FLOW)

Toàn bộ luồng mua sắm đã được đội ngũ xây dựng, liên kết chặt chẽ và vượt qua bài kiểm thử TypeScript (Trừ các lỗi thiếu package native như Ionicons khi chạy Web). Dưới đây là 3 luồng chức năng lớn đã đi vào hoạt động:

### 🌟 Luồng 1: Xem Sản phẩm và Trải nghiệm Cá nhân hóa
* **Sản phẩm Đã xem gần đây (Recently Viewed):**
  * Tích hợp thành công lưu trữ cục bộ (`AsyncStorage`).
  * Khách hàng vừa xem sản phẩm ở trang Chi tiết, ngay lập tức món đồ được cập nhật lên vị trí cao nhất của danh sách "Sản phẩm vừa xem" tại Trang chủ (`/`).
  * Hỗ trợ lướt ngang mượt mà, ghi nhớ tối đa 10 sản phẩm và có chức năng "Xóa lịch sử" bảo vệ sự riêng tư.

### 🛒 Luồng 2: Quản lý Giỏ hàng Nâng cao (Shopee Style)
* Thay vì Mua tất cả những gì có trong giỏ, ứng dụng hiện tại cho phép khách hàng **Tích chọn (Check-box) từng món cụ thể** để đem đi thanh toán.
* **Tích hợp Tồn kho Chi nhánh Mạch lạc:**
  * Hiển thị cảnh báo màu vàng khi người dùng đặt lố số tồn kho khả dụng tại một chi nhánh.
  * **(Tính năng đột phá)** Hệ thống tự động quét và gợi ý **Đổi sang chi nhánh B/C có sẵn hàng** để thỏa mãn giỏ đồ của người dùng nếu chi nhánh hiện tại hết hàng.
* Hỗ trợ nhập mã Voucher giảm giá, tự động tính trừ tiền.
* Tích hợp thanh toán dưới cùng (Sticky Bottom Bar) chốt tổng hóa đơn chỉ cho những sản phẩm được "Check".

### 🚚 Luồng 3: Checkout và Đơn hàng (Checkout & Order Management)
* Hỗ trợ 2 nút mua tách biệt từ trang Sản phẩm: **"Thêm vào giỏ"** và **"Mua Ngay"**.
  * Chức năng "Mua Ngay" sẽ bỏ qua giỏ hàng và mang đúng món đồ đó đi tạo đơn. Không làm xáo trộn các món đang có trong giỏ.
* Tích hợp thành công **2 Phương thức Nhận hàng**:
  * **Nhận tại cửa hàng (Pickup):** Bắt buộc chọn chi nhánh và MIỄN PHÍ giao hàng.
  * **Giao hàng tận nơi (Delivery):** Yêu cầu địa chỉ chi tiết và tự động Free-ship nếu đơn > 500k.
* Tự động khởi tạo và làm rỗng giỏ đồ đã mua sau khi hoàn tất COD.
* **Màn hình Lịch sử Đơn hàng (`/orders`):** Đã kết nối, có nút Đăng nhập nhanh cho khách vãng lai, hiển thị mã đơn hàng, ngày tháng và trạng thái tiếng Việt chuẩn hóa (Đã xác nhận, Sẵn sàng nhận hàng, Đang giao hàng...).

---

## 3. ĐÁNH GIÁ KỸ THUẬT & KIỂM THỬ (TECHNICAL REVIEW)
* **Quản lý Trạng thái (State Management):**
  * `CartContext` và `RecentViewContext` hoạt động ổn định, cô lập được luồng dữ liệu, không gây render thừa toàn bộ ứng dụng.
* **Chất lượng Code (Type-Safety):**
  * Routing của Expo-Router được Typing cứng nhắc, đảm bảo chuyển trang (Push/Replace) an toàn.
* **Tích hợp Dữ liệu Backend (Supabase):**
  * Bóc tách thành công 2 hàm API quan trọng là `placeOrder` (Mua từ giỏ) và `placeBuyNowOrder` (Mua ngay).

---

## 4. KẾ HOẠCH BƯỚC TIẾP THEO (NEXT SPRINT)
* Chạy tích hợp thực tế (Integration Test) với dữ liệu từ team Database (B).
* Mở rộng thêm tính năng Đánh giá sản phẩm (Reviews/Rating).
* Hoàn thiện cấu hình CI/CD và đẩy bản Build Test lên Expo Application Services (EAS).
