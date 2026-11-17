---
name: debts-garage
description: Module công nợ garage v2 (api/v2/debts-garage) - công nợ phải thu khách hàng, phải trả nhà cung cấp, analytics, time-horizon, export nền. Chỉ đọc, xây trên debts-core và bảng kgara_*. Đọc trước khi sửa công nợ garage.
---

# debts-garage (api/v2/debts-garage)

Vị trí: `src/v2/modules/debts-garage`. Quyền `GARAGE_DEBTS:READ`. Chi nhánh bắt buộc qua header (`@BranchId()`), thiếu thì 400. V1 `/greenway/...` chạy song song, không đổi.

## 1. Route
- `GET customers`, `customers/column-options`: phải thu, gom theo biển số.
- `GET suppliers`, `suppliers/column-options`: phải trả.
- `GET analytics`; `GET analytics/time-horizons/:horizon/cases` (whitelist `TIME_HORIZONS`).
- Export nền (bọc `ExportJobRunner`): `POST export/:kind`, `GET export/:kind/history`, `GET export/:kind/:jobId/download`, SSE `export/:kind/progress`.
- Response list: `{ items, pagination, summaries? , extraData? }`.

## 2. Dữ liệu và quy tắc
- Nguồn: `kgara_cases`, `kgara_case_settlements`, hóa đơn liên kết. Bỏ qua `kgara_payables` / `kgara_receivables` (code cũ).
- Mốc `GARAGE_DEBT_BASELINE_DATE = 2026-07-01`; điều kiện vụ việc hoàn tất và NCC trong `helpers/garage-debt-sql.helper.ts`.
- Số tiền trả về là number (V1 trả chuỗi "0.00"). Không trả `raw_data`.
- Analytics chạy 5 truy vấn song song, kết quả deep-equal V1 trên staging.
- Khác V1: time-horizons trả `{items, pagination, extraData.summary}`; bỏ SQL payable-horizon cũ.
- Index: migration `1794832200000-GarageDebtsV2Indexes` (3 index).

## 3. Chưa làm
Drill-down `customers/:customerCode/cases`, `suppliers/:supplierId/cases`. Ghi settlement vẫn ở V1 tới plan orchestration.

## 4. Sổ công nợ (entity, chưa có service ghi)
- Entity `DebtGarage` (`debts_garage`) và `DebtAllocationGarage` (`debt_allocations_garage`) ở `entities/`, kế thừa entity base của `debts-core`. Migration `1794900000000-GarageCashflowDebtsV2Tables` đã chạy trên staging 2026-11-17 (bảng rỗng, chưa backfill; production chưa).
- Lớp đọc hiện tại vẫn tính từ `kgara_*`; chưa có cờ `DEBTS_GARAGE_LEDGER_READ`. Chi tiết: skill `debts-core`.
