---
name: garage-dashboard
description: Module tri thức Dashboard & Báo cáo Hiệu quả Garage (Garage Dashboard, Revenue, Cost, Gross Profit Trend, Sparklines Checkpoint KPIs & Multi-sheet Excel Export) trong erp-api (kgara-api-core). Chứa toàn bộ database schema, API endpoints, logic tổng hợp dữ liệu toàn hệ thống và xuất báo cáo đa sheet.
---

# 📦 Module Tri Thức: Dashboard & Báo Cáo Hiệu Quả Garage (`garage-dashboard`) - Backend (`erp-api`)

## 1. Tổng quan Nghiệp vụ

Module `garage-dashboard` (được hiện thực tại `src/kgara-api-core/garage-dashboard.service.ts` và `src/kgara-api-core/garage-dashboard.controller.ts`) là trung tâm tình báo điều hành và phân tích tài chính xưởng dịch vụ sửa chữa xe trong hệ thống Liouni ERP.

### 1.1. Các tính năng cốt lõi:
- **Phạm vi Toàn hệ thống (No Branch Filter)**: Tính toán tổng hợp dữ liệu trên toàn bộ hệ thống xưởng dịch vụ garage mà không bắt buộc lọc theo chi nhánh.
- **Biểu đồ Xu hướng Tháng (Doanh thu, Giá vốn, Lợi nhuận gộp)**:
  - `revenue`: Tổng doanh thu dịch vụ (`doanh_thu` / `tien_co_thue`).
  - `cost`: Tổng giá vốn phụ tùng và chi phí (`chi_phi` từ `kgara_gross_profit`).
  - `profit`: Lợi nhuận gộp ($\text{revenue} - \text{cost}$).
  - `caseCount`: Số lượng vụ việc tiếp nhận sửa chữa.
- **Chỉ số KPI Sparklines theo Chu kỳ (`getCheckpointKpis`)**:
  - Phân tích 3 chu kỳ: **Tháng này** (Sparkline 6 tháng), **Tuần này** (Sparkline 4 tuần), **Hôm nay** (Sparkline 7 ngày).
  - Tách bạch 2 luồng: Nhóm chỉ số Doanh thu & Lãi gộp và Nhóm chỉ số Giá vốn & Chi phí.
  - Hỗ trợ click-to-drilldown xem danh sách phiếu dịch vụ chi tiết phát sinh trong kỳ (`getCheckpointCases`).
- **Phân tích Khách hàng & Công nợ Phải thu (`getCustomersStats`)**:
  - Gom nhóm theo Khách hàng (`khach_hang_code`, `khach_hang_name`).
  - Tổng hợp Doanh thu, Lãi gộp, Đã thanh toán, Dư nợ công nợ chưa thu (`receivableAmount`), Số lượt xe vào xưởng và Ngày đến xưởng gần nhất.
  - Tìm kiếm, lọc cột, phân trang và sắp xếp theo công nợ giảm dần.
- **Xuất Báo Cáo Excel Đa Worksheets Chuyên Nghiệp (`exportExcel`)**:
  - **Sheet 1: Tổng quan Tháng** (Tháng, Doanh thu, Giá vốn, Lợi nhuận gộp, Biên LN, Số vụ việc).
  - **Sheet 2: Chi tiết Phiếu dịch vụ** (Ngày phát sinh, Số chứng từ, Biển số xe, Khách hàng, Trạng thái, Doanh thu, Giá vốn, Lãi gộp, Đã trả, Còn nợ).

---

## 2. Database Schema & Quan hệ Dữ liệu

### 2.1. Sơ đồ Quan hệ Bảng:

```text
kgara_cases (Hồ sơ Phiếu dịch vụ)
  ├── 1:1 ── kgara_gross_profit (Sổ Lợi nhuận gộp & Chi phí vốn)
  └── 1:N ── kgara_case_services (Chi tiết phụ tùng & công thợ)
```

### 2.2. Chi tiết các Bảng tham gia Dashboard:

| Tên Bảng | Vai trò trong Dashboard | Các cột truy vấn trọng tâm |
| :--- | :--- | :--- |
| `kgara_cases` | Phiếu dịch vụ gốc | `id`, `hd_phieu_dich_vu_id`, `so_chung_tu`, `bien_so_xe`, `khach_hang_code`, `khach_hang_name`, `tinh_trang_dich_vu`, `ten_tinh_trang_dich_vu`, `tien_co_thue`, `tien_da_thanh_toan`, `tien_con_phai_thanh_toan`, `ngay_phat_sinh`, `kgara_deleted_at` |
| `kgara_gross_profit` | Dữ liệu tài chính lãi gộp & giá vốn | `hd_phieu_dich_vu_id`, `vu_viec_code`, `doanh_thu`, `chi_phi`, `loi_nhuan` |
| `kgara_case_services` | Chi tiết dòng dịch vụ & phụ tùng | `hd_phieu_dich_vu_id`, `san_pham_name`, `loai_san_pham_code`, `tien_dich_vu`, `tien_phu_tung`, `gia_von_phu_tung` |

### 2.3. Quy tắc Lọc Bắt buộc:
- Bỏ qua các phiếu bị xóa trên KGara: `c.kgara_deleted_at IS NULL`.
- Bỏ qua phiếu hủy: `(c.tinh_trang_dich_vu IS NULL OR c.tinh_trang_dich_vu != 9)`.

---

## 3. Cấu trúc Source Code Backend (`erp-api`)

```text
src/kgara-api-core/
├── garage-dashboard.controller.ts     # Controller khai báo endpoints, Swagger & RBAC guard
├── garage-dashboard.service.ts        # Service xử lý aggregation SQL, Sparkline data & ExcelJS
└── kgara-api-core.module.ts           # Đăng ký Controller & Service vào Module
```

---

## 4. Danh sách API Endpoints & RBAC Contract

Base Path: `/api/v1/greenway/dashboard`  
Guards: `JwtAuthGuard`, `CoreRbacGuard`  
Resource RBAC: `garage`

| Method | Endpoint | Quyền yêu cầu | Query Parameters | Mô tả |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/stats` | `{ resource: 'garage', action: 'read' }` | `date_from`, `date_to` | Biểu đồ xu hướng tháng (Doanh thu, Giá vốn, Lợi nhuận gộp, Số vụ việc) |
| `GET` | `/checkpoint-kpis` | `{ resource: 'garage', action: 'read' }` | — | Chỉ số KPI và mảng dữ liệu Sparkline cho Tháng, Tuần, Hôm nay |
| `GET` | `/checkpoint-cases` | `{ resource: 'garage', action: 'read' }` | `date_from`, `date_to`, `page`, `pageSize` | Danh sách vụ việc chi tiết theo khung thời gian checkpoint |
| `GET` | `/customers` | `{ resource: 'garage', action: 'read' }` | `page`, `pageSize`, `search`, `date_from`, `date_to`, `sortBy`, `sortOrder`, `column_search`, `column_filters` | Danh sách khách hàng kèm doanh thu, lãi gộp và dư nợ công nợ chưa thu |
| `GET` | `/export` | `{ resource: 'garage', action: 'read' }` | `date_from`, `date_to` | Xuất báo cáo Excel chuyên nghiệp 2-4 sheets |

---

## 5. Logic Nghiệp vụ & Thuật toán Trọng tâm

### 5.1. Thuật toán Đối soát & Tính Giá Vốn / Lợi Nhuận Gộp
Do phiếu dịch vụ trên bảng `kgara_cases` có thể chưa được cập nhật giá vốn trực tiếp, hệ thống tự động `LEFT JOIN` với bảng `kgara_gross_profit`:
```sql
SELECT 
  TO_CHAR(COALESCE(c.ngay_phat_sinh, c.created_at), 'YYYY-MM') as month,
  SUM(COALESCE(gp.doanh_thu, c.doanh_thu, c.tien_co_thue, 0)) as revenue,
  SUM(COALESCE(gp.chi_phi, c.chi_phi, 0)) as cost,
  SUM(COALESCE(gp.loi_nhuan, c.loi_nhuan, COALESCE(gp.doanh_thu, c.doanh_thu, c.tien_co_thue, 0) - COALESCE(gp.chi_phi, c.chi_phi, 0), 0)) as profit,
  COUNT(c.id) as case_count
FROM kgara_cases c
LEFT JOIN kgara_gross_profit gp ON gp.hd_phieu_dich_vu_id = c.hd_phieu_dich_vu_id OR gp.vu_viec_code = c.so_chung_tu
WHERE c.kgara_deleted_at IS NULL AND (c.tinh_trang_dich_vu IS NULL OR c.tinh_trang_dich_vu != 9)
GROUP BY 1 ORDER BY 1 ASC
```

---

## 6. Tích hợp Liên Module & Frontend

- **`kgara-api-core`**: Xử lý logic và API endpoint.
- **Frontend (`erp-web`)**:
  - API Client: [`garageDashboardApi.ts`](file:///home/dev/repos/erp/erp-web/src/modules/garage/api/garageDashboardApi.ts)
  - Trang chính: [`GarageDashboard.tsx`](file:///home/dev/repos/erp/erp-web/src/modules/garage/pages/GarageDashboard.tsx)
  - Components: [`GarageStatsCards.tsx`](file:///home/dev/repos/erp/erp-web/src/modules/garage/components/GarageStatsCards.tsx), [`GarageTrendChart.tsx`](file:///home/dev/repos/erp/erp-web/src/modules/garage/components/GarageTrendChart.tsx), [`GarageCheckpointDrawer.tsx`](file:///home/dev/repos/erp/erp-web/src/modules/garage/components/GarageCheckpointDrawer.tsx).

---

## 7. Quy tắc Kiểm thử & Báo cáo Chất lượng (QC Mandate)

1. **TypeCheck**: Chạy `bun run check:ci` trong thư mục `erp-api/`.
2. **Unit Test**: Chạy `bunx jest --forceExit` trước khi commit/push.
