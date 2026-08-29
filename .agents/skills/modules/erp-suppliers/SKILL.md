---
name: erp-suppliers
description: Module tri thức Quản lý Đối Tác Kinh Doanh (Khách Hàng & Nhà Cung Cấp / Business Partners) trong erp-api (business-partners-core) và erp-web. Chứa toàn bộ database schema (erp_business_partners), DTOs, API endpoints, logic phân loại đối tác (partner_type = VENDOR / CUSTOMER), tìm kiếm đa từ khóa, lọc theo cột, bộ lọc distinct options và kiến trúc giao diện chuẩn hóa SpreadsheetPageTemplate.
---

# 🏢 Module Tri Thức: Quản Lý Đối Tác Kinh Doanh (Khách Hàng & Nhà Cung Cấp - Business Partners)

## 1. Tổng quan Nghiệp vụ

Phân hệ Quản lý Đối Tác Kinh Doanh (Master Data thuộc module `business-partners-core` trên Backend và module `business-partners-core` trên Frontend) quản lý toàn bộ hồ sơ khách hàng (`CUSTOMER`) và nhà cung cấp (`VENDOR` / `SUPPLIER`).

Các nghiệp vụ trọng tâm:
- **Quản lý Hồ sơ Đối tác**: Lưu trữ thông tin định danh (Mã đối tác `code`, Tên pháp nhân `name`, Tên hiển thị `display_name`, Mã số thuế `tax_code`, Địa chỉ `address`, Người liên hệ `contact_name`, Số điện thoại `phone`, Email `email`, Ghi chú `notes`).
- **Phân loại Đối tác Kinh doanh (`partner_type`)**:
  - `VENDOR` / `SUPPLIER`: Nhà cung cấp vật tư, phụ tùng, dịch vụ (phục vụ trang `/erp-suppliers`).
  - `CUSTOMER`: Khách hàng mua xe, phụ tùng, dịch vụ (phục vụ trang `/erp-customers`).
  - `PARTNER`: Đối tác liên kết / đại lý.
- **Tìm kiếm Đa Chiều & Bộ Lọc Nâng Cao Chuẩn Spreadsheet**:
  - Tìm kiếm toàn cục mờ nhiều từ khóa (`applyMultiKeywordMultiFieldFilter`).
  - Tìm kiếm theo từng cột (`column_search`) hỗ trợ cụm từ chính xác `"..."` và đa từ khóa ngăn cách bởi dấu chấm phẩy `;`.
  - Bộ lọc danh sách chọn (`column_filters`) hỗ trợ giá trị rỗng `(blank)` (`__BLANK__`).
  - Lọc khoảng ngày tạo (`date_from`, `date_to`).
  - Phân trang server-side (`page`, `pageSize`) và sắp xếp đa trường động (`sort`, `sortField`, `sortOrder`).
- **Quản lý Trạng thái & Xóa mềm**: Trạng thái `status` (`ACTIVE`, `INACTIVE`) và cơ chế xóa mềm `is_deleted = true`.
- **Cung cấp Master Data cho Toàn Hệ Thống**: Mua hàng (PO), Nhập kho (GR), Bán hàng (SO), Xuất kho (GI), Hóa đơn (Invoices), Sổ quỹ / Ngân hàng (Cashflow & Bank Transactions), Công nợ và Báo cáo Dashboard.

---

## 2. Database Schema & Quan hệ Dữ liệu

### Bảng `erp_business_partners` (Hồ Sơ Đối Tác Kinh Doanh)
| Cột | Kiểu dữ liệu | Nullable | Default | Mô tả / Ràng buộc |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO | `gen_random_uuid()` | Khóa chính (PK) |
| `code` | `varchar(255)` | NO | — | Mã đối tác (Unique Index, vd: `NCC-001`, `KH-001`) |
| `name` | `varchar(255)` | NO | — | Tên pháp nhân đăng ký kinh doanh |
| `display_name` | `varchar(255)` | YES | `NULL` | Tên rút gọn / tên giao dịch hiển thị trên giao diện |
| `partner_type` | `varchar(255)` | NO | — | Phân loại đối tác (`VENDOR`, `CUSTOMER`, `PARTNER`) |
| `tax_code` | `varchar(255)` | YES | `NULL` | Mã số thuế doanh nghiệp |
| `phone` | `varchar(255)` | YES | `NULL` | Số điện thoại liên hệ |
| `email` | `varchar(255)` | YES | `NULL` | Địa chỉ email liên hệ |
| `address` | `text` | YES | `NULL` | Địa chỉ trụ sở / kho hàng |
| `contact_name` | `varchar(255)` | YES | `NULL` | Tên người đại diện / đầu mối liên hệ chính |
| `status` | `varchar(255)` | NO | `'ACTIVE'` | Trạng thái hoạt động (`ACTIVE`, `INACTIVE`) |
| `notes` | `text` | YES | `NULL` | Ghi chú thêm |
| `is_deleted` | `boolean` | NO | `false` | Cờ xóa mềm dữ liệu |
| `created_at` | `timestamptz` | NO | `now()` | Ngày tạo bản ghi |
| `updated_at` | `timestamptz` | NO | `now()` | Ngày cập nhật bản ghi |

---

## 3. Cấu trúc Source Code

### 3.1. Backend (`erp-api`)
```text
src/business-partners-core/
├── dto/
│   ├── create-business-partner.dto.ts   # DTO tạo mới đối tác
│   └── update-business-partner.dto.ts   # DTO cập nhật thông tin đối tác
├── entities/
│   └── erp_business_partner.entity.ts   # TypeORM Entity ánh xạ bảng erp_business_partners
├── business-partners-core.controller.ts # Controller REST API /business-partners & /column-options
├── business-partners-core.service.ts    # Service CRUD, phân trang, lọc nâng cao, distinct options
├── business-partners-core.service.spec.ts # Unit tests cho service
└── business-partners-core.module.ts     # NestJS Module đăng ký Entity & Service
```

### 3.2. Frontend (`erp-web`)
```text
src/modules/business-partners-core/
├── api/
│   └── businessPartnersCoreApi.ts       # Client API wrapper (list, get, create, update, remove, getColumnOptions)
├── hooks/
│   └── useBusinessPartnersList.ts       # TanStack Query hook quản lý phân trang, bộ lọc, tìm kiếm
└── components/
    ├── BusinessPartnersListPage.tsx     # Trang bảng dữ liệu chuẩn hóa SpreadsheetPageTemplate
    └── BusinessPartnerDetailDrawer.tsx  # Drawer chi tiết / chỉnh sửa chuẩn StandardFormDrawer
src/pages/
└── ErpBusinessPartnersPage.tsx          # Wrapper route cho ErpCustomersPage và ErpSuppliersPage
```

---

## 4. Danh sách API Endpoints & RBAC Contract

Controller Base Route: `/api/v1/business-partners`  
Guards: `@UseGuards(JwtAuthGuard, CoreRbacGuard)`

| Method | Endpoint | Tham số / Body | RBAC Permission | Mô tả |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/business-partners` | Body: `CreateBusinessPartnerDto` | `resource: 'business_partners'`, `action: 'create'` | Tạo mới thông tin đối tác kinh doanh |
| `GET` | `/api/v1/business-partners` | Query: `partnerType`, `search`, `page`, `pageSize`, `sort`, `column_filters`, `column_search`, `date_from`, `date_to` | `resource: 'business_partners'`, `action: 'read'` | Danh sách đối tác kèm tìm kiếm đa chiều, lọc từng cột và phân trang |
| `GET` | `/api/v1/business-partners/column-options` | Query: `column`, `search`, `page`, `pageSize`, `filters`, `partnerType` | `resource: 'business_partners'`, `action: 'read'` | Lấy danh sách options distinct kèm đếm số lượng bản ghi cho Filter Popover |
| `GET` | `/api/v1/business-partners/:id` | Param: `id` (UUID) | `resource: 'business_partners'`, `action: 'read'` | Lấy chi tiết thông tin đối tác theo ID |
| `PATCH`| `/api/v1/business-partners/:id` | Param: `id`, Body: `UpdateBusinessPartnerDto` | `resource: 'business_partners'`, `action: 'update'` | Cập nhật thông tin chi tiết đối tác |
| `DELETE`| `/api/v1/business-partners/:id` | Param: `id` (UUID) | `resource: 'business_partners'`, `action: 'delete'` | Xóa mềm đối tác (`isDeleted = true`) |

---

## 5. Logic Nghiệp vụ & Kiến trúc Chuẩn Hóa

### 5.1. Phân loại Đối tác (`partnerType`)
- `partnerType = 'VENDOR'`: Trang Nhà cung cấp (`/erp-suppliers`).
- `partnerType = 'CUSTOMER'`: Trang Khách hàng (`/erp-customers`).
- Service đảm bảo lọc đúng phân loại qua `qb.andWhere('bp.partner_type = :partnerType', { partnerType })`.

### 5.2. Công Cụ Lọc Đa Chiều trên Backend
- **`column_filters`**: Nhận JSON string map các mảng giá trị chọn, hỗ trợ giá trị `__BLANK__` chuyển thành điều kiện SQL `IS NULL OR col = ''`.
- **`column_search`**: Tích hợp `applyMultiKeywordFilter`, hỗ trợ:
  - Tìm kiếm chính xác khi bọc trong dấu ngoặc kép: `"Công ty ABC"`.
  - Tìm kiếm nhiều từ khóa đồng thời ngăn cách bởi dấu chấm phẩy: `HN; SG`.
- **`getColumnOptions`**: Truy vấn `DISTINCT` giá trị của cột với phân trang, tự động áp dụng các bộ lọc chéo từ các cột khác (`cross-filtering`).

### 5.3. Quy Chuẩn Giao Diện Bảng (`standardize-table`)
1. **Cột STT (Index)**: Rộng đúng `40px`, căn giữa cả Header (`#`) và Cell, bắt đầu từ 1.
2. **100% Cột Tích Hợp Header Filter Popover**: Dùng `createColumnHeaderFilter` kết nối API `getColumnOptions`.
3. **Cột Mã Code**: Dùng `<TableText enableCopy tooltip onDetailClick>`, có badge `INACTIVE` căn phải khi ngưng hoạt động.
4. **Cột MST**: Dùng `<TableText enableCopy tooltip>` cho phép sao chép nhanh trực tiếp tại ô dữ liệu.
5. **Cột Trạng Thái**: Dùng `<StatusBadge status={row.status} className="w-[88px] inline-flex items-center justify-center text-center truncate" />` bọc trong `<Tooltip>`.
6. **Cột Ngày Tạo**: Dùng `headerFilter.date` kết hợp `<TableDateCell className="justify-end w-full" />`.
7. **Floated Action Menu**: Hover theo dòng hiển thị 2 Quick Actions đầu tiên: 👁️ Xem chi tiết (`view` mode) và ✏️ Chỉnh sửa (`edit` mode), kèm menu ba chấm `...` (Xem chi tiết, Chỉnh sửa, Xóa).
8. **Drawer Chi Tiết**: Tách riêng `BusinessPartnerDetailDrawer.tsx` theo chuẩn `standardize-drawer` (kích thước `md`, bố cục 1-column, chuyển đổi linh hoạt chế độ xem/sửa).
9. **View Presets & Toàn Màn Hình**: Tích hợp `<ViewModeCombobox>` và `enableFullscreen={true}`.

---

## 6. Tích hợp Liên Module

- **`purchase-orders-core`**: Gán `supplier_id` vào đơn mua hàng (`erp_purchase_orders`).
- **`sales-orders-core`**: Gán `customer_id` vào đơn bán hàng (`erp_sales_orders`).
- **`inventory-core` (Goods Receipts / Goods Issues)**: Tham chiếu đối tác nhập/xuất kho.
- **`erp-invoices-core`**: Đối soát mã số thuế (`tax_code`) và tên đối tác trên hóa đơn điện tử đầu vào/đầu ra.
- **`cashflow-vouchers` & `bank-transactions-core`**: Ghi nhận đối tác nộp tiền / nhận tiền trong thu chi và sao kê ngân hàng.
- **`rbac-core`**: Khai báo quyền tài nguyên `business_partners` (Resource: `'business_partners'`, Actions: `create`, `read`, `update`, `delete`).

---

## 7. Quy tắc Kiểm thử & QC Mandate

1. **Type-check**:
   - Backend: `cd erp-api && bun run type:check` (0 errors).
   - Frontend: `cd erp-web && bun run type:check` (0 errors).
2. **Unit test**:
   - Backend: `cd erp-api && bunx jest src/business-partners-core/ --forceExit` (100% passing).
   - Frontend: `cd erp-web && bun run test` (100% passing).
