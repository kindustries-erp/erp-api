---
name: erp-suppliers
description: Module tri thức Quản lý Nhà Cung Cấp & Master Data Đối Tác (Suppliers / Business Partners) trong erp-api (business-partners-core). Chứa toàn bộ database schema (erp_business_partners), DTOs, API endpoints, logic phân loại đối tác (partner_type = VENDOR / SUPPLIER), tìm kiếm đa trường và tích hợp với chuỗi Mua hàng - Nhập kho - Kế toán.
---

# 🏢 Module Tri Thức: Quản Lý Nhà Cung Cấp (Suppliers Master Data) - Backend (`erp-api`)

## 1. Tổng quan Nghiệp vụ

Phân hệ Quản lý Nhà Cung Cấp (Suppliers Master Data, thuộc module `business-partners-core`) là danh mục dữ liệu chủ (Master Data) lưu trữ toàn bộ hồ sơ các đối tác kinh doanh cung cấp vật tư, linh kiện, trang thiết bị, phụ tùng và dịch vụ cho doanh nghiệp.

Các nghiệp vụ trọng tâm:
- **Quản lý Hồ sơ Nhà cung cấp**: Lưu trữ thông tin định danh (Mã NCC `code`, Tên pháp nhân `name`, Tên hiển thị `display_name`, Mã số thuế `tax_code`, Địa chỉ, Người liên hệ `contact_name`, Số điện thoại, Email).
- **Phân loại Đối tác Kinh doanh (`partner_type`)**: Hỗ trợ phân loại đối tác theo các loại hình:
  - `VENDOR` / `SUPPLIER`: Nhà cung cấp vật tư, phụ tùng, dịch vụ.
  - `CUSTOMER`: Khách hàng mua xe / dịch vụ.
  - `PARTNER`: Đối tác liên kết / đại lý.
- **Tìm kiếm & Tra cứu Nhanh**: Tìm kiếm toàn diện theo chuỗi ký tự trên đồng thời mã nhà cung cấp, tên pháp nhân và tên hiển thị (`ILike`).
- **Quản lý Trạng thái & Xóa mềm**: Hỗ trợ trạng thái hoạt động `status` (`ACTIVE`, `INACTIVE`) và cơ chế xóa mềm an toàn `is_deleted = true`.
- **Cung cấp Master Data cho các Phân hệ Vận hành**: Cung cấp nguồn tham chiếu chuẩn cho Đơn mua hàng (PO), Phiếu nhập kho (GR), Hóa đơn mua vào (Invoices), Phiếu chi thanh toán (Payment Vouchers) và Báo cáo Dashboard Mua hàng.

---

## 2. Database Schema & Quan hệ Dữ liệu

### Bảng `erp_business_partners` (Hồ Sơ Đối Tác & Nhà Cung Cấp)
| Cột | Kiểu dữ liệu | Nullable | Default | Mô tả / Ràng buộc |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO | `gen_random_uuid()` | Khóa chính (PK) |
| `code` | `varchar(255)` | NO | — | Mã nhà cung cấp (Unique Index, vd: `NCC-001`, `VF-HN`) |
| `name` | `varchar(255)` | NO | — | Tên pháp nhân đăng ký kinh doanh |
| `display_name` | `varchar(255)` | YES | `NULL` | Tên rút gọn / tên giao dịch hiển thị trên giao diện |
| `partner_type` | `varchar(255)` | NO | — | Phân loại đối tác (`VENDOR`, `CUSTOMER`, `PARTNER`) |
| `tax_code` | `varchar(255)` | YES | `NULL` | Mã số thuế doanh nghiệp |
| `phone` | `varchar(255)` | YES | `NULL` | Số điện thoại liên hệ |
| `email` | `varchar(255)` | YES | `NULL` | Địa chỉ email liên hệ |
| `address` | `text` | YES | `NULL` | Địa chỉ trụ sở / kho hàng của NCC |
| `contact_name` | `varchar(255)` | YES | `NULL` | Tên người đại diện / đầu mối liên hệ chính |
| `status` | `varchar(255)` | NO | `'ACTIVE'` | Trạng thái hoạt động (`ACTIVE`, `INACTIVE`) |
| `notes` | `text` | YES | `NULL` | Ghi chú thêm về NCC |
| `is_deleted` | `boolean` | NO | `false` | Cờ xóa mềm dữ liệu |
| `created_at` | `timestamptz` | NO | `now()` | Ngày tạo bản ghi |
| `updated_at` | `timestamptz` | NO | `now()` | Ngày cập nhật bản ghi |

---

## 3. Cấu trúc Source Code Backend

```text
src/business-partners-core/
├── dto/
│   ├── create-business-partner.dto.ts   # DTO tạo mới NCC/đối tác
│   └── update-business-partner.dto.ts   # DTO cập nhật thông tin NCC
├── entities/
│   └── erp_business_partner.entity.ts   # TypeORM Entity ánh xạ bảng erp_business_partners
├── business-partners-core.controller.ts # Controller khai báo REST API /business-partners
├── business-partners-core.service.ts    # Service xử lý CRUD, phân trang, lọc theo partnerType
└── business-partners-core.module.ts     # NestJS Module đăng ký Entity & Service
```

---

## 4. Danh sách API Endpoints & RBAC Contract

Controller Base Route: `/api/v1/business-partners`  
Guards: `@UseGuards(JwtAuthGuard, CoreRbacGuard)`

| Method | Endpoint | Tham số / Body | RBAC Permission | Mô tả |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/business-partners` | Body: `CreateBusinessPartnerDto` | `resource: 'business_partners'`, `action: 'create'` | Tạo mới thông tin nhà cung cấp / đối tác kinh doanh |
| `GET` | `/api/v1/business-partners` | Query: `partnerType`, `search`, `page`, `pageSize`, `sort` | `resource: 'business_partners'`, `action: 'read'` | Lấy danh sách đối tác (Lọc theo `partnerType=VENDOR` để lấy danh sách NCC, tìm kiếm theo tên/mã, phân trang) |
| `GET` | `/api/v1/business-partners/:id` | Param: `id` (UUID) | `resource: 'business_partners'`, `action: 'read'` | Lấy chi tiết thông tin một nhà cung cấp theo ID |
| `PATCH`| `/api/v1/business-partners/:id` | Param: `id`, Body: `UpdateBusinessPartnerDto` | `resource: 'business_partners'`, `action: 'update'` | Cập nhật thông tin chi tiết nhà cung cấp |
| `DELETE`| `/api/v1/business-partners/:id` | Param: `id` (UUID) | `resource: 'business_partners'`, `action: 'delete'` | Xóa mềm nhà cung cấp (`isDeleted = true`) |

### Cấu trúc DTO Tạo Nhà Cung Cấp (`CreateBusinessPartnerDto`):
```typescript
export class CreateBusinessPartnerDto {
  code: string;               // Mã NCC (bắt buộc)
  name: string;               // Tên pháp nhân (bắt buộc)
  displayName?: string;       // Tên hiển thị
  partnerType: string;        // 'VENDOR' hoặc 'CUSTOMER'
  taxCode?: string;           // Mã số thuế
  phone?: string;             // Số điện thoại
  email?: string;             // Email
  address?: string;           // Địa chỉ
  contactName?: string;       // Người liên hệ
  status?: string;            // 'ACTIVE' | 'INACTIVE'
  notes?: string;             // Ghi chú
}
```

---

## 5. Logic Nghiệp vụ Trọng tâm

### 5.1. Lọc Nhà Cung Cấp Theo Phân Loại (`partnerType = 'VENDOR'`)
- Khi frontend gọi trang Nhà Cung Cấp (`/erp-suppliers`), query parameter `partnerType=VENDOR` được truyền vào API.
- Service xây dựng bộ điều kiện lọc:
  ```typescript
  const baseWhere = query.partnerType
    ? { partnerType: query.partnerType, isDeleted: false }
    : { isDeleted: false };
  ```

### 5.2. Tìm Kiếm Mờ Đa Chiều (Multi-field Fuzzy Search)
- Nếu có tham số `search`, service tạo điều kiện `OR` (mảng `where`) kết hợp với `baseWhere`:
  ```typescript
  where = [
    { ...baseWhere, name: ILike(`%${query.search}%`) },
    { ...baseWhere, displayName: ILike(`%${query.search}%`) },
    { ...baseWhere, code: ILike(`%${query.search}%`) },
  ];
  ```

### 5.3. Chuẩn Hóa Sắp Xếp Đa Trường (`resolveSortOrder`)
- Hỗ trợ các trường sắp xếp: `createdAt`, `code`, `name`, `displayName`, `partnerType`.
- Tự động map tên cột cơ sở dữ liệu `created_at` -> `createdAt`, `partner_type` -> `partnerType`.
- Mặc định: `{ createdAt: 'DESC' }`.

### 5.4. Cơ Chế Xóa Mềm (Soft Delete)
- Thay vì xóa bản ghi khỏi database (gây đứt gãy khóa ngoại tại các đơn hàng cũ), service chuyển cờ `isDeleted = true` và lưu lại vào database.

---

## 6. Tích hợp Liên Module

- **`purchase-orders-core`**: Gán `supplier_id` vào đơn mua hàng (`erp_purchase_orders`).
- **`goods-receipts-core`**: Gán `supplier_id` vào phiếu nhập kho khi tiếp nhận hàng từ NCC.
- **`erp-invoices-core`**: Đối soát mã số thuế (`tax_code`) và tên nhà cung cấp trên hóa đơn điện tử đầu vào.
- **`reports-core`**: Cung cấp tên và mã hiển thị trong danh sách Top 10 Nhà Cung Cấp của Purchasing Dashboard.
- **`cashflow-vouchers` & `accounting-core`**: Đối tượng thụ hưởng trong các giao dịch chi trả tiền hàng cho nhà cung cấp (`SUPPLIER_PAYMENT`).
- **`rbac-core`**: Khai báo quyền tài nguyên `business_partners` (Resource: `'business_partners'`, Label: `'Business Partners'`).

---

## 7. Quy tắc Kiểm thử & QC Mandate

Khi chỉnh sửa phân hệ Nhà Cung Cấp:
1. **Type-check**: `bun run check:ci`
2. **Unit test**:
   ```bash
   bunx jest src/business-partners-core/ --forceExit
   ```
3. Đảm bảo tính duy nhất của cột `code` (`UNIQUE INDEX`) và kiểm tra tính toàn vẹn khi liên kết khóa ngoại với các bảng chứng từ.
