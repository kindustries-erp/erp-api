---
name: erp-inventory-stock
description: Module tri thức Sổ Tồn kho Thực tế & Định giá Tồn kho trong Liouni ERP. Chứa toàn bộ database schema (erp_inventory_balances), công thức tính tồn khả dụng, giá vốn bình quân gia quyền (avgUnitCost), khóa bi quan (pessimistic_write) chống race condition và xuất Excel tồn kho.
---

# 📦 Module Tri Thức: Sổ Tồn Kho & Định Giá Tồn Kho (`erp-inventory-stock`)

## 1. Tổng quan Nghiệp vụ

Phân hệ `erp-inventory-stock` (gồm `inventory-stock-core` và `erp_inventory_balances`) chịu trách nhiệm theo dõi chính xác số lượng tồn kho vật lý, số lượng giữ chỗ phục vụ kế hoạch sản xuất/bán hàng, giá vốn bình quân gia quyền và tổng giá trị tồn kho của từng SKU theo từng kho hàng (`warehouse_code`).

### 1.1. Các tính năng cốt lõi:
- **Theo dõi Số dư Tồn kho Đa chiều**:
  - `qtyOnHand`: Số lượng tồn kho vật lý thực tế có trong kho.
  - `qtyReserved`: Số lượng tồn kho đã được giữ chỗ (Reserved) cho các Lệnh sản xuất (`CONFIRMED`) hoặc Đơn bán hàng chờ giao.
  - `qtyAvailable`: Số lượng tồn kho khả dụng có thể xuất bán hoặc sử dụng ngay:
    $$\text{qtyAvailable} = \text{qtyOnHand} - \text{qtyReserved}$$
- **Định giá Tồn kho theo Giá vốn Bình quân Gia quyền (Moving Weighted Average Cost)**:
  - Tự động cập nhật lại `avgUnitCost` ngay khi có phiếu Nhập kho (`GOODS_RECEIPT`) hoặc Điều chỉnh tăng kho (`ADJUSTMENT_IN`).
  - Giá trị tồn kho danh nghĩa:
    $$\text{inventoryValue} = \text{qtyOnHand} \times \text{avgUnitCost}$$
- **Cơ chế Khóa Bi quan Chống Tranh chấp Dữ liệu (Pessimistic Concurrency Control)**:
  - Mọi thao tác xuất/nhập/giữ chỗ kho đều sử dụng `setLock('pessimistic_write')` trong Database Transaction, triệt tiêu hoàn toàn rủi ro Race Condition khi nhiều giao dịch chạy đồng thời.
- **Bộ lọc Cột Máy chủ & Tìm kiếm Đa tiêu chí (Server-side Filtering)**:
  - Endpoint `column-options` hỗ trợ lấy danh sách giá trị lọc duy nhất theo từng cột (SKU, Tên hàng, Loại hàng, Kho, Tình trạng tồn).
- **Xuất Báo cáo Tồn kho ra Excel (`exportExcel`)**:
  - Hỗ trợ xuất toàn bộ danh sách tồn kho theo bộ lọc hiện hành thành file `.xlsx` định dạng chuẩn kế toán.
- **Chuẩn hóa UI/UX Bảng Sổ Tồn Kho (`OperationalInventoryPage.tsx` & `stockColumns.tsx`)**:
  - Cột STT `#` cố định 40px ở đầu bảng, căn giữa tiêu chuẩn.
  - Làm mờ hàng trạng thái ngừng hoạt động/hủy (`INACTIVE`, `CANCELLED`, `VOID`).
  - Quick Actions chuẩn: "Xem chi tiết" (Icon `Eye`, view mode) và "Chỉnh sửa" (Icon `Pencil`, edit mode).

---

## 2. Database Schema & Quan hệ Dữ liệu

### 2.1. Bảng `erp_inventory_balances` (Sổ số dư tồn kho)

| Cột | Kiểu | Nullable | Mặc định | Ghi chú |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO | `gen_random_uuid()` | Khóa chính |
| `item_id` | `uuid` | YES | `NULL` | FK $\to$ `erp_inventory_items.id` (Mặt hàng) |
| `warehouse_code` | `varchar(100)` | YES | `NULL` | Mã kho lưu trữ (vd: `MAIN`, `KHO_XE`, `KHO_LINHKIEN`) |
| `qty_on_hand` | `numeric(18, 3)`| NO | `0` | Số lượng tồn kho vật lý thực tế |
| `qty_reserved` | `numeric(18, 3)`| NO | `0` | Số lượng tồn đang được giữ chỗ |
| `avg_unit_cost` | `numeric(18, 3)`| NO | `0` | Đơn giá vốn bình quân gia quyền |
| `inventory_value`| `numeric(18, 3)`| NO | `0` | Tổng giá trị tồn kho (`qtyOnHand * avgUnitCost`) |
| `updated_at` | `timestamptz` | NO | `now()` | Thời điểm cập nhật số dư gần nhất |

Index tối ưu:
- Unique Compound Index trên `(item_id, warehouse_code)` đảm bảo mỗi SKU chỉ có 1 dòng số dư duy nhất tại 1 kho.

---

## 3. Cấu trúc Source Code

### 3.1. Backend (`erp-api`)
```text
src/inventory-stock-core/
├── dto/
│   └── inventory-stock-query.dto.ts      # DTO phân trang, tìm kiếm, sort và filter tồn kho
├── inventory-stock-core.controller.ts    # Controller: GET /api/v1/inventory/stock, column-options, export/excel
├── inventory-stock-core.service.ts       # Service truy vấn tồn kho, tính toán và xuất file Excel
└── inventory-stock-core.module.ts        # Module NestJS đăng ký TypeORM entities
```

### 3.2. Frontend (`erp-web`)
```text
src/
├── pages/
│   └── inventory/
│       └── InventoryStockPage.tsx        # Màn hình Sổ Tồn Kho tổng hợp
└── modules/
    ├── operational/
    │   ├── components/InventoryListPage.tsx       # Component kết nối state, filter và action xuất file
    │   ├── components/list/OperationalInventoryPage.tsx # Bảng DataTable chuẩn hiển thị tồn thực tế, giữ chỗ, khả dụng
    │   └── hooks/useOperationalListQuery.ts       # Hook query danh sách tồn kho
    └── inventory-core/components/
        └── InventoryStockLedgerSection.tsx        # Drawer hiển thị chi tiết số dư & lịch sử giao dịch SKU
```

---

## 4. Danh sách API Endpoints & RBAC Contract

Controller Base Route: `/api/v1/inventory/stock`  
Guards: `JwtAuthGuard`, `CoreRbacGuard`

| Method | Endpoint | Quyền yêu cầu | Mô tả |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/inventory/stock` | `{ resource: 'inventory_items', action: 'read' }` | Lấy danh sách số dư tồn kho (phân trang, search, lọc theo kho/loại hàng, sort) |
| `GET` | `/api/v1/inventory/stock/column-options` | `{ resource: 'inventory_items', action: 'read' }` | Lấy danh sách options distinct cho bộ lọc header từng cột |
| `GET` | `/api/v1/inventory/stock/export/excel` | `{ resource: 'inventory_items', action: 'read' }` | Xuất bảng kê tồn kho ra file Excel `.xlsx` |

---

## 5. Logic Nghiệp vụ & Thuật toán Trọng tâm

### 5.1. Công thức Tính Giá Vốn Bình Quân Gia Quyền khi Nhập kho
Khi nhập thêm số lượng $\text{qtyIn}$ với đơn giá nhập $\text{unitCost}_{\text{receipt}}$:

$$\text{avgUnitCost}_{\text{new}} = \frac{(\text{qtyOnHand}_{\text{current}} \times \text{avgUnitCost}_{\text{current}}) + (\text{qtyIn} \times \text{unitCost}_{\text{receipt}})}{\text{qtyOnHand}_{\text{current}} + \text{qtyIn}}$$

Nếu $\text{qtyOnHand}_{\text{current}} \le 0$ thì $\text{avgUnitCost}_{\text{new}} = \text{unitCost}_{\text{receipt}}$.

### 5.2. Luồng Xuất Kho & Giảm Trừ Tồn Kho
Khi xuất kho số lượng $\text{qtyOut}$:
1. Khóa bi quan dòng balance: `SELECT * FROM erp_inventory_balances WHERE item_id = $1 FOR UPDATE`.
2. Kiểm tra tồn khả dụng: nếu $\text{qtyOnHand} < \text{qtyOut}$ $\to$ Báo lỗi `BadRequestException('Tồn kho không đủ để xuất')`.
3. Giảm trừ:
   $$\text{qtyOnHand}_{\text{new}} = \text{qtyOnHand} - \text{qtyOut}$$
4. Nếu xuất theo diện giải phóng giữ chỗ (vd: Xuất NVL cho Lệnh sản xuất):
   $$\text{qtyReserved}_{\text{new}} = \max(0, \text{qtyReserved} - \text{qtyOut})$$
5. Cập nhật lại $\text{inventoryValue} = \text{qtyOnHand}_{\text{new}} \times \text{avgUnitCost}$.
6. Ghi bản ghi đối ứng vào `erp_inventory_transactions`.

### 5.3. Multi-Keyword Search & Header Filter Engine
1. **Multi-Keyword Search (`applyMultiKeywordFilter`)**:
   - Sử dụng helper chuẩn `applyMultiKeywordFilter` phân tách từ khóa qua dấu chấm phẩy `;` (điều kiện `OR`).
   - Khớp chính xác tuyệt đối khi từ khóa nằm trong cặp ngoặc kép `""` (`isExact`).
   - Hỗ trợ toàn diện cho tất cả các cột trong `findAll` (`searches`): `item_code`, `item_name`, `item_type`, `status`, `unit`, `on_hand_qty`, `reserved_qty`, `received_qty`, `issued_qty`, `adjusted_qty`, `last`.
2. **Xử lý Bộ lọc Cột Đặc biệt**:
   - `__ALL_MATCHING__`: Khi người dùng chọn tất cả kết quả tìm kiếm trong popover, backend tự động áp dụng điều kiện multi-keyword search tương ứng.
   - `__BLANK__`: Hỗ trợ lọc các dòng có giá trị NULL hoặc chuỗi rỗng.
3. **Đồng bộ Dropdown Options (`getColumnOptions`)**:
   - Tìm kiếm options hỗ trợ multi-keyword search động với SQL parameter binding an toàn.

---

## 6. Tích hợp Liên Module

- **`goods-receipts-core`**: Tự động tăng `qtyOnHand` và cập nhật `avgUnitCost` khi hoàn tất phiếu nhập kho.
- **`goods-issues-core`**: Tự động giảm `qtyOnHand` khi xuất kho bán hàng, xuất bảo hành hoặc xuất nội bộ.
- **`production-core`**: Tăng `qtyReserved` khi duyệt lệnh sản xuất và giảm trừ cả `qtyOnHand` + `qtyReserved` khi xuất NVL ra chuyền.
- **`inventory-adjustments-core`**: Cân bằng số dư `qtyOnHand` khi duyệt phiếu kiểm kê điều chỉnh.

---

## 7. Quy tắc Kiểm thử & Báo cáo Chất lượng (QC Mandate)

1. **TypeCheck**: Chạy `bun run check:ci` trong `erp-api/` và `erp-web/`.
2. **Kiểm tra Race Condition**: Mọi nghiệp vụ thay đổi tồn kho bắt buộc phải nằm trong TypeORM `transaction` và có `pessimistic_write`.
