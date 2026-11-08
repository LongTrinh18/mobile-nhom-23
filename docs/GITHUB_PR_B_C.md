## Kết quả thay đổi

Trang chủ phân nhóm Nam/Nữ/Trẻ em/Em bé, danh mục ảnh, Hàng mới/Bán chạy/Ưu đãi/Bộ sưu tập và component sản phẩm dùng chung. Thanh điều hướng có Trang chủ/Đơn hàng/Thông báo/Tôi; giỏ hàng và đặt hàng kết nối Supabase.

Chi tiết sản phẩm bỏ chọn chi nhánh, có chia sẻ hệ thống, Thêm vào giỏ hàng/Mua hàng và quy tắc Back giữ ngữ cảnh. Mua hàng trực tiếp dùng RPC riêng để giữ nguyên giỏ hàng.

Google Auth dùng Supabase OAuth PKCE S256 trên development build Android. Phiên được lưu và tự làm mới; Tôi hiển thị hồ sơ, hỗ trợ đăng xuất thiết bị hiện tại. Huỷ/lỗi đăng nhập có xử lý. Hồ sơ mới mặc định customer, không lấy quyền từ metadata.

## B cần review và cấu hình

- Review/chạy các migration chưa có: 05 nhóm khách hàng, 06 dữ liệu trang chủ, 07 mua trực tiếp, 08 hồ sơ Auth.
- Cấu hình Google OAuth Web Client tại Google Cloud và Supabase Google provider.
- Allowlist uniqlomobile://auth/callback, xác nhận auth.users/profiles cùng UUID.
- Không đưa Client Secret hoặc service_role vào frontend/GitHub.

## C cần review và nghiệm thu

- Chạy development build Android theo docs/HUONG_DAN_B_C_AUTH_GITHUB.md.
- Kiểm tra đăng nhập Google thật, huỷ/từ chối, mất mạng, khởi động lại giữ phiên, đăng xuất và đổi tài khoản.
- Kiểm tra đăng nhập từ giỏ hàng/Mua hàng giữ đúng màn hình, SKU và số lượng; không lẫn giỏ/đơn giữa người dùng.

## Xác minh

Đã chạy tại workspace: lint và TypeScript đạt; 52 kiểm thử tự động đạt (14 Auth, 11 giỏ hàng, 6 danh mục, 10 trang chủ, 11 chi tiết/đặt hàng). Chưa build/cài development APK trong lần bàn giao này; người nhận chạy các lệnh bên dưới. Chưa nghiệm thu Google thật vì provider chưa cấu hình.

Các kiểm thử Auth dùng phản hồi giả lập; kiểm thử migration dùng PostgreSQL PGlite. Kết quả tự động không thay thế nghiệm thu tài khoản Google thật.

**Trạng thái cloud:** Google chưa được bật theo xác nhận chủ project; migration 08 chưa triển khai. Chưa xác minh đăng nhập Google thật từ đầu đến cuối. Thông báo và Chatbot vẫn là màn hình chờ triển khai chức năng.
