# Bàn giao cho B và C: Google Auth, Android và GitHub

## Tình trạng bàn giao

Ứng dụng đã có luồng Google OAuth qua Supabase, PKCE S256, màn hình nhận callback, lưu phiên sau khi đóng/mở app, tự làm mới phiên khi app hoạt động, hồ sơ tài khoản và đăng xuất trên thiết bị hiện tại. Huỷ đăng nhập không báo thành công; lỗi kết nối/cấu hình/callback có thông báo và có thể thử lại. Không có đăng nhập giả khi thiếu Supabase.

**Google chưa được bật trong Supabase theo xác nhận của chủ project. Chưa kiểm thử đăng nhập Google thật từ đầu đến cuối. Migration 08 chưa được triển khai lên cloud.** Các kiểm thử tự động dùng giả lập phản hồi Auth và PostgreSQL cục bộ; không thay thế lần đăng nhập Google thật.

Các thay đổi chưa commit trong nhánh hiện tại còn bao gồm trang chủ Nam/Nữ/Trẻ em/Em bé, bốn khối dữ liệu, ProductCard/ProductSection, thanh điều hướng, giỏ hàng Supabase và chi tiết/đặt hàng. Lệnh Git bên dưới bàn giao toàn bộ phần ứng dụng liên quan đang có trong workspace, vì Google Auth dùng chung layout, phiên và quy tắc quay lại của các phần này.

Đã chạy tại workspace: lint và TypeScript đạt; 52 kiểm thử tự động đạt (14 Auth, 11 giỏ hàng, 6 danh mục, 10 trang chủ, 11 chi tiết/đặt hàng). Chưa build/cài development APK trong lần bàn giao này; người nhận chạy các lệnh bên dưới. Chưa nghiệm thu Google thật vì provider chưa cấu hình.

## B: cấu hình Supabase và Google

1. Mở Google Cloud Console → Google Auth Platform. Tạo/chọn project, cấu hình Branding, Audience và Data Access cho email/profile/openid. Nếu app ở chế độ Testing, thêm email của A/B/C vào Test users.
2. Tạo OAuth Client loại **Web application** (luồng trình duyệt do Supabase điều phối, dùng được trên Android). Trong Authorized redirect URIs, thêm URL callback chính xác hiển thị ở Supabase → Authentication → Sign In / Providers → Google, dạng `https://<PROJECT_REF>.supabase.co/auth/v1/callback`.
3. Trong Supabase → Authentication → Sign In / Providers → Google: bật Google, điền Web Client ID và Client Secret ở đây rồi lưu. Client Secret chỉ nằm trên Supabase, không gửi vào frontend hoặc GitHub. Không bật bỏ kiểm tra nonce/email nếu không có lý do khác.
4. Authentication → URL Configuration → Redirect URLs: thêm **`uniqlomobile://auth/callback`**. Đây là đường Supabase quay về app, khác với callback HTTPS của Google ở bước 2. auth-js có thể thêm query `sb_flow_id`; giữ nguyên query đó khi callback, không đổi sang token fragment.
5. SQL Editor: chạy `database/migrations/08_auth_profiles.sql` trên database đã có 01–04. Migration sửa trigger tạo profile, bổ sung hồ sơ thiếu và RPC `ensure_my_profile()`. Vai trò mới luôn là customer; không lấy role từ Google/user_metadata và không đổi role/chi nhánh của tài khoản cũ.
6. Nếu chưa triển khai các tính năng trước: chạy lần lượt 05_customer_groups.sql → 06_home_sections.sql → 07_buy_now.sql. Với database mới: chạy đủ 01 → 08 theo thứ tự. Không chạy lại các migration khởi tạo 01–04 trên database đã có dữ liệu.
7. Sau khi A/C đăng nhập, kiểm tra trong Authentication → Users và bảng profiles: cùng UUID, full_name không trống, role=customer, branch_id=null cho người dùng mới. Không xoá/đổi role tài khoản quản lý có sẵn.

Tài liệu gốc: [Supabase Google](https://supabase.com/docs/guides/auth/social-sign-in/auth-google), [Mobile deep linking](https://supabase.com/docs/guides/auth/native-mobile-deep-linking).

## A/C: cài, kiểm tra và chạy Android (PowerShell)

Terminal 1, ở máy đang có workspace:

```powershell
Set-Location 'C:\Users\JuLong\uniqlo-mobile\frontend'
npm.cmd ci
```

Giữ file .env hiện tại. Chỉ khi chưa có file này mới chạy `Copy-Item .env.example .env`, rồi điền URL và publishable key của project do B cung cấp. Không thêm Google Client Secret, service_role hoặc mật khẩu database vào .env của frontend.

Kiểm tra trước khi build (nếu lệnh nào lỗi thì xử lý trước khi tiếp tục):

```powershell
npm.cmd run lint -- --no-cache
.\node_modules\.bin\tsc.cmd --noEmit
npm.cmd run test:auth
npm.cmd run test:cart
npm.cmd run test:catalog
npm.cmd run test:home
npm.cmd run test:product
```

Mở Pixel_10a trong Android Studio Device Manager. Kiểm tra thiết bị rồi build APK debug tại máy, không cần EAS:

```powershell
$env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
$env:Path = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:Path"
& "$env:ANDROID_HOME\platform-tools\adb.exe" devices
$env:REACT_NATIVE_PACKAGER_HOSTNAME = '127.0.0.1'
npm.cmd run android:build -- --no-bundler
& "$env:ANDROID_HOME\platform-tools\adb.exe" -e reverse tcp:8081 tcp:8081
npm.cmd start -- --dev-client --lan --port 8081 --clear
```

Dừng Metro cũ bằng Ctrl+C ở terminal của nó trước khi dùng cổng 8081. Khi Metro đã chạy, nhấn **a** để mở bản app `com.uniqlo.mobile`. Nếu Android Studio nằm nơi khác, sửa JAVA_HOME. Lần build đầu tải Gradle/SDK và có thể mất nhiều phút. Thư mục android được Expo sinh tự động, không sửa tay/commit.

Đây là development build có scheme `uniqlomobile`. **Expo Go không dùng để nghiệm thu Google OAuth** vì không sở hữu scheme riêng của app. Những lần sau chỉ cần adb reverse và lệnh Metro; build lại khi thay native dependency hoặc app.json.

Tài liệu: [Expo OAuth](https://docs.expo.dev/guides/authentication/).

## C: nghiệm thu với tài khoản Google thật

- Tôi → Đăng nhập → Tiếp tục với Google: chọn tài khoản, đồng ý, quay lại đúng màn hình trước đăng nhập. Tôi hiển thị tên/email/hồ sơ hợp lệ. B xác nhận có auth.users và profiles tương ứng.
- Thử từ giỏ hàng và Mua hàng: sau Google vẫn giữ đúng màn hình, sản phẩm và số lượng cần mua.
- Đóng hoàn toàn rồi mở lại app: vẫn đăng nhập, giỏ hàng thuộc đúng người. Kiểm tra sau khi để app nền quá hạn access token để xác nhận refresh.
- Bấm Back/đóng trình duyệt hoặc từ chối cấp quyền: trở về app, báo đã huỷ, không tạo trạng thái thành công, nút Google dùng lại được.
- Mất mạng, provider chưa bật, callback không có code/hết hạn: hiện lỗi, không điều hướng như đăng nhập thành công. Có thể thử lại.
- Đăng xuất: tên/email, giỏ hàng và đơn của tài khoản cũ được gỡ khỏi giao diện. Đóng/mở lại vẫn đăng xuất. Đăng nhập Google bằng người khác và kiểm tra không lẫn dữ liệu. Phiên Google trong trình duyệt không bị đăng xuất; app luôn yêu cầu chọn tài khoản.
- Tài khoản email/mật khẩu cũ vẫn đăng nhập được; role manager/admin không bị đổi bởi migration hồ sơ.

## Đưa lên GitHub để B/C review

Repo hiện tại: https://github.com/LongTrinh18/mobile-nhom-23, đang ở main. Tạo nhánh mới từ workspace hiện tại; không pull/ghi đè lên phần chưa commit. Các lệnh sau do bạn tự chạy:

```powershell
Set-Location 'C:\Users\JuLong\uniqlo-mobile'
git status --short
git switch -c feature/mobile-supabase-google-auth
git add -A -- README.md frontend database/migrations docs/HUONG_DAN_B_C_AUTH_GITHUB.md docs/GITHUB_PR_B_C.md docs/GITHUB_COMMIT_MESSAGE.txt
git diff --cached --stat
git diff --cached --name-only
git diff --cached --check
```

Đọc danh sách file đã stage. Không đưa .env, log .expo, token, Google Client Secret hoặc mật khẩu lên Git. .env.example chỉ chứa giá trị mẫu. Xem nội dung thay đổi bằng `git diff --cached`. Tên commit dưới đây mô tả cả các tính năng trước đang được bàn giao, không chỉ Google Auth:

```powershell
git commit -F docs/GITHUB_COMMIT_MESSAGE.txt
git push -u origin feature/mobile-supabase-google-auth
```

Nếu tên nhánh đã tồn tại, chọn tên mới và dùng cùng tên đó khi push. Không dùng force push.

Tạo PR trên GitHub: https://github.com/LongTrinh18/mobile-nhom-23/compare/main...feature/mobile-supabase-google-auth?expand=1

Tiêu đề: **Tích hợp giao diện mua sắm, Supabase và đăng nhập Google trên Android**. Copy nội dung từ `docs/GITHUB_PR_B_C.md`; mời B review SQL/Auth, C review luồng giỏ hàng/đặt hàng/tài khoản. Chỉ đánh dấu đăng nhập Google thật đã đạt sau khi hoàn tất nghiệm thu ở trên.

Nếu đã cài và đăng nhập GitHub CLI, có thể tạo PR từ terminal:

```powershell
gh pr create --base main --head feature/mobile-supabase-google-auth --title 'Tích hợp giao diện mua sắm, Supabase và đăng nhập Google trên Android' --body-file docs/GITHUB_PR_B_C.md
```
