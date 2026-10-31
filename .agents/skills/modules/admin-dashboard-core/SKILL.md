---
name: admin-dashboard-core
description: Module backend cung cấp API tổng quan điều hành và quản trị hệ thống (/api/v2/admin/dashboard/summary) cho Cổng Quản trị V2 Admin Portal.
---

# 🛡️ Module Backend Tri Thức: Admin Dashboard Core (`admin-dashboard-core`)

## 1. Tổng Quan & Trách Nhiệm
- **Endpoint**: `GET /api/v2/admin/dashboard/summary`
- **Controller**: `AdminDashboardController` (`src/v2/admin-dashboard-core/controllers/admin-dashboard.controller.ts`)
- **Service**: `AdminDashboardStatsService` (`src/v2/admin-dashboard-core/services/admin-dashboard-stats.service.ts`)
- **Guard**: `JwtAuthGuard` + `CoreRbacGuard`
- **Quyền yêu cầu**: Phục vụ tài khoản quản trị tối cao (Super Admin) qua RBAC.

## 2. DTO Contract
- Query parameter: `period` (`month` | `quarter` | `year`)
- Response: `AdminDashboardSummaryResponseDto`
  - `kpis`: Doanh thu, Đơn hàng, Tồn kho tối thiểu, Công nợ, Tỷ lệ tăng trưởng tương ứng.
  - `recentPendingApprovals`: Danh sách các chứng từ chờ duyệt cấp cao.
  - `systemHealth`: Trạng thái kết nối DB, API, Services và thời gian phản hồi.

## 3. Co-located Tests
- Controller Spec: `src/v2/admin-dashboard-core/admin-dashboard.controller.spec.ts` (PASS)
- Service Spec: `src/v2/admin-dashboard-core/services/admin-dashboard-stats.service.spec.ts` (PASS)
