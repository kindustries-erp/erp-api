---
name: inventory-dashboard
description: Module tri thức Dashboard Phân tích & Báo cáo Tồn kho Tổng quan trong Liouni ERP. Chứa toàn bộ database schema, API endpoints, DTOs, logic tính toán KPI, cảnh báo định mức BOM 5 xe, tỷ trọng danh mục, Top 20 mặt hàng và phân tích luân chuyển dòng xe (Vehicle BOM Stats & Trend).
---

# 📦 Module Tri Thức: Dashboard Phân Tích Tồn Kho (`inventory-dashboard`)

## 1. Tổng quan Nghiệp vụ

Module `inventory-dashboard` cung cấp màn hình điều hành trung tâm và báo cáo phân tích toàn diện về hoạt động lưu kho, biến động giá trị tồn kho, luân chuyển vật tư và định mức linh kiện sản xuất trong toàn bộ hệ thống Liouni ERP.

### 1.1. Các tính năng cốt lõi:
- **KPI Tổng quan Kho**:
  - `totalSkus`: Tổng số lượng mã SKU đang hoạt động trong hệ thống.
  - `totalStockValue`: Tổng giá trị tồn kho tính bằng $\sum (\text{qtyOnHand} \times \text{avgUnitCost})$.
  - `totalReceiptsCount`: Tổng số lượng chứng từ phiếu nhập kho phát sinh trong kỳ.
  - `totalIssuesCount`: Tổng số lượng chứng từ phiếu xuất kho phát sinh trong kỳ.
  - `lowStockCount`: Số lượng mặt hàng đang có tồn kho dưới ngưỡng an toàn (Low Stock).
  - `zeroStockCount`: Số lượng mặt hàng đã cạn tồn kho (Out of Stock / Zero Stock).
- **Phân bổ Tỷ trọng Hàng hóa (`typeBreakdown`)**:
  - Thống kê số lượng và tổng giá trị tồn kho theo từng Loại mặt hàng (`erp_item_types`).
  - Tính tỷ lệ phần trăm cơ cấu danh mục phục vụ biểu đồ Donut Chart.
- **Top Mặt hàng Trọng yếu**:
  - `topStockItems`: Top 20 mặt hàng có giá trị vốn tồn kho cao nhất.
  - `topIssuedItems`: Top 20 mặt hàng có tần suất và số lượng xuất kho nhiều nhất trong kỳ lọc.
- **Bộ Cảnh báo Rủi ro Tồn kho (`alertItems`)**:
  - `zero_stock`: Mặt hàng có số lượng tồn $\le 0$.
  - `low_stock`: Mặt hàng có số lượng tồn $< \text{ngưỡng an toàn}$ (định mức 5 xe từ BOM hoặc mặc định 5 đơn vị).
  - `slow_moving`: Mặt hàng tồn lâu, không phát sinh xuất kho trong vòng $\ge 90$ ngày qua.
- **Biểu đồ Xu hướng Nhập / Xuất (`stockTrend`)**:
  - Tự động gom nhóm theo Ngày (`dd/MM`) nếu khoảng thời gian $\le 30$ ngày, hoặc gom nhóm theo Tháng (`T{M}/{YY}`) nếu xem dài hạn.
  - Thống kê song song số lượng và giá trị vốn Nhập kho vs Xuất kho.
- **Phân tích Luân chuyển Dòng xe theo BOM (`vehicleBomStats` & `vehicleTrend`)**:
  - Truy xuất các Serial xe thành phẩm từ lệnh sản xuất liên kết với Định mức BOM (`erp_boms`).
  - Thống kê số xe sản xuất nhập kho (`receivedInPeriod`), xe đã bán giao khách (`issuedInPeriod`, `status = 'SOLD'`), và số xe còn tồn tại kho (`currentStock`, `status = 'IN_STOCK'`).

---

## 2. Database Schema & Quan hệ Dữ liệu

Module `inventory-dashboard` tổng hợp dữ liệu từ các bảng sau:

### 2.1. Sơ đồ Quan hệ Bảng (Data Relations)

```text
erp_inventory_items (Danh mục SKU)
  ├── 1:N ── erp_inventory_balances (Số dư & Giá vốn bình quân)
  ├── N:1 ── erp_item_types (Loại mặt hàng)
  └── 1:N ── erp_inventory_transactions (Lịch sử giao dịch nhập/xuất)

erp_production_orders (Lệnh sản xuất)
  ├── N:1 ── erp_boms (Định mức BOM xe)
  └── 1:N ── erp_inventory_tracking_serials (Định danh Serial/VIN xe)
```

### 2.2. Chi tiết các Bảng tham gia Dashboard:

| Tên Bảng | Vai trò trong Dashboard | Các cột truy vấn trọng tâm |
| :--- | :--- | :--- |
| `erp_inventory_items` | Master data mặt hàng | `id`, `sku`, `item_name`, `item_type_id`, `is_deleted` |
| `erp_inventory_balances` | Số dư vật lý & Giá vốn | `item_id`, `warehouse_code`, `qty_on_hand`, `avg_unit_cost` |
| `erp_item_types` | Phân nhóm loại hàng | `id`, `name`, `code` |
| `erp_inventory_transactions` | Lịch sử xuất/nhập/tồn | `transaction_type` (`RECEIPT`/`ISSUE`), `qty_in`, `qty_out`, `unit_cost`, `transaction_date`, `document_id` |
| `erp_boms` & `erp_bom_lines` | Tính ngưỡng an toàn linh kiện | `id`, `bom_name`, `component_item_id`, `qty_required` |
| `erp_inventory_tracking_serials` | Thống kê số lượng xe | `id`, `status` (`IN_STOCK`/`SOLD`), `production_order_id`, `created_at`, `updated_at` |
| `erp_production_orders` | Liên kết xe với BOM | `id`, `output_metadata->>'bomId'` |

---

## 3. Cấu trúc Source Code

### 3.1. Backend (`erp-api`)
```text
src/inventory-core/
├── dto/
│   └── inventory-dashboard-query.dto.ts   # DTO nhận filter: startDate, endDate, itemTypeId, warehouseCode
├── services/
│   └── inventory-dashboard.service.ts     # Service tổng hợp query dữ liệu, thống kê và tính toán
├── inventory-core.controller.ts           # Controller endpoint GET /api/v1/inventory/dashboard
└── inventory-core.module.ts               # Khai báo provider InventoryDashboardService
```

### 3.2. Frontend (`erp-web`)
```text
src/
├── pages/
│   ├── InventoryDashboard.tsx             # Màn hình Dashboard chính tích hợp FilterPanel & Drawer cảnh báo
│   └── components/
│       └── InventoryKpiCard.tsx           # Component hiển thị thẻ chỉ số KPI
└── modules/inventory-core/api/
    └── inventoryDashboardApi.ts           # Axios client interface & function getDashboardStats
```

---

## 4. Danh sách API Endpoints & RBAC Contract

Base Controller: `src/inventory-core/inventory-core.controller.ts`  
Guards: `JwtAuthGuard`, `CoreRbacGuard`

| Method | Endpoint | Quyền yêu cầu | Mô tả |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/inventory/dashboard` | `{ resource: 'inventory_items', action: 'read' }` | Lấy toàn bộ số liệu thống kê KPI, xu hướng, tỷ trọng, cảnh báo và phân tích dòng xe |

### Query Parameters (`InventoryDashboardQueryDto`):
- `startDate` *(string, optional, format YYYY-MM-DD)*: Ngày bắt đầu kỳ lọc.
- `endDate` *(string, optional, format YYYY-MM-DD)*: Ngày kết thúc kỳ lọc (tự động set 23:59:59.999).
- `itemTypeId` *(uuid, optional)*: Lọc theo loại mặt hàng cụ thể.
- `warehouseCode` *(string, optional)*: Lọc theo mã kho (vd: `MAIN`).

---

## 5. Logic Nghiệp vụ & Thuật toán Trọng tâm

### 5.1. Thuật toán Tính Ngưỡng Cảnh báo Tồn thấp (`lowStockThresholdMap`)
1. Dashboard tự động tìm BOM của dòng xe chủ lực (tìm BOM có tên chứa `"xe đen"`, mã `"den"` hoặc `"black"`).
2. Lấy toàn bộ linh kiện cấu thành từ `erp_bom_lines`.
3. Thiết lập ngưỡng an toàn tối thiểu cho mỗi linh kiện tương đương lượng vật tư đủ để lắp ráp **5 xe hoàn chỉnh**:
   $$\text{Threshold}_{\text{component}} = \text{qtyRequired} \times 5$$
4. Đối với các mặt hàng ngoài BOM xe đen, ngưỡng mặc định là `5`.

### 5.2. Phân loại Cảnh báo Tồn kho (`alertItems`)
- **Hết hàng (`zero_stock`)**: $\text{qtyOnHand} \le 0$.
- **Tồn thấp (`low_stock`)**: $0 < \text{qtyOnHand} < \text{Threshold}$.
- **Chậm luân chuyển (`slow_moving`)**: $\text{qtyOnHand} \ge \text{Threshold}$ nhưng $\text{lastIssueDate}$ không có hoặc $> 90$ ngày trước.

### 5.3. Gom nhóm Xu hướng Theo Kỳ (`stockTrend` & `vehicleTrend`)
- Nếu khoảng thời gian lọc $\le 30$ ngày: Gom nhóm theo ngày `${dt.getDate()}/${dt.getMonth() + 1}`.
- Nếu khoảng thời gian lọc $> 30$ ngày hoặc không chọn ngày: Gom nhóm theo tháng `T${dt.getMonth() + 1}/${dt.getFullYear()}`.
- Tính toán riêng biệt tổng lượng Nhập (`qty_in`) và tổng lượng Xuất (`qty_out`).

---

## 6. Tích hợp Liên Module

- **`bom-core`**: Cung cấp định mức linh kiện sản xuất để xác định ngưỡng an toàn 5 xe.
- **`production-core`**: Cung cấp dữ liệu Lệnh sản xuất (`erp_production_orders`) để gắn kết xe thành phẩm với BOM.
- **`erp-inventory-items` & `erp-inventory-stock`**: Cung cấp danh mục SKU, số dư vật lý và giá vốn bình quân.
- **`erp-inventory-transactions`**: Cung cấp dòng giao dịch lịch sử để phân tích xu hướng nhập/xuất.

---

## 7. Quy tắc Kiểm thử & Báo cáo Chất lượng (QC Mandate)

1. **TypeCheck**: Chạy `bun run check:ci` trong `erp-api/` và `erp-web/`.
2. **Kiểm tra Truy vấn Postgres**: Đảm bảo câu lệnh SQL tổng hợp không bị N+1 query và có index tối ưu trên `erp_inventory_transactions(transaction_date)` và `erp_inventory_tracking_serials(status)`.
