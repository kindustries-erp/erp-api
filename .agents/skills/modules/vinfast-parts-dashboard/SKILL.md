---
name: vinfast-parts-dashboard
description: Module tri thức Báo cáo & Dashboard Phân tích Phụ tùng VinFast trong erp-api (reports-core). Chứa toàn bộ API endpoints báo cáo tổng quan KPI, biểu đồ xu hướng Mua/Bán theo chu kỳ (tháng/tuần), bảng kê phân tích lợi nhuận và xuất báo cáo nền.
---

# 📊 Module Tri Thức: Dashboard & Báo Cáo Phụ Tùng VinFast - Backend (`erp-api`)

## 1. Tổng quan Nghiệp vụ

Phân hệ Báo cáo & Dashboard Phụ tùng VinFast (thuộc module `reports-core`) cung cấp các công cụ phân tích tài chính và luân chuyển vật tư phụ tùng VinFast phục vụ lãnh đạo và ban quản lý xưởng dịch vụ.

Các nghiệp vụ trọng tâm:
- **Tính toán chỉ số KPI tổng quan**: Doanh thu bán phụ tùng, Giá vốn hàng bán (theo phương pháp FIFO), Lợi nhuận gộp, và Tổng giá trị hàng tồn kho.
- **Phân tách đa chiều**: Cho phép lọc số liệu theo loại xe (Tất cả, Ô tô `CAR`, Xe máy `MOTORBIKE`) và theo chu kỳ phân tích (Tháng `month` hoặc Tuần `week`).
- **Phân tích xu hướng biến động (Trend Charts)**: Cung cấp chuỗi dữ liệu đa kỳ kết hợp biểu đồ cột (Mua vào / Bán ra) và biểu đồ đường (Lợi nhuận gộp).
- **Bảng dữ liệu phân tích hiệu quả từng mã phụ tùng (`vinfast-parts-dashboard-table`)**: Đánh giá chi tiết số lượng mua/bán, giá trị doanh thu, giá vốn và tỷ suất lợi nhuận cho từng mã SKU.
- **Báo cáo theo dõi tổng thể (`vinfast-parts` tracking)**: Truy vết dòng tiền, số lượng nhập/xuất và danh sách hóa đơn liên quan.
- **Xuất báo cáo Excel chạy ngầm (`VinfastPartsExportBackgroundService`)**: Xử lý xuất file bảng kê chi tiết và tổng hợp qua tiến trình nền có theo dõi tiến độ thời gian thực qua SSE.

---

## 2. Cấu trúc Source Code Backend

```text
src/reports-core/
├── services/
│   ├── vinfast-parts-export-background.service.ts       # Service quản lý job xuất báo cáo phụ tùng ngầm, SSE progress
│   └── vinfast-parts-export-background.service.spec.ts  # Unit test cho background export service
├── reports-core.controller.ts                           # Controller khai báo các route /vinfast-parts-* với RBAC Guard
├── reports-core.service.ts                              # Service tính toán aggregate KPI, phân rã dữ liệu hóa đơn & build Excel
├── reports-core.module.ts                               # Module NestJS đăng ký ReportsCoreService & ExportBackgroundService
└── vinfast-car-part-codes.ts                            # Tập hợp mã phụ tùng Ô tô chuẩn (CAR) dùng phân loại xe
```

---

## 3. Danh sách API Endpoints & RBAC Contract

Controller Base Route: `/api/v1/reports`  
Guards: `@UseGuards(JwtAuthGuard, CoreRbacGuard)`  
Quyền bắt buộc: `@RequirePermissions({ resource: 'vinfast', action: 'read' })`

| Method | Endpoint | Tham số chính | Mô tả |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/reports/vinfast-parts-dashboard` | `dateFrom`, `dateTo`, `vehicleType`, `groupBy` (`month`\|`week`), `itemCode` | Lấy dữ liệu KPI tổng hợp, phân bổ theo loại xe và dữ liệu chuỗi thời gian cho biểu đồ xu hướng |
| `GET` | `/api/v1/reports/vinfast-parts-dashboard-table` | `dateFrom`, `dateTo`, `vehicleType`, `page`, `limit`, `column_search`, `column_filters`, `sorts` | Lấy bảng dữ liệu chi tiết hiệu quả từng mã SKU (Doanh thu, Giá vốn, Lợi nhuận, Tồn kho) |
| `GET` | `/api/v1/reports/vinfast-parts-dashboard-table/column-options` | `columnKey`, `search`, `page`, `limit`, `filters`, `dateFrom`, `dateTo`, `vehicleType` | Lấy danh sách options distinct cho bộ lọc cột của bảng dashboard |
| `GET` | `/api/v1/reports/vinfast-parts` | `dateFrom`, `dateTo`, `search`, `sortBy`, `sortDir`, `column_filters`, `page`, `limit` | Lấy danh sách báo cáo theo dõi tổng thể phụ tùng (Tracking list) |
| `GET` | `/api/v1/reports/vinfast-parts/details` | `dateFrom`, `dateTo`, `search`, `itemCode` | Lấy danh sách chi tiết các dòng hóa đơn mua vào (IN) và bán ra (OUT) của mã phụ tùng |
| `GET` | `/api/v1/reports/vinfast-parts/column-options` | `columnKey`, `search`, `page`, `limit`, `filters` | Lấy options distinct cho bộ lọc cột của trang theo dõi phụ tùng |
| `POST` | `/api/v1/reports/vinfast-parts/export/excel/background` | Body: `VinfastPartsExportQuery` | Khởi chạy tiến trình xuất báo cáo phụ tùng ra file Excel chạy ngầm |
| `GET` | `/api/v1/reports/vinfast-parts/export/excel/background/history` | `page`, `pageSize` | Lấy danh sách lịch sử các file báo cáo đã xuất của người dùng |
| `GET` | `/api/v1/reports/vinfast-parts/export/excel/background/:jobId/download` | `jobId` | Tải xuống file Excel báo cáo đã hoàn thành |
| `GET` | `/api/v1/reports/vinfast-parts/export/excel/progress/stream` | — | **SSE Stream**: Theo dõi tiến độ xuất báo cáo thời gian thực |

---

## 4. Logic Nghiệp vụ Trọng tâm

### 4.1. Tổng hợp Chỉ số KPI (`getVinfastPartsDashboard`)
- **Doanh thu (`revenue`)**: Tổng thành tiền trước thuế (`preVatAmount`) của các dòng xuất xưởng / bán lẻ (`direction = 'OUT'`).
- **Giá vốn (`cogs`)**: Tổng giá vốn xuất kho theo phương pháp FIFO ứng với số lượng đã bán.
- **Lợi nhuận gộp (`grossProfit`)**: $\text{Gross Profit} = \text{Revenue} - \text{COGS}$.
- **Giá trị tồn kho (`inventoryValue`)**: Tổng số lượng tồn kho còn lại nhân với đơn giá nhập theo từng lô FIFO.
- **Phân bổ theo loại xe (`byVehicleType`)**: Tách riêng số liệu thành 2 nhánh con `CAR` và `MOTORBIKE`.
- **Sparklines & Biểu đồ**: Tạo mảng dữ liệu 6 tháng gần nhất (với `groupBy = 'month'`) hoặc 4 tuần gần nhất (với `groupBy = 'week'`).

### 4.2. Bảng kê Phân tích Hiệu quả SKU (`getVinfastPartsDashboardTable`)
- Tính toán trực tiếp trên từng mã SKU:
  - Số lượng mua (`qtyBought`), Thành tiền mua (`amountBought`).
  - Số lượng bán (`qtySold`), Doanh thu bán (`amountSold`).
  - Lợi nhuận sinh ra (`profit`), Đơn giá bán bình quân, Đơn giá vốn bình quân.
- Hỗ trợ tìm kiếm theo chuỗi, lọc theo cột (`column_filters`) và sắp xếp đa cột (`sorts`).

### 4.3. Xuất Báo Cáo Chạy Ngầm (`VinfastPartsExportBackgroundService`)
- Hoạt động độc lập với bộ nhớ RAM đệm (In-memory Job Queue), TTL = 24 giờ.
- Hỗ trợ lưu trữ buffer file và phát sự kiện tiến độ SSE `vinfast-parts-xlsx-export`.
- Phát hiện query trùng lặp qua hàm băm `buildQueryFingerprint`.

---

## 5. Tích hợp Liên Module

- **`vinfast-parts`**: Chia sẻ nguồn dữ liệu từ bảng `vinfast_parts_catalog` và `vinfast_parts_ledger`.
- **`erp-invoices-core`**: Khai thác dữ liệu gốc từ `erp_invoices` (hóa đơn VAT điện tử) và `erp_invoice_items`.
- **`rbac-core`**: Định nghĩa quyền tài nguyên `vinfast` (`resource: 'vinfast', label: 'Vinfast (Phụ tùng & Xưởng)'`).

---

## 6. Quy tắc Kiểm thử & QC Mandate

Khi chỉnh sửa phân hệ báo cáo phụ tùng:
1. Chạy Type-check: `bun run check:ci`
2. Chạy Unit test: `bunx jest src/reports-core/reports-core.service.spec.ts --forceExit` và `src/reports-core/services/vinfast-parts-export-background.service.spec.ts`
3. Kiểm tra tính chính xác của các công thức tính COGS và Gross Profit khi ghép nối với hóa đơn thực tế.
