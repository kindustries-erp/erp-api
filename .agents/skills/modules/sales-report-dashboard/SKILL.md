---
name: sales-report-dashboard
description: Module tri thức Dashboard & Báo cáo Bán hàng trong erp-api (reports-core). Chứa toàn bộ database schema, API endpoints báo cáo tổng quan KPI bán hàng, tỷ lệ hoàn tất giao hàng, phân bổ trạng thái đơn SO, xu hướng sản lượng theo tháng, Top 10 khách hàng và cơ cấu màu sắc xe.
---

# 📊 Module Tri Thức: Dashboard & Báo Cáo Bán Hàng - Backend (`erp-api`)

## 1. Tổng quan Nghiệp vụ

Phân hệ Báo cáo & Dashboard Bán hàng (thuộc module `reports-core` kết hợp cùng `sales-orders-core`, `business-partners-core` và `inventory-core`) cung cấp bảng điều khiển trực quan tổng thể về tình hình kinh doanh, tiến độ bàn giao đơn hàng và thị hiếu khách hàng của doanh nghiệp.

### 1.1. Các chỉ số & biểu đồ cốt lõi:
- **Chỉ số KPI Bán hàng Tổng quan (`kpi`)**:
  - **Tổng số đơn hàng (`totalOrders`)**: Đếm số lượng đơn bán hàng phát sinh trong kỳ lọc (`so.is_deleted = false`).
  - **Tổng số lượng đặt mua (`totalQty`)**: Tổng sản lượng (xe, linh kiện, phụ tùng) được đặt mua trên toàn bộ các dòng chi tiết đơn hàng (`qty_ordered`).
  - **Tỷ lệ hoàn tất giao hàng (`completionRate`)**: Tỷ lệ phần trăm giữa tổng số lượng thực tế đã xuất giao (`qty_delivered`) so với tổng số lượng đã đặt mua ($\text{completionRate} = \frac{\sum \text{qtyDelivered}}{\sum \text{qtyOrdered}} \times 100\%$).
- **Phân bổ theo trạng thái đơn hàng (`statusBreakdown`)**: Thống kê số lượng đơn theo các trạng thái vòng đời SO (`DRAFT`, `CONFIRMED`, `PARTIAL_RESERVED`, `RESERVED`, `PARTIAL_DELIVERING`, `DELIVERING`, `DELIVERED`, `CANCELLED`).
- **Xu hướng Bán hàng theo Thời gian (`trend`)**: Chuỗi thời gian tổng hợp số lượng bán theo từng tháng (`DATE_TRUNC('month', so.order_date::date)`).
- **Top 10 Khách Hàng / Đại Lý Trọng Yếu (`topCustomers`)**: Phân tích 10 khách hàng hoặc đại lý có sản lượng đặt mua (`qty`) và số lượng đơn hàng (`orders`) cao nhất trong kỳ.
- **Cơ cấu Phân bổ Màu sắc Xe (`colorBreakdown`)**: Thống kê số lượng xe bán ra theo từng mã màu (`its.attributes->>'color'`) được trích xuất từ dữ liệu tracking serials gắn với đơn hàng, kèm danh sách đại lý/khách hàng tương ứng.

---

## 2. Database Schema & Quan hệ Dữ liệu

Dữ liệu báo cáo được tính toán tổng hợp bằng câu truy vấn SQL tối ưu hóa kết hợp CTE (Common Table Expressions):

### 2.1. Bảng `erp_sales_orders` (Đơn Bán Hàng)
| Cột | Kiểu | Nullable | Mô tả / Ràng buộc |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO | Khóa chính (PK) |
| `so_no` | `varchar(255)` | NO | Mã đơn bán hàng (vd: `SO-202608-001`) |
| `customer_id` | `uuid` | YES | FK tham chiếu `erp_business_partners.id` |
| `order_date` | `date` | NO | Ngày phát sinh đơn bán (Trường lọc thời gian chính) |
| `status` | `varchar(255)` | NO | Trạng thái đơn bán |
| `is_deleted` | `boolean` | NO | Cờ xóa mềm (Default: `false`) |

### 2.2. Bảng `erp_sales_order_lines` (Dòng Chi Tiết Đơn Bán)
| Cột | Kiểu | Nullable | Mô tả / Ràng buộc |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO | Khóa chính (PK) |
| `sales_order_id` | `uuid` | NO | FK tham chiếu `erp_sales_orders.id` |
| `qty_ordered` | `numeric(18,3)` | NO | Số lượng đặt mua |
| `qty_delivered` | `numeric(18,3)` | NO | Số lượng đã giao thực tế |
| `unit_price` | `numeric(18,3)` | YES | Đơn giá bán |
| `amount` | `numeric(18,3)` | YES | Thành tiền dòng |

### 2.3. Bảng `erp_inventory_tracking_serials` (Tracking Định Danh Xe)
| Cột | Kiểu | Nullable | Mô tả / Ràng buộc |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO | Khóa chính (PK) |
| `sales_order_line_id`| `uuid` | YES | FK tham chiếu `erp_sales_order_lines.id` |
| `attributes` | `jsonb` | YES | Thuộc tính JSONB chứa màu sắc xe (`attributes->>'color'`) |

### 2.4. Bảng `erp_business_partners` (Khách Hàng / Đại Lý)
| Cột | Kiểu | Nullable | Mô tả |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO | Khóa chính (PK) |
| `code` | `varchar(255)` | NO | Mã khách hàng / đại lý |
| `name` | `varchar(255)` | NO | Tên đầy đủ công ty / khách hàng |
| `display_name` | `varchar(255)` | YES | Tên hiển thị rút gọn |

---

## 3. Cấu trúc Source Code Backend

```text
src/reports-core/
├── reports-core.controller.ts     # Khai báo endpoint GET /api/v1/reports/sales-dashboard
├── reports-core.service.ts        # Thực thi 5 khối query song song (KPI, Status, Trend, Top Customers, Color Breakdown)
├── reports-core.service.spec.ts   # Unit test cho logic getSalesDashboard
├── reports-core.controller.spec.ts# Unit test cho controller delegation
└── reports-core.module.ts         # Module NestJS đăng ký và export ReportsCoreService
```

---

## 4. Danh sách API Endpoints & RBAC Contract

Controller Base Route: `/api/v1/reports`  
Bảo vệ: `@UseGuards(JwtAuthGuard, CoreRbacGuard)`

| Method | Endpoint | Query Parameters | RBAC Permission | Mô tả |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/reports/sales-dashboard` | `dateFrom` (`YYYY-MM-DD`), `dateTo` (`YYYY-MM-DD`) | `resource: 'sales_reports'`, `action: 'read'` | Trả về trọn bộ số liệu dashboard bán hàng (KPIs, phân bổ trạng thái, biểu đồ xu hướng tháng, Top 10 khách hàng và phân tích màu xe) |

### Cấu trúc Response Contract:
```typescript
interface SalesDashboardResponse {
  dateFrom: string | null;
  dateTo: string | null;
  kpi: {
    totalOrders: number;      // Tổng số đơn bán trong kỳ
    totalQty: number;         // Tổng số lượng sản phẩm đặt mua
    completionRate: number;   // Tỷ lệ % hoàn tất giao hàng (0.00 - 100.00)
  };
  statusBreakdown: Array<{
    status: string;           // Trạng thái (vd: CONFIRMED, RESERVED, DELIVERED)
    count: number;            // Số lượng đơn
  }>;
  trend: Array<{
    month: string;            // Định dạng 'YYYY-MM'
    qty: number;              // Tổng số lượng đặt mua trong tháng
  }>;
  topCustomers: Array<{
    customerId: string;
    customerName: string;     // Tên khách hàng / đại lý (hoặc 'Khách lẻ')
    orders: number;           // Số lượng đơn hàng
    qty: number;              // Tổng sản lượng đặt mua
  }>;
  colorBreakdown: Array<{
    color: string;            // Tên/mã màu sắc xe
    qty: number;              // Số lượng xe
    customers: string;        // Danh sách khách hàng/đại lý mua màu này
  }>;
}
```

---

## 5. Logic Nghiệp vụ Trọng tâm

Service thực thi 5 khối truy vấn song song thông qua `Promise.all` để tối ưu thời gian phản hồi:

### 5.1. Query KPI & Completion Rate
```sql
WITH line_totals AS (
  SELECT
    sol.sales_order_id,
    SUM(COALESCE(sol.qty_ordered::numeric, 0)) AS total_qty_ordered,
    SUM(COALESCE(sol.qty_delivered::numeric, 0)) AS total_qty_delivered
  FROM erp_sales_order_lines sol
  GROUP BY sol.sales_order_id
)
SELECT
  COUNT(so.id)::int AS total_orders,
  COALESCE(SUM(lt.total_qty_ordered), 0)::numeric AS total_qty,
  CASE
    WHEN COALESCE(SUM(lt.total_qty_ordered), 0) = 0 THEN 0
    ELSE ROUND(COALESCE(SUM(lt.total_qty_delivered), 0) * 100.0 / NULLIF(SUM(lt.total_qty_ordered), 0), 2)
  END AS completion_rate
FROM erp_sales_orders so
LEFT JOIN line_totals lt ON lt.sales_order_id = so.id
WHERE so.is_deleted = false AND so.order_date >= $1 AND so.order_date <= $2;
```

### 5.2. Query Phân Bổ Màu Sắc Xe (`colorBreakdown`)
```sql
SELECT
  its.attributes->>'color' AS color,
  COUNT(its.id)::int AS qty,
  string_agg(DISTINCT COALESCE(bp.display_name, bp.name, 'Khách lẻ'), ', ') AS customers
FROM erp_inventory_tracking_serials its
JOIN erp_sales_order_lines sol ON sol.id = its.sales_order_line_id
JOIN erp_sales_orders so ON so.id = sol.sales_order_id
LEFT JOIN erp_business_partners bp ON bp.id = so.customer_id
WHERE so.is_deleted = false 
  AND its.attributes->>'color' IS NOT NULL 
  AND so.order_date >= $1 AND so.order_date <= $2
GROUP BY its.attributes->>'color'
ORDER BY qty DESC;
```

---

## 6. Tích hợp Liên Module

- **Frontend Web (`erp-web`)**:
  - Giao diện Dashboard được hiện thực tại `src/pages/SalesReportDashboardPage.tsx`.
  - Kết nối qua API client `reportsApi.getSalesDashboard` (`src/modules/reports/api/reportsApi.ts`).
  - Tích hợp bộ lọc thời gian toàn cục với `useFilterPanel`.
- **`sales-orders-core`**: Cung cấp dữ liệu nguồn gốc về đơn hàng và chi tiết mặt hàng.
- **`inventory-core`**: Cung cấp dữ liệu serial xe và thuộc tính tùy biến JSONB.
- **`business-partners-core`**: Cung cấp master data định danh khách hàng & đại lý.

---

## 7. Quy tắc Kiểm thử & Báo cáo Chất lượng

```bash
# 1. Chạy linter và type check
bun run check:ci

# 2. Chạy Unit Tests cho Reports Core
bunx jest src/reports-core/reports-core.service.spec.ts --forceExit
bunx jest src/reports-core/reports-core.controller.spec.ts --forceExit

# 3. Build kiểm tra runtime
bun run build
```
