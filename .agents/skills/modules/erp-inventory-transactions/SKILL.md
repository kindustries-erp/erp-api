---
name: erp-inventory-transactions
description: Module tri thức Sổ Nhật ký Giao dịch Kho & Sổ cái Phẳng (Inventory Flat Ledger) trong Liouni ERP. Chứa toàn bộ database schema (erp_inventory_transactions), phân loại giao dịch (RECEIPT, ISSUE, ADJUSTMENT), liên kết chứng từ gốc và nguyên tắc sổ cái bất biến (Immutable Audit Log).
---

# 📦 Module Tri Thức: Sổ Nhật Ký Giao Dịch Kho (`erp-inventory-transactions`)

## 1. Tổng quan Nghiệp vụ

Phân hệ `erp-inventory-transactions` là **Sổ Cái Nhật Ký Giao Dịch Kho Bất Biến (Immutable Inventory Ledger)** của Liouni ERP. Mọi biến động tăng hoặc giảm số lượng, giá trị vốn tồn kho từ bất kỳ nguồn chứng từ nào (Mua hàng, Bán hàng, Sản xuất, Kiểm kê, Nhập số dư đầu kỳ) đều bắt buộc phải được ghi sổ thành các bản ghi giao dịch tại bảng `erp_inventory_transactions`.

### 1.1. Các tính năng cốt lõi:
- **Sổ cái Bất biến (Immutable Audit Trail)**:
  - Các bản ghi giao dịch kho sau khi tạo **không bao giờ bị chỉnh sửa (UPDATE) hay xóa vật lý (DELETE)**.
  - Trường hợp hủy chứng từ hoặc điều chỉnh sai sót, hệ thống bắt buộc sinh giao dịch bù trừ/đảo ngược (Reversal / Adjustment Transaction).
- **Phân loại Loại Giao Dịch (`transaction_type`)**:
  - `RECEIPT`: Nhập kho (tăng số lượng $\text{qtyIn}$, cập nhật giá vốn).
  - `ISSUE`: Xuất kho (giảm số lượng $\text{qtyOut}$).
  - `ADJUSTMENT_IN`: Điều chỉnh tăng tồn kho sau kiểm kê.
  - `ADJUSTMENT_OUT`: Điều chỉnh giảm tồn kho sau kiểm kê.
  - `TRANSFER`: Điều chuyển hàng hóa giữa các kho nội bộ.
- **Liên kết Chứng từ Nguồn (`document_type` & `document_id`)**:
  - `GOODS_RECEIPT`: Phiếu nhập kho từ nhà cung cấp hoặc xưởng sản xuất (`erp_goods_receipts`).
  - `GOODS_ISSUE`: Phiếu xuất kho bán hàng, xuất NVL sản xuất hoặc xuất bảo hành (`erp_goods_issues`).
  - `INVENTORY_ADJUSTMENT`: Phiếu kiểm kê điều chỉnh kho (`erp_inventory_adjustments`).
  - `PRODUCTION_ORDER`: Lệnh sản xuất lắp ráp (`erp_production_orders`).
  - `OPENING_BALANCE`: Ghi nhận số dư tồn kho ban đầu khi triển khai hệ thống.
- **Sổ Cái Phẳng Tra Cứu Đa Chiều (Inventory Flat Ledger Table)**:
  - Cung cấp giao diện bảng phẳng trực quan hiển thị biến động tồn kho chi tiết theo dòng thời gian, hỗ trợ lọc theo SKU, Kho, Loại giao dịch, Khoảng ngày và Chứng từ gốc.

---

## 2. Database Schema & Quan hệ Dữ liệu

### 2.1. Bảng `erp_inventory_transactions` (Sổ Nhật Ký Giao Dịch Kho)

| Cột | Kiểu | Nullable | Mặc định | Ghi chú |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO | `gen_random_uuid()` | Khóa chính (Primary Key) |
| `transaction_type` | `varchar(50)` | NO | | Loại giao dịch: `RECEIPT`, `ISSUE`, `ADJUSTMENT_IN`, `ADJUSTMENT_OUT`, `TRANSFER` |
| `document_type` | `varchar(100)`| YES | `NULL` | Loại chứng từ: `GOODS_RECEIPT`, `GOODS_ISSUE`, `INVENTORY_ADJUSTMENT`, `PRODUCTION_ORDER` |
| `document_id` | `uuid` | YES | `NULL` | FK tham chiếu tới ID của chứng từ gốc |
| `item_id` | `uuid` | YES | `NULL` | FK $\to$ `erp_inventory_items.id` (Mặt hàng) |
| `warehouse_code` | `varchar(100)`| YES | `NULL` | Mã kho phát sinh giao dịch (vd: `MAIN`) |
| `qty_in` | `numeric(18, 3)`| NO | `0` | Số lượng nhập kho |
| `qty_out` | `numeric(18, 3)`| NO | `0` | Số lượng xuất kho |
| `unit_cost` | `numeric(18, 3)`| YES | `NULL` | Đơn giá vốn tại thời điểm phát sinh giao dịch |
| `transaction_date`| `timestamptz` | NO | | Ngày ghi sổ chứng từ nghiệp vụ |
| `notes` | `text` | YES | `NULL` | Diễn giải nội dung giao dịch |
| `created_by` | `uuid` | YES | `NULL` | FK $\to$ `users.id` (Người thực hiện) |
| `created_at` | `timestamptz` | NO | `now()` | Thời điểm tạo bản ghi hệ thống |

Index tối ưu:
- Index `(item_id, transaction_date DESC)` phục vụ trích xuất lịch sử biến động mặt hàng (`getMovements`).
- Index `(transaction_type, transaction_date)` phục vụ Dashboard và báo cáo nhập xuất tồn.

---

## 3. Cấu trúc Source Code

### 3.1. Backend (`erp-api`)
```text
src/inventory-core/
├── entities/
│   └── erp_inventory_transaction.entity.ts # Entity TypeORM Sổ Nhật Ký Giao Dịch
├── services/
│   ├── inventory-items-lifecycle.service.ts # Ghi log giao dịch khi tạo/điều chỉnh mặt hàng
│   ├── inventory-warehouse-voucher.service.ts # Truy vấn lịch sử giao dịch và chứng từ
│   └── inventory-dashboard.service.ts      # Tổng hợp xu hướng Nhập/Xuất từ giao dịch
└── inventory-core.controller.ts            # Endpoint GET /api/v1/inventory/items/:id/movements
```

### 3.2. Frontend (`erp-web`)
```text
src/modules/inventory-core/components/
├── InventoryFlatLedgerTable.tsx             # Component bảng kê Sổ cái phẳng Nhật ký giao dịch kho
├── InventoryStockLedgerSection.tsx         # Section hiển thị lịch sử giao dịch trong Item Drawer
└── VoucherDetailTable.tsx                  # Bảng hiển thị chi tiết dòng chứng từ kho
```

---

## 4. Danh sách API Endpoints & RBAC Contract

Guards: `JwtAuthGuard`, `CoreRbacGuard`

| Method | Endpoint | Quyền yêu cầu | Mô tả |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/inventory/items/:id/movements` | `{ resource: 'inventory_items', action: 'read' }` | Lấy toàn bộ dòng giao dịch kho của 1 SKU theo thứ tự thời gian |
| `GET` | `/api/v1/inventory/dashboard` | `{ resource: 'inventory_items', action: 'read' }` | Tổng hợp báo cáo Nhập/Xuất từ bảng giao dịch theo chu kỳ |

---

## 5. Logic Ghi Sổ & Nguyên Tắc Toàn Vẹn

1. **Giao dịch Nhập kho (`RECEIPT`)**:
   - `qty_in > 0`, `qty_out = 0`.
   - `unit_cost` ghi nhận đơn giá nhập thực tế từ đơn mua hoặc giá thành sản xuất.
   - Luôn đi kèm bước cập nhật tăng `qtyOnHand` và tính lại `avgUnitCost` trong `erp_inventory_balances`.
2. **Giao dịch Xuất kho (`ISSUE`)**:
   - `qty_in = 0`, `qty_out > 0`.
   - `unit_cost` ghi nhận đơn giá vốn bình quân gia quyền tại thời điểm xuất kho.
   - Luôn đi kèm bước trừ `qtyOnHand` trong `erp_inventory_balances`.
3. **Giao dịch Điều chỉnh Kiểm kê (`ADJUSTMENT_IN` / `ADJUSTMENT_OUT`)**:
   - Ghi nhận chênh lệch thừa/thiếu giữa số lượng thực tế kiểm kê và số lượng sổ sách.

---

## 6. Tích hợp Liên Module

- **`goods-receipts-core`**: Tự động ghi bản ghi `RECEIPT` khi duyệt phiếu nhập.
- **`goods-issues-core`**: Tự động ghi bản ghi `ISSUE` khi duyệt phiếu xuất.
- **`production-core`**: Tự động ghi bản ghi `ISSUE` NVL và `RECEIPT` thành phẩm xe.
- **`inventory-adjustments-core`**: Tự động ghi bản ghi `ADJUSTMENT_IN` hoặc `ADJUSTMENT_OUT`.

---

## 7. Quy tắc Kiểm thử & Báo cáo Chất lượng (QC Mandate)

1. **TypeCheck**: Chạy `bun run check:ci` trong `erp-api/` và `erp-web/`.
2. **Kiểm tra Toàn vẹn Dữ liệu**: Tổng $\sum (\text{qtyIn} - \text{qtyOut})$ của một mặt hàng trên bảng `erp_inventory_transactions` phải luôn khớp với giá trị `qtyOnHand` trong bảng `erp_inventory_balances`.
