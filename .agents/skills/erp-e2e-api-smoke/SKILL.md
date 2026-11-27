---
name: erp-e2e-api-smoke
description: Quy trình E2E/smoke cho erp-api. Gồm jest e2e (`*.e2e-spec.ts`, bun run test:e2e) và smoke script Node trên API đang chạy (test/smoke/*.smoke.mjs) cho luồng PR/PO nhân bản và garage. Dùng khi cần kiểm tra luồng nghiệp vụ end-to-end phía API.
---

# ERP API — E2E và Smoke

## 1. Hai loại kiểm tra

| Loại | Lệnh | Yêu cầu |
|---|---|---|
| Jest e2e (`test/*.e2e-spec.ts`, cấu hình `test/jest-e2e.json`) | `bun run test:e2e` | Boot app qua Nest testing module, cần DB test |
| Smoke trên API đang chạy (`test/smoke/*.smoke.mjs`) | `bun run test:smoke:clone`, `bun run test:smoke:procurement`, `bun run test:smoke:save-and-act` (orchestration save-and-submit/confirm/post, rollback, hoàn nhập), `bun run test:smoke:cases-garage-kanban` (đổi status xe sync/NATIVE, revert, công đoạn; cần `E2E_SYNC_BRANCH` = id chi nhánh ERP `branches_management` có xe KGARA_SYNC), `bun run test:smoke:garage-v2-branch-scope` (Garage V2 header `x-erp-branch-id` không bắt buộc: không header = mọi chi nhánh, header lọc đúng chi nhánh, khác chi nhánh 404, sai UUID 400, lọc `classification=OJ` trên board/tiến độ, tạo xe NATIVE có/không chi nhánh, công nợ/thu chi V2 không cần header; cần `E2E_ERP_BRANCH_IDS`=`<GR>,<GN>`, tùy chọn `E2E_OJ_BRANCH_ID`), `bun run test:smoke:garage-v1-no-branch` (Garage V1 chỉ đọc: không header vẫn trả mọi phiếu, header KGara cũ không thu hẹp, lọc phân loại OJ, công nợ/báo cáo không cần header, `dashboard` gọi thẳng KGara vẫn báo thiếu chi nhánh; tùy chọn `E2E_KGARA_BRANCH_ID`, `E2E_V1_EXPECTED_CASES` = số phiếu SQL `kgara_deleted_at IS NULL`), `bun run test:smoke:garage-cashflow-qr` (phiếu thu chi garage V1 lưu thông tin thanh toán QR: tạo phiếu thu kèm `qr*`, PUT một phần giữ field không gửi và rỗng thành null, BIN/số TK sai trả 400, BIN có khoảng trắng hai đầu được cắt và lưu, đọc lại qua list `column_filters`, gửi null để xóa; cuối script xóa phiếu đã tạo), `bun run test:smoke:garage-debts-legacy-split` (luồng LEGACY V1 → sổ nợ v2: phiếu thu V1 `payerType=KH` vượt nợ khách trên vụ có bảo hiểm → dòng CUSTOMER về 0, phần vượt trừ dòng INSURER, tổng sổ nợ = V1 `tienConPhaiThanhToan`; xóa phiếu thì hoàn lại; bắt buộc `E2E_CASE_ID` = vụ có CUSTOMER > 0 và INSURER > `E2E_RECEIPT_EXTRA` (mặc định 100000); cuối script xóa phiếu đã tạo), `bun run test:smoke:users` (users-management V2, tiền tố `smoke-users-`), `bun run test:smoke:auth-sessions` (auth V2 `/api/v2/auth-sessions`: login, refresh xoay vòng, dùng lại token thu hồi, đua refresh, đổi mật khẩu/ngưng tài khoản thu hồi phiên, đổi token v1 sang v2, impersonate, v1 admin ghi qua v2; dùng `E2E_PASSWORD` với `E2E_TAO_EMAIL` (ai-test-tao); nhánh impersonate chỉ chạy khi tài khoản là `admin@liouni.com`, còn lại in INFO và bỏ qua; dọn `smoke-auth-<tag>-*` bằng SQL) | API đang chạy ở `E2E_API_URL`, DB đúng, tài khoản test |

Unit test (`bunx jest --forceExit`, hoặc scope hẹp `bunx jest --forceExit procurement`) vẫn là lớp kiểm tra chính trước commit.

## 2. Biến môi trường smoke

- `E2E_PASSWORD`: BẮT BUỘC. Script thoát mã 2 nếu thiếu. Không hardcode.
  - Nguồn: dòng `E2E_PASSWORD=` trong `erp-api/.env`. Mỗi lần chạy, nếu shell chưa có biến này thì tự đọc từ file đó, không hỏi người dùng. Không in giá trị, không ghi vào repo hay log.
- `E2E_API_URL`: BẮT BUỘC suy từ `PORT` trong `erp/erp-api/.env` (đọc bằng `sed -n 's/^PORT=//p' .env | head -1`, không in secret). Đặt `E2E_API_URL=http://localhost:<PORT>`. Không dùng mặc định cố định. Chỉ ghi đè khi người dùng yêu cầu rõ.
  - Quy tắc PORT API ↔ Web (dùng chung với `erp-e2e-playwright`):

| API `PORT` | Web port (`E2E_WEB_URL`) |
|---|---|
| 10001 | 5171 |
| 10002 | 5172 |
| 10003 | 5173 |

Cặp port không phụ thuộc workspace `repos-dev-0X`; chỉ phụ thuộc giá trị `PORT` trong `erp/erp-api/.env`.

  - `PORT` ngoài ba giá trị trên: dừng và hỏi người dùng trước khi chạy.
- `E2E_TAO_EMAIL` (mặc định `ai-test-tao@example.com`), `E2E_ADMIN_EMAIL` (mặc định `ai-test-admin@example.com`).

Ví dụ (từ `erp-api/`, lấy mật khẩu từ `.env`, không in ra):
`E2E_PASSWORD="$(sed -n 's/^E2E_PASSWORD=//p' .env | head -1 | tr -d "\"'")" bun run test:smoke:clone`.
Trước khi chạy: xác nhận `DATABASE_URL` trong `.env` không phải production và chạy `SELECT current_database();`.

## 3. Điều kiện trước khi chạy smoke

1. API chạy đúng `PORT` trong `.env`, và `E2E_API_URL` khớp `PORT` đó. Không chạy smoke trên DB production.
   - Luôn chạy code mới nhất: trước mỗi lần chạy smoke, tìm tiến trình đang nghe `PORT` (`ss -ltnp`). Nếu có, kiểm `readlink /proc/<pid>/cwd` phải là `erp/erp-api`, rồi dừng PID đó. Nếu cổng bị tiến trình của repo khác chiếm thì dừng và báo người dùng.
   - Sau khi cổng trống, chạy nền `bun run start:dev` trong `erp/erp-api` (`run_in_background`), chờ cổng nghe và log `Server đang chạy` (tối đa khoảng 120 giây).
   - Web (chỉ khi cần E2E UI): nếu `E2E_WEB_URL` (bảng ở mục 2) chưa nghe, tự chạy nền `bun run dev` trong `erp/erp-web` và chờ trả HTTP 200.
   - Chỉ dừng tiến trình có cwd là repo này (xem trên). Không dừng tiến trình của repo khác.
2. Trước khi ghi DB: `SELECT current_database();`, báo tên DB cho người dùng. Không suy ra DB từ tên file env.
3. Smoke tạo dữ liệu mới (tên có tag, số chứng từ mới). Dữ liệu này không tự dọn, nên ghi rõ trong báo cáo nếu người dùng cần dọn.

## 3b. Chi nhánh trong smoke Garage V2

- Từ 2026-11-25, Garage V2 (`cases-garage`, `debts-garage`, `debts-flow-garage`, `cashflow-vouchers-garage`) nhận header tùy chọn `x-erp-branch-id` = `branches_management.id`; header `x-kgara-branch-id` không còn tác dụng ở V2 (V1 vẫn dùng).
- Env: `E2E_ERP_BRANCH_ID` / `E2E_ERP_OTHER_BRANCH_ID` (`cases-garage-v2`, `garage-workshop`, bỏ trống là không chi nhánh), `E2E_SYNC_BRANCH` (id ERP), `E2E_BRANCH_ID` (`garage-debts-v2`, tùy chọn; so V1/V2 thì chạy không chi nhánh vì V1 không lọc theo chi nhánh ERP).
- Staging `erp_greenway_staging` (từ 2026-11-28 là bản sao production, id chi nhánh đổi): PQ `6d37f290-b465-4af1-91b6-265ced4b30bb` (đang chứa toàn bộ xe), GR `24a3223b-fb69-4266-bae4-ba7dac601be6`, GN `0155ec21-e974-4591-abd3-0891ebee6d0b`. `garage-v2-branch-scope` cần chi nhánh A có xe: dùng `E2E_ERP_BRANCH_IDS=<PQ>,<GR>`. Id có thể đổi sau mỗi lần ghi đè DB; kiểm lại bằng `SELECT id, code FROM branches_management`.
- Đã biết: `garage-debts-v2` check "cases trang 1 cùng id và thứ tự" lệch khi hai phiếu trùng `issued_at` (V1 và V2 tie-break khác nhau), tập phiếu vẫn trùng.

## 4. Cách báo kết quả

- Báo số kiểm tra PASS/FAIL lấy từ lần chạy hiện tại (ví dụ `TOTAL 55, FAILED 0`), kèm scope đã chạy.
- Nếu không chạy được (thiếu API, thiếu mật khẩu), nói rõ là chưa chạy và lý do.

## 5. Thêm smoke mới

- Đặt vào `test/smoke/<ten>.smoke.mjs`, đọc cấu hình từ biến môi trường như hai script có sẵn.
- Thêm script `test:smoke:<key>` vào `package.json`.
- Kỳ vọng phải khớp quy tắc nghiệp vụ hiện tại. Ví dụ: PO garage duyệt tắt thì `submit` đi thẳng sang APPROVED; PO submit cần `supplierId` (UUID); PATCH phiếu không phải DRAFT trả 409; từ chối chuyển REJECTED, không về DRAFT.

- Bước nhận hàng GR (mục 7b của `procurement.smoke.mjs`): route GR (`/api/v2/garage-goods-receipts`, phản hồi bọc `{ message, data }`), GR phải cùng NCC và chi nhánh với PO, PO phải ISSUED. Sổ tồn kiểm bằng SQL trên `garage_stock_transactions` (document_type `GOODS_RECEIPT_GARAGE`: dòng `RECEIPT` khi post, `RECEIPT_CANCEL` khi cancel) và `garage_stock_balances`; smoke là HTTP nên không đọc DB.
