---
name: admin-dashboard-core
description: Module backend cung cấp API tổng quan điều hành và quản trị hệ thống (/api/v2/admin/dashboard/summary) cho Cổng Quản trị V2 Admin Portal. Code nằm ở module src/v2/modules/admin-dashboard (lõi admin-dashboard-core đã xóa vì không có phần base).
---

# 🛡️ Module Backend Tri Thức: Admin Dashboard (`admin-dashboard`)

## 1. Tổng Quan & Trách Nhiệm
- **Endpoint**: `GET /api/v2/admin/dashboard/summary`
- **Module**: `AdminDashboardModule` (`src/v2/modules/admin-dashboard/admin-dashboard.module.ts`), import `DashboardCoreModule` của v1 (`src/dashboard-core`); đây là phụ thuộc v1 còn tồn tại (nợ riêng, chưa xử lý)
- **Controller**: `AdminDashboardController` (`src/v2/modules/admin-dashboard/controllers/admin-dashboard.controller.ts`)
- **Service**: `AdminDashboardStatsService` (`src/v2/modules/admin-dashboard/services/admin-dashboard-stats.service.ts`)
- **Lịch sử**: trước 2026-11-22 nằm ở `src/v2/core/admin-dashboard-core` (có `@Controller` trong lõi). Đã chuyển sang module và xóa lõi (plan `table-preferences-admin-dashboard-core-base-only`); không đổi route hay response. Tên skill giữ `admin-dashboard-core` để không vỡ liên kết.
- **Guard**: `JwtAuthGuard` + `CoreRbacGuard`
- **Quyền yêu cầu**: `@RequirePermissions({ resource: ErpResource.DASHBOARD, action: ErpAction.READ })`.

## 2. DTO Contract
- Query parameter: `period` (`month` | `quarter` | `year`)
- Response: `AdminDashboardSummaryResponseDto`
  - `kpis`: Doanh thu, Đơn hàng, Tồn kho tối thiểu, Công nợ, Tỷ lệ tăng trưởng tương ứng.
  - `recentPendingApprovals`: Danh sách các chứng từ chờ duyệt cấp cao.
  - `systemHealth`: Trạng thái kết nối DB, API, Services và thời gian phản hồi.

## 3. Co-located Tests
- Controller Spec: `src/v2/modules/admin-dashboard/controllers/admin-dashboard.controller.spec.ts` (PASS)
- Service Spec: `src/v2/modules/admin-dashboard/services/admin-dashboard-stats.service.spec.ts` (PASS)
- Lệnh: `bunx jest src/v2/modules/admin-dashboard --forceExit`
