# Task: GDT Portal Password Encryption & Auto Re-login

## Mục tiêu
- Mã hóa mật khẩu Cổng Thuế GDT bằng AES-256-CBC trước khi lưu vào DB.
- Tự động re-login khi token Cổng Thuế hết hạn (retry tối đa 3 lần, mỗi lần cách nhau 1 phút).
- Ẩn password khỏi API endpoint `GET /portal/token`, chỉ trả về `hasPassword: boolean`.

## Trạng thái thực hiện (Checklist)
- [x] Tạo helper mã hóa `src/common/utils/encrypt.util.ts` & unit test `encrypt.util.spec.ts`
- [x] Cập nhật `InvoicePortalService`:
  - [x] `savePortalConfig`: mã hóa password trước khi lưu
  - [x] `getPortalConfig`: trả về `hasPassword`, bảo mật password
  - [x] `getInternalPortalConfig`: lấy credentials đã decrypt cho xử lý nội bộ
  - [x] `autoReloginWithRetry`: tự động giải captcha & đăng nhập lại (tối đa 3 lần, cách nhau 1 phút)
  - [x] Tự động re-login khi phát hiện `GDT_TOKEN_EXPIRED` trong quá trình xác thực và đồng bộ
- [x] Cập nhật `ErpInvoicesCoreController` & `erpInvoicesCoreApi` (Web)
- [x] Chạy unit test & QC (172/172 unit tests pass, check:ci pass, build pass)
