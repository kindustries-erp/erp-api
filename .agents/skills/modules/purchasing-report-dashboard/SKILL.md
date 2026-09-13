---
name: purchasing-report-dashboard
description: Module tri thức Dashboard & Báo cáo Mua hàng trong erp-api (reports-core). Chứa toàn bộ database schema, API endpoints báo cáo tổng quan KPI mua hàng, tỷ lệ hoàn tất nhập kho, phân bổ trạng thái đơn PO, xu hướng số lượng theo tháng và Top 10 nhà cung cấp.
---

# 📊 Module Tri Thức: Dashboard & Báo Cáo Mua Hàng - Backend (`erp-api`)

## 1. Tổng quan Nghiệp vụ

Phân hệ Báo cáo & Dashboard Mua hàng (thuộc module `reports-core` kết hợp cùng `purchase-orders-core` và `business-partners-core`) cung cấp các công cụ phân tích và theo dõi tổng thể hoạt động mua sắm, cung ứng vật tư hàng hóa của doanh nghiệp.

Các nghiệp vụ trọng tâm:
- **Chỉ số KPI Mua hàng Tổng quan**:
  - **Tổng số đơn hàng (`totalOrders`)**: Đếm số lượng đơn mua hàng phát sinh trong kỳ (`po.is_deleted = false`).
  - **Tổng số lượng đặt hàng (`totalQty`)**: Tổng số lượng vật tư / linh kiện đặt mua trên tất cả các dòng chi tiết đơn hàng (`qty_ordered`).
  - **Tỷ lệ hoàn tất nhập kho (`completionRate`)**: Tỷ lệ phần trăm giữa tổng số lượng thực tế đã nhập kho (`qty_received`) so với tổng số lượng đã đặt hàng (`qty_ordered`).
- **Phân bổ theo trạng thái đơn hàng (`statusBreakdown`)**: Thống kê số lượng đơn theo các trạng thái vòng đời PO (`DRAFT`, `APPROVED`, `CONFIRMED`, `PARTIAL_RECEIVED`, `RECEIVED`, `COMPLETED`, `CANCELLED`).
- **Xu hướng Mua hàng theo Thời gian (`trend`)**: Thống kê chuỗi thời gian số lượng đặt mua theo từng tháng (`DATE_TRUNC('month', po.order_date)`).
- **Top 10 Nhà Cung Cấp Trọng Yếu (`topSuppliers`)**: Phân tích danh sách 10 nhà cung cấp có sản lượng đặt hàng (`qty`) và số lượng đơn hàng (`orders`) lớn nhất trong khoảng thời gian phân tích.

---

## 2. Database Schema & Quan hệ Dữ liệu

Dữ liệu báo cáo được tính toán tổng hợp trực tiếp từ các bảng lõi thông qua SQL Query tối ưu:

### Bảng `erp_purchase_orders` (Đơn Mua Hàng)
| Cột | Kiểu dữ liệu | Nullable | Mô tả / Ràng buộc |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO | Khóa chính (PK) |
| `po_no` | `varchar(255)` | NO | Mã đơn mua hàng (Unique index, ví dụ: `PO-202602-001`) |
| `supplier_id` | `uuid` | YES | FK tham chiếu đến `erp_business_partners.id` |
| `order_date` | `timestamptz` | NO | Ngày đặt mua hàng (Trường lọc thời gian chính) |
| `expected_date` | `timestamptz` | YES | Ngày dự kiến giao hàng |
| `status` | `varchar(255)` | NO | Trạng thái đơn mua (Default: `'ACTIVE'` / `'DRAFT'`) |
| `payment_status` | `varchar(255)` | NO | Trạng thái thanh toán (Default: `'UNPAID'`) |
| `is_deleted` | `boolean` | NO | Cờ xóa mềm (Default: `false`) |

### Bảng `erp_purchase_order_lines` (Dòng Chi Tiết Đơn Mua Hàng)
| Cột | Kiểu dữ liệu | Nullable | Mô tả / Ràng buộc |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO | Khóa chính (PK) |
| `purchase_order_id` | `uuid` | NO | FK tham chiếu `erp_purchase_orders.id` |
| `line_no` | `int` | NO | Số thứ tự dòng trong đơn |
| `item_id` | `uuid` | YES | FK tham chiếu `erp_inventory_items.id` |
| `item_code` | `varchar(128)` | YES | Mã vật tư snapshot |
| `item_name` | `varchar(255)` | YES | Tên vật tư snapshot |
| `qty_ordered` | `numeric(18,3)` | NO | Số lượng đặt mua |
| `qty_received` | `numeric(18,3)` | NO | Số lượng đã nhập kho thực tế (Default: `0`) |
| `unit_price` | `numeric(18,3)` | YES | Đơn giá mua chưa VAT |
| `amount` | `numeric(18,3)` | YES | Thành tiền dòng mua |

### Bảng `erp_business_partners` (Nhà Cung Cấp)
| Cột | Kiểu dữ liệu | Nullable | Mô tả |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO | Khóa chính (PK) |
| `code` | `varchar(255)` | NO | Mã nhà cung cấp / đối tác |
| `name` | `varchar(255)` | NO | Tên công ty / nhà cung cấp |
| `display_name` | `varchar(255)` | YES | Tên hiển thị giao diện |

---

## 3. Cấu trúc Source Code Backend

```text
src/reports-core/
├── reports-core.controller.ts     # Controller khai báo route GET /api/v1/reports/purchasing-dashboard
├── reports-core.service.ts        # Service thực thi query SQL tổng hợp KPI, trend & top suppliers
├── reports-core.service.spec.ts   # Unit test cho logic getPurchasingDashboard
├── reports-core.controller.spec.ts# Unit test cho controller delegation
└── reports-core.module.ts         # NestJS Module đăng ký service và export
```

---

## 4. Danh sách API Endpoints & RBAC Contract

Controller Base Route: `/api/v1/reports`  
Guards: `@UseGuards(JwtAuthGuard, CoreRbacGuard)`

| Method | Endpoint | Query Parameters | RBAC Permission | Mô tả |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/reports/purchasing-dashboard` | `dateFrom` (`YYYY-MM-DD`), `dateTo` (`YYYY-MM-DD`) | `resource: 'purchasing_reports'`, `action: 'read'` | Trả về bộ số liệu thống kê KPI, biểu đồ phân bổ trạng thái, biểu đồ xu hướng số lượng và Top 10 nhà cung cấp |

### Cấu trúc Response Contract:
```typescript
interface PurchasingDashboardResponse {
  dateFrom: string | null;
  dateTo: string | null;
  kpi: {
    totalOrders: number;      // Tổng số đơn mua hàng trong kỳ
    totalQty: number;         // Tổng số lượng đặt mua
    completionRate: number;   // Tỷ lệ % hoàn tất nhập kho (0.00 - 100.00)
  };
  statusBreakdown: Array<{
    status: string;           // Trạng thái đơn (vd: APPROVED, RECEIVED, DRAFT)
    count: number;            // Số lượng đơn tương ứng
  }>;
  trend: Array<{
    month: string;            // Định dạng 'YYYY-MM'
    qty: number;              // Số lượng đặt mua trong tháng
  }>;
  topSuppliers: Array<{
    supplierId: string | null;
    supplierName: string;
    orders: number;           // Số lượng đơn mua từ NCC này
    qty: number;              // Tổng số lượng linh kiện đặt từ NCC này
  }>;
}
```

---

## 5. Logic Nghiệp vụ Trọng tâm

### 5.1. Bộ lọc Thời gian (`buildDateFilter`)
- Áp dụng trên trường `po.order_date`.
- Khi có `dateFrom`: `po.order_date >= $1::timestamptz`.
- Khi có `dateTo`: `po.order_date <= ($2::date + interval '1 day')::timestamptz`.
- Luôn kèm điều kiện xóa mềm: `po.is_deleted = false`.

### 5.2. Tính toán Chỉ số KPI & Completion Rate
- Gom nhóm `erp_purchase_order_lines` theo `purchase_order_id` để lấy tổng `qty_ordered` và `qty_received`.
- Công thức hoàn tất:
  $$\text{Completion Rate} = \text{ROUND}\left(\frac{\sum \text{qty\_received} \times 100}{\sum \text{qty\_ordered}}, 2\right)$$
- Trường hợp $\sum \text{qty\_ordered} = 0$, trả về `0`.

### 5.3. Xử lý Dữ liệu Song Song
- Sử dụng `Promise.all` để chạy đồng thời 4 truy vấn SQL (`kpiSql`, `statusSql`, `trendSql`, `topSuppliersSql`), giảm thiểu độ trễ phản hồi API xuống dưới 50ms.

---

## 6. Tích hợp Liên Module

- **`purchase-orders-core`**: Là nguồn phát sinh dữ liệu mua hàng và chi tiết dòng sản phẩm.
- **`goods-receipts-core`**: Cập nhật tiến độ `qty_received` trên các dòng đơn mua hàng khi thực hiện nhập kho.
- **`business-partners-core`**: Cung cấp thông tin danh tính nhà cung cấp (`display_name`, `name`).
- **`dashboard-core`**: `DashboardCoreService` tích hợp `getPurchasingDashboard` để hiển thị widget tóm tắt trên Tổng quan Doanh nghiệp (Main ERP Dashboard).
- **`rbac-core`**: Cấu hình quyền tài nguyên `purchasing_reports` (Label: `'Purchasing Reports'`).

---

## 7. Quy tắc Kiểm thử & QC Mandate

Khi chỉnh sửa logic phân hệ báo cáo mua hàng:
1. **Type-check**: `bun run check:ci` (không được phát sinh bất kỳ lỗi Typescript nào).
2. **Unit test**:
   ```bash
   bunx jest src/reports-core/reports-core.service.spec.ts --forceExit
   bunx jest src/reports-core/reports-core.controller.spec.ts --forceExit
   ```
3. Kiểm tra tính chính xác của các phép tính tổng khi có đơn hàng chưa nhập kho, nhập kho 1 phần và nhập kho hoàn tất.
