# Bo ma demo nguoi A - UNIQLO Mobile (N1-N7)

Phan cai dat nay la **overlay** tren Expo app co san, khong phai mot repo moi.
Source path: `src/...`; script `apply_A.ps1` tu tim Expo trong repo root hoac `frontend/`.

## 1. Truoc khi cai

- `git status` phai clean, tranh ghi de cong viec chua commit.
- Chay rieng `git switch main`, sau do `git pull origin main` (neu co quyen main/da clone).
- Script tu tao branch `feature/SCRUM-6-11-a-catalog` neu dang o `main`.
- Giai nen ZIP vao mot thu muc ngoai repository.

## 2. Chay script tren Windows

Mo PowerShell trong `C:\Users\JuLong\uniqlo-mobile` (Git repo), sau do:

```powershell
& "C:\duong-dan-giai-nen\A_UNIQLO_Sprint1\apply_A.ps1"
```

Neu PowerShell chan .ps1, mo terminal PowerShell process moi voi:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "C:\duong-dan-giai-nen\A_UNIQLO_Sprint1\apply_A.ps1"
```

`-ExecutionPolicy Bypass` chi ap dung cho process nay, khong can doi policy he thong.

Script se **ghi de** file `src/app/index.tsx` va `src/app/_layout.tsx`, cung cac
route `cart`, `checkout`, `account` neu da co. Xem/bao ve thay doi cua C truoc khi ap dung.
Repo `main` chua duoc cap nhat cho den khi tao va merge Pull Request.

## 3. Cai dependency tu Expo root

Neu co `frontend/package.json`:

```powershell
cd frontend
npx expo install @supabase/supabase-js react-native-url-polyfill
npx tsc --noEmit
npx expo start --clear
```

Neu `package.json` o root:

```powershell
npx expo install @supabase/supabase-js react-native-url-polyfill
npx tsc --noEmit
npx expo start --clear
```

Android Emulator dang mo: nhan phim `a` trong terminal Expo.

## 4. Test voi mock (A03/A04)

**Khong tao .env**: app tu load 5 san pham x 3 SKU va 3 chi nhanh tu
`src/data/mock-catalog.ts`. Screens: Home > Danh muc > Chi tiet > Gio > Checkout.
Case ton kho 0 co san de test: product 3, variant thu 2, chi nhanh b01.
App se hien banner "du lieu mau", tuyet doi khong tu nhan la Supabase.

## 5. Noi Supabase (A05) - can B

B phai thong nhat schema trong `docs/CONTRACT_B_C.md`.
O Expo root, tao `.env` (KHONG commit):

```text
EXPO_PUBLIC_SUPABASE_URL=https://REAL_PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_REAL_KEY
```

Restart Metro: `Ctrl+C`; `npx expo start --clear`.

- Neu 5 san pham xuat hien va khong con banner mock: ket noi read OK.
- Neu co error: ten bang/cot, chinh sach RLS, mang, API key.
- Neu 0 san pham: verify B co seed data/SELECT policy.
- `docs/demo_supabase_reference.sql` chi la schema tham khao de kiem tra trong
  Supabase project RONG; khong chay tren DB B dang lam neu chua thong nhat.

## 6. Ghep voi nguoi C (A06)

Nguoi C import `useCart()` tu `src/context/CartContext.tsx` vao screen cua ho.
Nguoi A truyen `skuId`, `branchId`, `quantity`, `unitPriceVnd`, `maxAvailable`
qua `addItem`. Screen `cart.tsx` va `checkout.tsx` trong goi la tam thoi minh hoa
va C co quyen thay bang code cua C. **Khong tao don/transaction that**.

## 7. Test N7

- Chay `npx tsc --noEmit`, `npx expo start --clear`.
- Mo danh muc: 5 san pham; bam tung item den trang chi tiet.
- Chon size > mau > chi nhanh: SKU, stock thay doi chinh xac.
- Out of stock: nut them gio bi khoa.
- Them 2 item cung SKU/chi nhanh: gio cong don; hai chi nhanh KHONG gop.
- Tang/giam/xoa trong cart, tinh tong VND dung.
- Checkout: validate ten, SDT, dia chi; chi DEMO COD, khong co insert.
- Bo env/nhap sai env: xac nhan loading/error/empty trinh bay ro (khong tu dung mock thay DB loi).
- Quay video 1-3 phut; PR review boi C hoac B; gan link PR vao Jira.

## 8. Git

```powershell
git status
git add -A
git commit -m "SCRUM-6 SCRUM-7 SCRUM-8 feat: product UI and shared contracts"
git push -u origin feature/SCRUM-6-11-a-catalog
```

Sau khi A05/A06 duoc tich hop, tao commit/Pull Request bo sung voi
`SCRUM-9`, `SCRUM-10`, `SCRUM-11` va link vao Jira.

## Du lieu va ranh gioi

- Gia, ton kho khi thanh toan that phai doc lai o server va validate trong transaction.
- RLS phai chan thao tac sua gia/ton kho cua unauthenticated users.
- Toan bo du lieu ban dau tu mo phong, khong phai bang chung A05 da hoan thanh.
- Repo tren GitHub khong tu thay doi sau khi giai nen; nguoi A can commit + PR + merge.

## Lua chon sao chep thu cong neu khong muon chay PowerShell script

- Giai nen ZIP, mo Explorer, copy noi dung `src/` vao `src/` cua Expo root.
- Copy `docs/` vao thu muc goc cua Git repository.
- Copy `.env.example` vao Expo root.
- Them `.env`, `.env.*`, `!.env.example` vao root `.gitignore`.
- Thuc hien `npx expo install ...` va kiem tra `npx tsc --noEmit`.
- **Khong ghi de** source code moi cua nguoi C; merge theo tung file neu C da bat dau.
