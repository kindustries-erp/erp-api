---
name: module-config
description: Module tri thức Quản lý Cấu hình Danh mục & Trường tùy chỉnh Đa Module (Dynamic Module Categories & Custom Fields) trong erp-api (module-config & bom-config). Chứa toàn bộ database schema (erp_bom_categories, erp_bom_attribute_defs, erp_entity_attribute_values), DTOs, API endpoints, logic phân vùng module_key và tích hợp liên module với Invoices, Bank Transactions, BOM & frontend drawer controls.
---

# 📦 Module Tri Thức: Quản lý Cấu hình Danh mục & Trường tùy chỉnh Đa Module (`module-config`)

## 1. Tổng quan Nghiệp vụ

Module `module-config` cung cấp cơ chế **Dynamic Custom Fields Engine (EAV)** linh hoạt cho toàn bộ hệ sinh thái Liouni ERP. Cho phép quản trị viên và người dùng định nghĩa các Danh mục (Categories) và Thuộc tính động (Custom Attributes/Fields) theo từng phân hệ nghiệp vụ (`module_key` như `'INVOICE'`, `'BANK_TXN'`, `'BOM'`), đồng thời cho phép nhập liệu, validate bắt buộc (`isRequired`), và truy xuất giá trị thuộc tính trực tiếp trên các chứng từ nghiệp vụ mà không cần thay đổi schema database vật lý.

---

## 2. Database Schema & Quan hệ Dữ liệu

### A. Bảng Danh mục Module: `erp_bom_categories`
| Tên cột | Kiểu dữ liệu | Nullable | Ràng buộc / Mặc định | Mô tả |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO | `PK`, `gen_random_uuid()` | Khóa chính |
| `module_key` | `varchar(50)` | NO | Default `'BOM'` | Phân hệ nghiệp vụ (`'BOM'`, `'INVOICE'`, `'BANK_TXN'`) |
| `code` | `varchar(50)` | NO | Composite Unique `(module_key, code)` | Mã danh mục viết hoa (vd: `EXPENSE`, `INTERNAL`, `MOTORCYCLE`) |
| `name` | `varchar(255)` | NO | | Tên hiển thị danh mục |
| `description` | `text` | YES | | Mô tả chi tiết danh mục |
| `is_active` | `boolean` | NO | Default `true` | Trạng thái kích hoạt |
| `is_deleted` | `boolean` | NO | Default `false` | Cờ xóa mềm |
| `created_at` | `timestamptz` | NO | Default `now()` | Thời điểm tạo |
| `updated_at` | `timestamptz` | NO | Default `now()` | Thời điểm cập nhật |

### B. Bảng Định nghĩa Thuộc tính Động: `erp_bom_attribute_defs`
| Tên cột | Kiểu dữ liệu | Nullable | Ràng buộc / Mặc định | Mô tả |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO | `PK`, `gen_random_uuid()` | Khóa chính |
| `category_id` | `uuid` | NO | `FK -> erp_bom_categories(id) ON DELETE CASCADE` | Danh mục sở hữu thuộc tính |
| `code` | `varchar(50)` | NO | Composite Unique `(category_id, code)` | Mã thuộc tính viết thường/snake_case |
| `name` | `varchar(255)` | NO | | Tên thuộc tính hiển thị trên UI |
| `field_type` | `varchar(20)` | NO | `'TEXT'`, `'NUMBER'`, `'SELECT'`, `'DATE'`, `'CHECKBOX'` | Kiểu dữ liệu thuộc tính |
| `options` | `jsonb` | YES | Array of `{ value: string, label: string }` | Danh sách options khi `field_type = 'SELECT'` |
| `sort_order` | `int` | NO | Default `0` | Thứ tự sắp xếp trên giao diện |
| `is_required` | `boolean` | NO | Default `false` | Bắt buộc nhập liệu trước khi lưu |
| `is_active` | `boolean` | NO | Default `true` | Trạng thái hoạt động |
| `is_deleted` | `boolean` | NO | Default `false` | Cờ xóa mềm |
| `created_at` | `timestamptz` | NO | Default `now()` | Thời điểm tạo |
| `updated_at` | `timestamptz` | NO | Default `now()` | Thời điểm cập nhật |

### C. Bảng Lưu trữ Giá trị Thực tế Đa Module: `erp_entity_attribute_values`
| Tên cột | Kiểu dữ liệu | Nullable | Ràng buộc / Mặc định | Mô tả |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO | `PK`, `gen_random_uuid()` | Khóa chính |
| `entity_type` | `varchar(50)` | NO | Index | Phân loại module (`'INVOICE'`, `'BANK_TXN'`, `'BOM'`) |
| `entity_id` | `uuid` | NO | Index `(entity_type, entity_id)` | Khóa chính của bản ghi thực thể |
| `category_id` | `uuid` | YES | `FK -> erp_bom_categories(id) ON DELETE SET NULL` | ID Danh mục tại thời điểm nhập |
| `attr_def_id` | `uuid` | NO | `FK -> erp_bom_attribute_defs(id) ON DELETE CASCADE` | ID Định nghĩa thuộc tính |
| `value_text` | `text` | YES | | Giá trị thực tế đã nhập |
| `created_at` | `timestamptz` | NO | Default `now()` | Thời điểm tạo |
| `updated_at` | `timestamptz` | NO | Default `now()` | Thời điểm cập nhật |

> **Ràng buộc duy nhất**: `UNIQUE (entity_type, entity_id, attr_def_id)`.

---

## 3. Cấu trúc Source Code Backend

```
src/module-config/
├── dto/
│   ├── create-module-category.dto.ts
│   ├── update-module-category.dto.ts
│   ├── create-module-attr-def.dto.ts
│   ├── update-module-attr-def.dto.ts
│   └── save-entity-values.dto.ts
├── entities/
│   └── erp_entity_attribute_value.entity.ts
├── module-config.controller.ts
├── module-config.service.ts
├── module-config.service.spec.ts
└── module-config.module.ts
```

---

## 4. Danh sách API Endpoints & RBAC Contract

Base URL: `/api/v1/module-config` (Yêu cầu `JwtAuthGuard`)

| Method | Endpoint | Payload / Params | Mô tả |
| :--- | :--- | :--- | :--- |
| `GET` | `/categories` | `query: { moduleKey?: string }` | Lấy danh sách danh mục theo module (kèm thuộc tính & usageCount) |
| `POST` | `/categories` | `CreateModuleCategoryDto` | Tạo mới danh mục thuộc module (`moduleKey`, `code`, `name`, `description`) |
| `PATCH` | `/categories/:id` | `UpdateModuleCategoryDto` | Cập nhật thông tin danh mục |
| `DELETE` | `/categories/:id` | `id: UUID` | Xóa mềm danh mục (chặn xóa nếu đang có dữ liệu thực thể liên kết) |
| `GET` | `/attribute-defs` | `query: { categoryId?: string }` | Lấy danh sách thuộc tính của danh mục |
| `POST` | `/attribute-defs` | `CreateModuleAttrDefDto` | Tạo thuộc tính (`categoryId`, `code`, `name`, `fieldType`, `options`, `isRequired`) |
| `PATCH` | `/attribute-defs/:id` | `UpdateModuleAttrDefDto` | Cập nhật thuộc tính (chặn đổi `fieldType` nếu đã có dữ liệu nhập) |
| `DELETE` | `/attribute-defs/:id` | `id: UUID` | Xóa mềm thuộc tính (chặn xóa nếu thuộc tính đang được sử dụng) |
| `GET` | `/values/:entityType/:entityId` | `params: { entityType, entityId }` | Lấy danh mục hiện tại và giá trị các thuộc tính tùy chỉnh của 1 thực thể |
| `PUT` | `/values/:entityType/:entityId` | `SaveEntityValuesDto` (`categoryId`, `attributes`) | Validate các trường `isRequired`, cập nhật `category_id` và upsert giá trị thuộc tính |

---

## 5. Logic Nghiệp vụ Trọng tâm

1. **Phân vùng cách ly theo `moduleKey`**:
   - Mã code danh mục duy nhất trong cùng 1 `moduleKey`, cho phép các module khác nhau có cùng mã code mà không bị conflict.
2. **Kiểm tra an toàn kiểu dữ liệu (Data Integrity Guard)**:
   - Khi `fieldType === 'SELECT'`, options trong JSONB phải có `value` và `label` hợp lệ, không được trùng lặp `value`.
   - Không cho phép đổi `fieldType` của thuộc tính nếu `usageCount > 0`.
3. **Transaction lưu trữ thực thể (`saveEntityValues`)**:
   - Khi nhận `categoryId` và `attributes`:
     - Kiểm tra toàn bộ thuộc tính có `isRequired = true` trong danh mục xem đã được điền chưa.
     - Chạy transaction: Cập nhật `category_id` trên bảng thực thể (`erp_invoices`, `erp_bank_transactions`, `erp_boms`), xóa các giá trị cũ của `(entity_type, entity_id)` và chèn các giá trị mới.

---

## 6. Tích hợp Liên Module

- **`erp-invoices-core`**:
  - `erp_invoices.category_id` liên kết `erp_bom_categories.id`.
  - `CreateErpInvoiceDto` / `UpdateErpInvoiceDto` hỗ trợ `categoryId` và `attributes`.
- **`bank-transactions-core`**:
  - `erp_bank_transactions.category_id` liên kết `erp_bom_categories.id`.
  - `CreateBankTransactionDto`, `UpdateBankTransactionDto`, `PostBankTransactionDto` hỗ trợ `categoryId` và `attributes`.
- **`bom-core`**:
  - `erp_boms.category_id` liên kết `erp_bom_categories.id` (`moduleKey = 'BOM'`).
- **Frontend (`erp-web`)**:
  - `ModuleCustomFieldConfigDrawer`: Quản trị tập trung dạng 2-columns (`size="lg"`, `collapsibleRightPanel={true}`):
    - **Hệ thống Tab 2 tầng**: Tầng 1 là Group Tab (`DrawerTopTabBar`) cho 5 Khối nghiệp vụ lớn (Finance, Production, Commerce, Inventory, Garage) kèm badge đếm thuộc tính; Tầng 2 là `PillTabs` (style bo tròn chuẩn) hiển thị các phân hệ con của từng khối.
    - **Form Thêm/Sửa thuộc tính**: Sử dụng `Combobox` chuẩn ERP với label và subLabel giải thích rõ ràng từng kiểu dữ liệu.
    - **Cột Phải Live Form Preview**: Không gian xem trước form thực tế chuyên dụng, thiết kế phẳng liền mạch không lồng card.
  - `ModuleEntityCustomFieldsSection`: Component nhúng cột phải (Right Panel) tự động nạp danh mục, render controls và lưu giá trị.

---

## 7. Quy tắc Kiểm thử & Quality Control

```bash
# Backend unit tests
cd ./erp-api && bunx jest src/module-config/

# Backend CI checks
cd ./erp-api && bun run check:ci

# Frontend Type check & Vitest
cd ./erp-web && bun run type:check && bun run test
```
