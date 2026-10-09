---
name: garage-cashflow
description: Module tri thức Quản lý Thu Chi Xưởng (Garage Cashflow) trong erp-api (kgara-api-core). Chứa toàn bộ database schema (kgara_cashflow_vouchers), DTOs, API endpoints, logic tạo phiếu cấn trừ tự động (kgara_case_settlements), và dashboard thống kê thu chi độc lập với cashflow chung của ERP.
---

# 📦 Module Tri Thức: Garage Cashflow (Thu chi xưởng) - Backend (`erp-api`)

## 1. Tổng quan Nghiệp vụ
Module **Garage Cashflow** quản lý luồng tiền thu/chi đặc thù của xưởng (Garage). Tính năng này được thiết kế ĐỘC LẬP hoàn toàn với Cashflow chung của ERP (`erp_cash_vouchers`, `erp_bank_transactions`), nhưng cung cấp khả năng tham chiếu/liên kết đến các phiếu ngân hàng hoặc sổ quỹ của ERP.
- Đóng vai trò là sổ quỹ trung tâm của Garage.
- Khi tạo thu/chi có gắn với Phiếu dịch vụ (`case_id`), hệ thống tự động sinh và cập nhật các dòng cấn trừ vào bảng `kgara_case_settlements` để đối soát và tính công nợ.

## 2. Database Schema & Quan hệ Dữ liệu
**Bảng chính**: `kgara_cashflow_vouchers`
- `id` (uuid, PK)
- `voucher_code` (varchar 50, UNIQUE) - VD: `PT-GARA-YYMMDD-XXX`, `PC-GARA-YYMMDD-XXX`
- `voucher_type` (varchar 20) - `RECEIPT` hoặc `PAYMENT`
- `amount` (numeric 18,2, default 0) - Số tiền
- `trans_date` (date) - Ngày giao dịch
- `case_id` (uuid, FK -> `kgara_cases`, nullable) - Tham chiếu Phiếu dịch vụ liên quan
- `erp_bank_transaction_id` (uuid, FK -> `erp_bank_transactions`, nullable) - Tham chiếu sao kê ngân hàng ERP
- `erp_cash_voucher_id` (uuid, nullable) - Tham chiếu phiếu thu/chi sổ quỹ ERP
- `note` (text, nullable)
- `created_by`, `created_at`, `updated_at`

**Ràng buộc & Index**:
- Khóa ngoại liên kết tới `kgara_cases.id` và `erp_bank_transactions.id` với `ON DELETE SET NULL`.
- Các chỉ mục: `IDX_gara_cashflow_code`, `IDX_gara_cashflow_case`, `IDX_gara_cashflow_trans_date`.

**Sự thay đổi ở** `kgara_case_settlements`:
- Được thêm trường `cashflow_voucher_id` (uuid, FK -> `kgara_cashflow_vouchers.id`, `ON DELETE SET NULL`) để mapping tự động từ phiếu thu/chi sang phiếu cấn trừ.

## 3. Cấu trúc Source Code Backend
Thuộc phân hệ `kgara-api-core`:
```text
src/kgara-api-core/
├── entities/
│   ├── kgara_cashflow_voucher.entity.ts
│   └── kgara_case_settlement.entity.ts (cập nhật mapping cashflow_voucher_id)
├── dto/
│   └── garage-cashflow.dto.ts (Create, Update, List Query)
├── controllers/
│   └── garage-cashflow.controller.ts (Base path: /api/v1/greenway/cashflow-vouchers)
└── services/
    └── garage-cashflow.service.ts (Logic xử lý giao dịch, dashboard stats)
```

## 4. Danh sách API Endpoints & RBAC Contract

**Controller**: `GarageCashflowController`
**Base Route**: `/api/v1/greenway/cashflow-vouchers`
**Yêu cầu quyền**: Resource `GARAGE` (thuộc hệ thống Role-Based Access Control).

| HTTP Method | Endpoint | Quyền (Action) | Mô tả |
|-------------|----------|----------------|-------|
| `GET` | `/` | `READ` | Lấy danh sách phiếu thu/chi xưởng (phân trang, filter theo date, type, case_id). Hỗ trợ multi-search qua `column_filters`, `column_search` và mảng sort `sorts`. |
| `GET` | `/column-options` | `READ` | Lấy danh sách giá trị option phân trang cho bộ lọc cột (dynamic column filters). |
| `GET` | `/dashboard` | `READ` | Thống kê KPI (tổng thu, chi, net), breakdown theo loại và trend 6 tháng gần nhất. |
| `POST` | `/` | `CREATE` | Tạo phiếu mới. Nếu có `case_id`, tự động tạo record cấn trừ trong `kgara_case_settlements`. |
| `PUT` | `/:id` | `UPDATE` | Cập nhật phiếu thu/chi. Tự động đồng bộ sang record cấn trừ tương ứng. |
| `DELETE` | `/:id` | `DELETE` | Xóa phiếu thu/chi, đồng thời xóa record cấn trừ liên kết. |

## 5. Logic Nghiệp vụ Trọng tâm
- **Transaction Safety**: Toàn bộ thao tác Create, Update, Delete đều sử dụng `queryRunner.startTransaction()` để đảm bảo tính nhất quán (ACID) giữa bảng `kgara_cashflow_vouchers` và `kgara_case_settlements`.
- **Auto-Sync Settlements**:
  - Khi **tạo** Voucher có `caseId`, hệ thống tự sinh `KgaraCaseSettlement` với `sourceChannel = 'ON_SYSTEM'`, `paymentMethod = 'CASH'`, `payerType = 'KH'`.
  - Khi **cập nhật** Voucher (thay đổi `amount`, `date`, `caseId`), hệ thống dò tìm `KgaraCaseSettlement` qua `cashflowVoucherId` để cập nhật đồng bộ, hoặc xóa đi (nếu `caseId` bị gỡ), hoặc tạo mới (nếu `caseId` mới được thêm vào).
  - Khi **xóa** Voucher, hệ thống tự động kiểm tra và xóa `KgaraCaseSettlement` tương ứng nếu có.
- **Mã tự động**: `voucherCode` nếu client không truyền lên sẽ tự sinh theo format: `PT-GARA-YYMMDD-XXX` hoặc `PC-GARA-YYMMDD-XXX`.
- **Sorting & Filtering Động**: Hỗ trợ sort nhiều field (parse từ `sorts` query param CSV) mapping chuẩn xác với entity TypeORM. Sử dụng `applyMultiKeywordFilter` cho tìm kiếm đa từ khóa.

## 6. Tích hợp Liên Module
- **erp-bank-transactions**: Lưu tham chiếu qua trường `erpBankTransactionId` (không ràng buộc cứng business logic, chỉ dùng cho tra cứu chéo/đối soát). Khi get list hoặc view detail, queryBuilder `leftJoinAndSelect` để lấy `transactionCode` thay vì chỉ dùng UUID.
- **erp-cash-vouchers**: Lưu tham chiếu qua trường `erpCashVoucherId`.
- **kgara-cases**: Lấy thông tin khách hàng (`khachHangName`) từ `KgaraCase` để gán `partnerName` vào phiếu cấn trừ `KgaraCaseSettlement`. Hiển thị `soChungTu` qua join.

## 7. Cấu trúc Source Code Frontend (Web)
Tuân thủ nghiêm ngặt **Atomic UI** (5 files Organism) cho cấu trúc Data Table theo `/standardize-table`:
```text
src/modules/garage/components/organisms/
├── garage-cashflow-table/          (Thư mục Organism cho Data Table chuẩn)
│   ├── index.ts
│   ├── GarageCashflowTable.tsx     (Main component, quản lý giao diện Data Table)
│   ├── GarageCashflowTable.columns.tsx (Cấu hình TableText, Badge, Right-align cho số)
│   ├── GarageCashflowTable.hook.ts (Fetch dữ liệu, quản lý state sorts, filters, pagination)
│   └── GarageCashflowTable.type.ts
├── garage-cashflow-drawer/
│   └── GarageCashflowDrawer.tsx    (Sử dụng StandardFormDrawer, layout 1 cột, hiển thị mã liên kết)
└── garage-cashflow-list/
    └── GarageCashflowList.tsx      (Wrapper component, kết nối Table và Drawer, không chứa logic UI sâu)
```
- **Sort format**: Gửi lên API dưới dạng chuỗi ngăn cách dấu phẩy (vd: `sorts=createdAt,-amount`) thay vì truyền dạng array object `sorts[]=...` để tránh lỗi Class-Validator của NestJS.
- **Display**: Sử dụng `TableText` component có enableCopy và `onDetailClick`. Các tham chiếu hiển thị bằng Name/Code (`soChungTu`, `transactionCode`) thay vì UUID.

## 8. Quy tắc Kiểm thử & Báo cáo Chất lượng
Khi có thay đổi logic trong module này, bắt buộc phải:
1. Kiểm tra typing API: `bun run type:check` (trong thư mục API)
2. Chạy CI local: `bun run check:ci` (trong thư mục API)
3. Chạy unit tests API: `bunx jest src/kgara-api-core/services/garage-cashflow.service.ts`
4. Kiểm tra typing Web: `bunx tsc --noEmit` (trong thư mục Web)
