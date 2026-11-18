---
name: cashflow-vouchers-garage
description: Module phiếu thu chi garage v2 (api/v2/cashflow-vouchers-garage) phần đọc - danh sách, column-options, dashboard, kiểm tra trùng; kế thừa cashflow-vouchers-core. Đọc trước khi sửa thu chi garage v2. Ghi nằm ở debts-flow-garage.
---

# cashflow-vouchers-garage (src/v2/modules/cashflow-vouchers-garage)

Bảng `cashflow_vouchers_garage` (entity `CashflowVoucherGarage`, kế thừa `BaseCashflowVoucherEntity`). Chi nhánh bắt buộc qua header. Đăng ký ở `app.module.ts`.

## 1. Route (đọc, quyền `GARAGE_CASHFLOW:READ`)
`GET /` (list), `GET column-options`, `GET dashboard`, `GET duplicate-check`, `GET :id`. Route ghi (POST/PATCH/status/cancel) do `debts-flow-garage` cung cấp trên cùng prefix.

## 2. Thành phần
- `GarageVoucherCodeService`: mã `PT|PC-GARA-yymmdd-NNN`.
- `CashflowVoucherGarageCommandService` (kế thừa abstract command), `-QueryService`, `-InsightService` (dashboard, kiểm trùng).
- DTO class-validator whitelist (create/update/query), mapper và helper mã.

## 3. Quy tắc
- Hủy = `CANCELLED`, không xóa cứng. Không ghi trực tiếp từ module này khi phiếu ảnh hưởng công nợ: dùng `debts-flow-garage`.
- Test: jest `src/v2/modules/cashflow-vouchers-garage`.
