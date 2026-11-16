# Nâng cấp Expo SDK 58

Frontend đã chuyển từ SDK 57 sang SDK 58 trên nhánh main, tích hợp với commit 34a7550 từ origin/main (PR #8: giao diện và sửa logic giỏ hàng/đặt hàng). Giữ font Be Vietnam Pro, lựa chọn từng món trong giỏ và luồng đặt hàng mới từ upstream.

## Phiên bản

| Thành phần | Phiên bản |
|---|---|
| Expo | ~58.0.25 |
| React / React DOM | 19.3.0 |
| React Native | 0.88.1 |
| Expo Router | ~58.0.31 |
| Reanimated / Worklets | 4.7.1 / 0.13.0 |
| Gesture Handler | ~3.3.0 |
| Safe Area Context / Screens | ~5.11.1 / ~4.30.1 |

Node cần nhánh 22 từ 22.13, nhánh 24 từ 24.3, hoặc phiên bản đáp ứng engines trong frontend/package.json. Máy hiện tại dùng Node 24.22.1.

## Thay đổi tương thích

- Đồng bộ gói Expo, thư viện native, React types và eslint-config-expo bằng Expo CLI; tạo lại lockfile với bộ dependency sạch do npm không giải được cây cũ.
- Dùng useRouter() trong component/hook; bỏ initialRouteName trên navigator, dùng unstable_settings.anchor cho tab.
- Chuyển ref của trang chủ sang ScrollViewInstance theo Strict API của React Native.
- Giữ logic lựa chọn giỏ hàng từ PR #8: cập nhật ref trong callback, giữ món chưa chọn khi tải lại và chỉ đặt các dòng được chọn.
- Thêm scripts start:go, start:dev, typecheck và test; cập nhật yêu cầu Node.

## Kiểm tra đã thực hiện

- Expo dependency check: tất cả phiên bản khớp SDK 58.
- Expo Doctor: 20/20 kiểm tra đạt.
- Lint: không lỗi, không cảnh báo.
- TypeScript: không lỗi, dùng Strict API của React Native, không bật chế độ legacy.
- 63 kiểm thử hiện có đạt sau khi tích hợp PR #8.
- Trước khi tích hợp PR #8: export production thành công cho Android, iOS và Web; kết quả cục bộ ở frontend/.expo/sdk58-export, không đưa lên Git. Chưa export lại sau khi tích hợp PR #8.

Chưa build APK, chạy Android SDK 58 trên máy ảo hoặc kiểm tra iOS trên máy thật trong lần nâng cấp này. Export native bundle không thay thế biên dịch Gradle/Xcode và kiểm thử thiết bị.

## Cài và build Android (PowerShell)

Mở Pixel_10a trong Android Studio Device Manager, chờ tới màn hình chính. Chạy các lệnh sau trong cùng một terminal:

```powershell
cd C:\Users\JuLong\uniqlo-mobile\frontend
npm.cmd ci

$env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
$env:Path = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:Path"
$env:REACT_NATIVE_PACKAGER_HOSTNAME = '127.0.0.1'

adb devices
npm.cmd run android:build -- --no-bundler
adb -e shell pm list packages com.uniqlo.mobile
adb -e reverse tcp:8084 tcp:8084
npm.cmd run start:dev -- --lan --port 8084 --clear
```

SDK 58 không cho dùng --port cùng --no-bundler: bước build ở trên không truyền cổng; cổng 8084 chỉ truyền khi chạy Metro bằng start:dev. Sau khi build xong, màn hình có thể chưa kết nối được cho đến khi Metro được bật. Nhấn a khi Metro sẵn sàng. Lệnh android:build sinh native project từ app.json, build và cài app com.uniqlo.mobile. Cần internet cho lần tải Gradle/SDK/NDK đầu tiên. Bản development build SDK 57 cũ cần build/cài lại để chạy SDK 58. Thư mục android/ios được sinh tự động và đã được Git bỏ qua.

Dùng cổng 8084 để tách khỏi các Metro phục vụ bản kiểm tra SDK 57. Máy chủ cũ ở cổng 8081 (nếu còn chạy) phục vụ checkout báo cáo giao diện, không phải frontend vừa nâng SDK.

Những lần chạy sau, nếu chỉ sửa JS/TS, mở máy ảo rồi dùng adb reverse và start:dev trong terminal đã có cấu hình SDK. Khi thay SDK, gói native hoặc cấu hình native thì build lại.

Nếu chỉ xem giao diện bằng Expo Go, cần Expo Go tương thích SDK 58:

```powershell
npm.cmd run start:go -- --android --port 8084 --clear
```

Google OAuth của dự án cần development build có scheme uniqlomobile, không nghiệm thu bằng Expo Go.

## Các lệnh kiểm tra của nhóm

```powershell
npm.cmd run typecheck
npm.cmd run lint -- --no-cache
npm.cmd test
.\node_modules\.bin\expo.cmd install --check
npx.cmd --yes expo-doctor
```

## Tham khảo

- [Hướng dẫn nâng Expo SDK](https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/)
- [Thay đổi của SDK 58](https://expo.dev/changelog/sdk-58)
- [Migration Router SDK 57 → 58](https://docs.expo.dev/router/migrate/sdk-57-to-58/)