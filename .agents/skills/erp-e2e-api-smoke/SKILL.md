---
name: erp-e2e-api-smoke
description: Quy trình E2E/smoke cho erp-api. Gồm jest e2e (`*.e2e-spec.ts`, bun run test:e2e) và smoke script Node trên API đang chạy (test/smoke/*.smoke.mjs) cho luồng PR/PO nhân bản và garage. Dùng khi cần kiểm tra luồng nghiệp vụ end-to-end phía API.
---

# ERP API — E2E và Smoke

## 1. Hai loại kiểm tra

| Loại | Lệnh | Yêu cầu |
|---|---|---|
| Jest e2e (`test/*.e2e-spec.ts`, cấu hình `test/jest-e2e.json`) | `bun run test:e2e` | Boot app qua Nest testing module, cần DB test |
| Smoke trên API đang chạy (`test/smoke/*.smoke.mjs`) | `bun run test:smoke:clone`, `bun run test:smoke:procurement` | API đang chạy ở `E2E_API_URL`, DB đúng, tài khoản test |

Unit test (`bunx jest --forceExit`, hoặc scope hẹp `bunx jest --forceExit procurement`) vẫn là lớp kiểm tra chính trước commit.

## 2. Biến môi trường smoke

- `E2E_PASSWORD`: BẮT BUỘC. Script thoát mã 2 nếu thiếu. Không hardcode.
- `E2E_API_URL` (mặc định `http://localhost:10003`).
- `E2E_TAO_EMAIL` (mặc định `ai-test-tao@example.com`), `E2E_DUYET_EMAIL` (mặc định `ai-test-duyet@example.com`).

Ví dụ: `E2E_PASSWORD='...' bun run test:smoke:clone`.

## 3. Điều kiện trước khi chạy smoke

1. API chạy đúng `PORT` trong `.env` (`bun start:dev`). Không chạy smoke trên DB production.
2. Trước khi ghi DB: `SELECT current_database();`, báo tên DB cho người dùng. Không suy ra DB từ tên file env.
3. Smoke tạo dữ liệu mới (tên có tag, số chứng từ mới). Dữ liệu này không tự dọn, nên ghi rõ trong báo cáo nếu người dùng cần dọn.

## 4. Cách báo kết quả

- Báo số kiểm tra PASS/FAIL lấy từ lần chạy hiện tại (ví dụ `TOTAL 55, FAILED 0`), kèm scope đã chạy.
- Nếu không chạy được (thiếu API, thiếu mật khẩu), nói rõ là chưa chạy và lý do.

## 5. Thêm smoke mới

- Đặt vào `test/smoke/<ten>.smoke.mjs`, đọc cấu hình từ biến môi trường như hai script có sẵn.
- Thêm script `test:smoke:<key>` vào `package.json`.
- Kỳ vọng phải khớp quy tắc nghiệp vụ hiện tại. Ví dụ: PO garage duyệt tắt thì `submit` đi thẳng sang APPROVED; PO submit cần `supplierId` (UUID); PATCH phiếu không phải DRAFT trả 409; từ chối chuyển REJECTED, không về DRAFT.

- Bước nhận hàng GR (mục 7b của `procurement.smoke.mjs`): route GR là v1 (`/api/v1/garage-goods-receipts`, phản hồi bọc `{ message, data }`), GR phải cùng NCC và chi nhánh với PO, PO phải ISSUED. Sổ tồn kiểm bằng SQL trên `garage_stock_transactions` (document_type `GOODS_RECEIPT_GARAGE`: dòng `RECEIPT` khi post, `RECEIPT_CANCEL` khi cancel) và `garage_stock_balances`; smoke là HTTP nên không đọc DB.
