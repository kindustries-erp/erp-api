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
    ├── garage-cashflow.service.ts (Facade Service Pattern, Clean DI Constructor)
    ├── garage-cashflow-transaction.service.ts (Sub-Service quản lý tạo, sửa, xóa, cấn trừ, transaction lock)
    └── engines/
        └── garage-cashflow-query.engine.ts (Sub-Service query, get list, columns options, filter)
```

## 4. Danh sách API Endpoints & RBAC Contract

**Controller**: `GarageCashflowController`
**Base Route**: `/api/v1/greenway/cashflow-vouchers`
**Yêu cầu quyền**: Resource `GARAGE_CASHFLOW` (`garage_cashflow`) (thuộc hệ thống Role-Based Access Control, tách riêng độc lập khỏi `GARAGE`).

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
Tuân thủ nghiêm ngặt **Atomic UI** (Folder-per-Component, < 180 LoC/file, co-located tests, No Blue Mandate) theo `/ui-atomic-refactor`:
```text
src/modules/garage/components/organisms/
├── garage-cashflow-table/          (Thư mục Organism cho Data Table chuẩn)
│   ├── index.ts
│   ├── GarageCashflowTable.tsx     (Main component, quản lý giao diện Data Table)
│   ├── GarageCashflowTable.columns.tsx (Cấu hình TableText, Badge, Right-align, < 180 LoC)
│   ├── GarageCashflowTable.helper.tsx (Tách các hàm render cell phức tạp để giảm tải file columns, < 100 LoC)
│   ├── GarageCashflowTable.hook.ts (Fetch dữ liệu query params, options, filters)
│   ├── GarageCashflowTable.type.ts
│   └── GarageCashflowTable.test.tsx (Co-located Unit Test)
├── garage-cashflow-drawer/         (Thư mục Organism cho Drawer chuẩn Atomic bóc tách < 180 LoC)
│   ├── index.ts
│   ├── GarageCashflowDrawer.tsx    (Khung StandardFormDrawer, điều phối sub-sections, < 80 LoC)
│   ├── GarageCashflowDrawer.hook.ts (Hook form state, validation, mutations, RBAC canCreate/canUpdate, < 130 LoC)
│   ├── GarageCashflowDrawer.type.ts (Props interface, DTO mappings, < 30 LoC)
│   ├── GarageCashflowDrawerGeneralSection.tsx (Sub-section Thông tin chung, < 180 LoC)
│   ├── GarageCashflowDrawerSettlementSection.tsx (Sub-section Thông tin đối soát, < 90 LoC)
│   └── GarageCashflowDrawer.test.tsx (Co-located Unit Test)
└── garage-cashflow-list/
    ├── GarageCashflowList.tsx      (Wrapper component, kết nối Table và Drawer, tích hợp canCreate/canUpdate/canDelete từ GARAGE_CASHFLOW)
    └── GarageCashflowList.test.tsx (Co-located Unit Test)
```
- **Phân quyền Context Menu & Action Menu (Row Actions)**:
  - Chỉ hiển thị mục "Xóa phiếu" khi người dùng có quyền `ErpResource.GARAGE_CASHFLOW, ErpAction.DELETE` (`canDelete === true` và `onDelete` được định nghĩa). Người không có quyền xóa sẽ bị ẩn hoàn toàn cả nhóm "Khác" và item xóa trong cả Context Menu (chuột phải) lẫn Action Menu (`...`).
  - Text label "Xóa phiếu" hiển thị màu chữ chuẩn hệ thống (`text-foreground`, tương đồng với "Xem chi tiết", "Chỉnh sửa"), không dùng `variant: "danger"` để tránh bị tô đỏ toàn bộ nhãn.
  - Icon thùng rác `<Trash2 />` được tô đỏ trực tiếp bằng class `text-red-500` (`<Trash2 className="w-4 h-4 text-red-500" />`) để đảm bảo trực quan nhận diện hành động xóa.
- **Sort format**: Gửi lên API dưới dạng chuỗi ngăn cách dấu phẩy (vd: `sorts=createdAt,-amount`) thay vì truyền dạng array object `sorts[]=...` để tránh lỗi Class-Validator của NestJS.
- **Display**: Sử dụng `TableText` component có enableCopy và `onDetailClick`. Các tham chiếu hiển thị bằng Name/Code (`soChungTu`, `transactionCode`) thay vì UUID.

## 8. Quy tắc Kiểm thử & Báo cáo Chất lượng
Khi có thay đổi logic trong module này, bắt buộc phải:
1. Kiểm tra typing API: `bun run type:check` (trong thư mục API)
2. Chạy CI local: `bun run check:ci` (trong thư mục API)
3. Chạy unit tests Controller & Facade Service API:
   - `bunx jest src/kgara-api-core/controllers/garage-cashflow.controller.spec.ts`
   - `bunx jest src/kgara-api-core/services/garage-cashflow.service.spec.ts`
4. Kiểm tra typing Web: `bunx tsc --noEmit` (trong thư mục Web)
5. Chạy unit tests Web:
   - `bunx vitest run src/modules/garage/components/organisms/garage-cashflow-table/GarageCashflowTable.test.tsx`
   - `bunx vitest run src/modules/garage/components/organisms/garage-cashflow-drawer/GarageCashflowDrawer.test.tsx`
   - `bunx vitest run src/modules/garage/components/organisms/garage-cashflow-list/GarageCashflowList.test.tsx`
