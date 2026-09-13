---
name: erp-inventory-adjustments
description: Module tri thức Quản lý Kiểm kê & Điều chỉnh Kho trong Liouni ERP. Chứa toàn bộ database schema (erp_inventory_adjustments, erp_inventory_adjustment_lines), DTOs, API endpoints, logic sinh mã tự động KK-YYYYMMxxxx, tính chênh lệch thừa/thiếu và hạch toán số dư tồn kho.
---

# 📦 Module Tri Thức: Quản Lý Kiểm Kê & Điều Chỉnh Kho (`erp-inventory-adjustments`)

## 1. Tổng quan Nghiệp vụ

Phân hệ `erp-inventory-adjustments` (thuộc `inventory-adjustments-core`) quản lý toàn bộ quy trình kiểm kê định kỳ, kiểm kê đột xuất và xử lý chênh lệch thừa/thiếu giữa số lượng hàng hóa thực tế trong kho so với số lượng trên sổ sách phần mềm.

### 1.1. Các tính năng cốt lõi:
- **Tự động Sinh Mã Phiếu Kiểm kê**:
  - Mã phiếu sinh tự động theo quy tắc chuẩn: `KK-YYYYMMxxxx` (Kiểm kê) hoặc `DC-YYYYMMxxxx` (Điều chỉnh) (vd: `KK-2026080001`).
- **Phân loại Xử lý Chênh lệch (`type_adjust`)**:
  - `increase` (Điều chỉnh tăng / Thừa kho): Số lượng thực tế lớn hơn sổ sách $\to$ Tăng tồn kho và cập nhật giá vốn.
  - `decrease` (Điều chỉnh giảm / Thiếu kho): Số lượng thực tế nhỏ hơn sổ sách $\to$ Giảm tồn kho và ghi nhận chi phí hao hụt/mất mát.
- **Vòng đời Phiếu Điều chỉnh (Adjustment Lifecycle)**:
  - `DRAFT`: Phiếu nháp đang lập biên bản kiểm đếm. Cho phép thêm, sửa, xóa các dòng chi tiết mà không ảnh hưởng tới số dư tồn kho.
  - `POSTED`: Đã phê duyệt và ghi sổ kho. Hệ thống khóa bi quan và cập nhật trực tiếp vào `erp_inventory_balances` đồng thời sinh các bản ghi đối ứng trong `erp_inventory_transactions`.
  - `CANCELLED`: Hủy phiếu đã ghi sổ $\to$ Tự động sinh giao dịch đảo ngược (Reversal) để hoàn trả số dư tồn kho về trạng thái ban đầu.
- **Xóa mềm An toàn (`is_deleted = true`)**:
  - Chỉ cho phép xóa các phiếu ở trạng thái `DRAFT`.

---

## 2. Database Schema & Quan hệ Dữ liệu

### 2.1. Bảng `erp_inventory_adjustments` (Header Phiếu Kiểm kê)

| Cột | Kiểu | Nullable | Mặc định | Ghi chú |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO | `gen_random_uuid()` | Khóa chính (Primary Key) |
| `adjustment_no` | `varchar(255)` | NO | | Mã phiếu điều chỉnh (Unique Index) |
| `adjustment_date`| `timestamptz` | NO | | Ngày thực hiện kiểm kê / điều chỉnh |
| `status` | `varchar(255)` | NO | `'DRAFT'` | Trạng thái: `DRAFT`, `POSTED`, `CANCELLED` |
| `remarks` | `text` | YES | `NULL` | Lý do điều chỉnh / Ghi chú kiểm kê |
| `created_by` | `uuid` | YES | `NULL` | FK $\to$ `users.id` (Người lập phiếu) |
| `is_deleted` | `boolean` | NO | `false` | Cờ xóa mềm |
| `created_at` | `timestamptz` | NO | `now()` | Thời điểm tạo |
| `updated_at` | `timestamptz` | NO | `now()` | Thời điểm cập nhật |

### 2.2. Bảng `erp_inventory_adjustment_lines` (Dòng Chi tiết Điều chỉnh)

| Cột | Kiểu | Nullable | Mặc định | Ghi chú |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO | `gen_random_uuid()` | Khóa chính |
| `adjustment_id` | `uuid` | NO | | FK $\to$ `erp_inventory_adjustments.id` (Index `idx_adj_lines_adjustment_id`) |
| `line_no` | `int` | NO | | Số thứ tự dòng (1, 2, 3...) |
| `item_id` | `uuid` | YES | `NULL` | FK $\to$ `erp_inventory_items.id` (Mặt hàng điều chỉnh) |
| `qty_adjusted` | `numeric(15, 3)`| NO | `0` | Số lượng điều chỉnh chênh lệch |
| `type_adjust` | `varchar(50)` | YES | `NULL` | Hướng điều chỉnh: `'increase'` (Tăng) hoặc `'decrease'` (Giảm) |
| `unit_cost` | `numeric(19, 3)`| YES | `NULL` | Đơn giá vốn tại thời điểm điều chỉnh |
| `created_at` | `timestamptz` | NO | `now()` | Thời điểm tạo |
| `updated_at` | `timestamptz` | NO | `now()` | Thời điểm cập nhật |

---

## 3. Cấu trúc Source Code

### 3.1. Backend (`erp-api`)
```text
src/inventory-adjustments-core/
├── entities/
│   ├── erp_inventory_adjustment.entity.ts      # Entity Header phiếu kiểm kê
│   └── erp_inventory_adjustment_line.entity.ts # Entity Dòng chi tiết điều chỉnh
├── dto/
│   ├── create-inventory-adjustment.dto.ts      # DTO tạo phiếu kiểm kê
│   ├── create-inventory-adjustment-line.dto.ts # DTO dòng kiểm kê
│   ├── update-inventory-adjustment.dto.ts      # DTO sửa phiếu nháp
│   └── post-inventory-adjustment.dto.ts        # DTO duyệt ghi sổ
├── inventory-adjustments-core.controller.ts    # Controller endpoints /api/v1/inventory-adjustments/*
├── inventory-adjustments-core.service.ts       # Service xử lý transaction hạch toán kho
└── inventory-adjustments-core.service.spec.ts  # Unit tests
```

### 3.2. Frontend (`erp-web`)
```text
src/
├── pages/inventory/
│   └── InventoryVouchersPage.tsx               # Màn hình Quản lý Chứng từ & Phiếu điều chỉnh
└── modules/inventory-adjustments/
    ├── api/inventoryAdjustmentsApi.ts          # Client API calls
    ├── components/
    │   ├── InventoryAdjustmentDrawer.tsx       # StandardFormDrawer tạo/sửa phiếu điều chỉnh
    │   └── InventoryAdjustmentDetailModal.tsx  # Modal xem chi tiết biên bản kiểm kê
    └── hooks/useInventoryAdjustmentList.ts     # Hook query danh sách phiếu
```

---

## 4. Danh sách API Endpoints & RBAC Contract

Base Controller: `/api/v1/inventory-adjustments`  
Guards: `JwtAuthGuard`, `CoreRbacGuard`

| Method | Endpoint | Quyền yêu cầu | Mô tả |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/inventory-adjustments` | `{ resource: 'inventory_adjustments', action: 'read' }` | Danh sách phiếu kiểm kê (phân trang, search, lọc theo status) |
| `GET` | `/api/v1/inventory-adjustments/next-no` | Không yêu cầu RBAC | Lấy mã phiếu tiếp theo tự động (`KK-YYYYMMxxxx`) |
| `GET` | `/api/v1/inventory-adjustments/:id` | `{ resource: 'inventory_adjustments', action: 'read' }` | Xem chi tiết phiếu kèm danh sách các dòng mặt hàng |
| `POST` | `/api/v1/inventory-adjustments` | `{ resource: 'inventory_adjustments', action: 'create' }` | Tạo mới phiếu kiểm kê nháp (`DRAFT`) |
| `PATCH` | `/api/v1/inventory-adjustments/:id` | `{ resource: 'inventory_adjustments', action: 'update' }` | Cập nhật thông tin và danh sách dòng của phiếu nháp |
| `POST` | `/api/v1/inventory-adjustments/:id/post` | `{ resource: 'inventory_adjustments', action: 'update' }` | **Ghi sổ kho**: Cập nhật số dư `erp_inventory_balances` và sinh giao dịch kho |
| `POST` | `/api/v1/inventory-adjustments/:id/cancel` | `{ resource: 'inventory_adjustments', action: 'update' }` | **Hủy phiếu đã ghi sổ**: Đảo ngược giao dịch và hoàn trả số dư |
| `DELETE`| `/api/v1/inventory-adjustments/:id` | `{ resource: 'inventory_adjustments', action: 'delete' }` | Xóa mềm phiếu nháp (`isDeleted = true`) |

---

## 5. Logic Nghiệp vụ & Thuật toán Ghi Sổ Kho (`postAdjustment`)

Khi thực hiện ghi sổ phiếu điều chỉnh:
1. Mở Database Transaction.
2. Khóa bi quan bản ghi phiếu `erp_inventory_adjustments`.
3. Kiểm tra trạng thái: Phải là `DRAFT` (nếu khác $\to$ Báo lỗi `BadRequestException`).
4. Duyệt qua từng dòng `erp_inventory_adjustment_lines`:
   - Lấy thông tin mặt hàng và khóa bi quan dòng số dư trong `erp_inventory_balances`.
   - **Trường hợp `type_adjust = 'increase'`**:
     - $\text{qtyOnHand}_{\text{new}} = \text{qtyOnHand} + \text{qtyAdjusted}$.
     - Tính lại giá vốn bình quân gia quyền nếu dòng điều chỉnh có `unit_cost`.
     - Tạo bản ghi `erp_inventory_transactions` với `transaction_type = 'ADJUSTMENT_IN'`, `qty_in = qtyAdjusted`.
   - **Trường hợp `type_adjust = 'decrease'`**:
     - Kiểm tra nếu $\text{qtyOnHand} < \text{qtyAdjusted}$ $\to$ Báo lỗi không đủ tồn kho để giảm.
     - $\text{qtyOnHand}_{\text{new}} = \text{qtyOnHand} - \text{qtyAdjusted}$.
     - Tạo bản ghi `erp_inventory_transactions` với `transaction_type = 'ADJUSTMENT_OUT'`, `qty_out = qtyAdjusted`.
   - Cập nhật lại `inventoryValue` trong `erp_inventory_balances`.
5. Cập nhật trạng thái phiếu `status = 'POSTED'`.
6. Commit Transaction.

---

## 6. Tích hợp Liên Module

- **`erp-inventory-items`**: Lấy thông tin SKU, đơn vị tính và giá vốn tham chiếu.
- **`erp-inventory-stock`**: Cập nhật trực tiếp số lượng tồn thực tế `qtyOnHand` và giá trị tồn kho.
- **`erp-inventory-transactions`**: Sinh bản ghi nhật ký kiểm toán kho (`ADJUSTMENT_IN` / `ADJUSTMENT_OUT`).
- **`erp-inventory-vouchers`**: Hiển thị tổng hợp trong Trung tâm chứng từ kho.

---

## 7. Quy tắc Kiểm thử & Báo cáo Chất lượng (QC Mandate)

1. **TypeCheck**: Chạy `bun run check:ci` trong `erp-api/` và `erp-web/`.
2. **Unit Tests**: Chạy `bunx jest src/inventory-adjustments-core/services/inventory-adjustments-core.service.spec.ts --forceExit`.
