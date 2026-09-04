---
name: module-config
description: Module tri thức Quản lý Cấu hình Danh mục, Thuộc tính động & Thuộc tính chung Đa Module (Dynamic Module Categories, Custom Fields & Global Attributes) trong erp-api (module-config & bom-config). Chứa toàn bộ database schema (erp_bom_categories, erp_bom_attribute_defs, erp_entity_attribute_values), DTOs, API endpoints, logic phân vùng module_key, Global Attributes auto-inject và tích hợp liên module với Invoices, Bank Transactions, BOM & frontend drawer controls.
---

# 📦 Module Tri Thức: Quản lý Cấu hình Danh mục & Trường tùy chỉnh Đa Module (`module-config`)

## 1. Tổng quan Nghiệp vụ

Module `module-config` cung cấp cơ chế **Dynamic Custom Fields Engine (EAV)** linh hoạt cho toàn bộ hệ sinh thái Liouni ERP:
1. **Thuộc tính theo Danh mục (Category-specific Attributes)**: Admin định nghĩa các Danh mục (Categories) theo `module_key` (như `'INVOICE'`, `'BANK_TXN'`, `'BOM'`). Người dùng chọn Danh mục trên drawer chứng từ để mở ra các trường thuộc tính tương ứng.
2. **Thuộc tính chung (Global Attributes - Toàn phân hệ)**: Admin định nghĩa các thuộc tính cấp module (`is_global = true`, `module_key_global = '<MODULE_KEY>'`, `category_id = NULL`). Các thuộc tính này **tự động hiển thị ngay lập tức** trong Drawer chứng từ của phân hệ mà không cần người dùng chọn danh mục.
3. **Quy tắc i18n, Ràng buộc bắt buộc & Giao diện Neutral**:
   - **Tên Danh mục & Tên Thuộc tính**: Tên trong DB chỉ là *fallback name*. Hệ thống ưu tiên tra cứu khóa i18n trước (`moduleConfig.category.<MODULE_KEY>.<CODE>.name` và `moduleConfig.attr.<MODULE_KEY>.<CATEGORY_OR_GLOBAL>.<CODE>.name`).
   - **Dấu `*` (Asterisk)**: Mọi thuộc tính có `isRequired = true` (cả global và category) đều hiển thị dấu `*` màu `text-destructive`.
   - **Cơ chế Validation Bắt buộc**: Frontend dùng `validateModuleRequiredFields(...)` để chặn submit và hiển thị đồng thời cả Toast lẫn error banner màu đỏ nếu thiếu trường bắt buộc. Backend `saveEntityValues` thực hiện soft check để không làm gián đoạn API của module chính.
   - **Giao diện & Thành phần chuẩn**: Sử dụng màu sắc Neutral (không dùng sky-blue), trường `DATE` dùng component `DatePicker` chuẩn có popup lịch tiếng Việt và format `DD/MM/YYYY`.
   - **Tự động nhúng trong API Response**: `/api/v1/erp-invoices` (cả `findOne` và `findAll` batch load) tự động trả về `category`, `categoryId`, `attributes`, `globalAttributes`, `customAttributes`, và `attributeValues` trực tiếp trong JSON response.

---

## 2. Database Schema & Quan hệ Dữ liệu

### A. Bảng Danh mục Module: `erp_bom_categories`
| Tên cột | Kiểu dữ liệu | Nullable | Ràng buộc / Mặc định | Mô tả |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO | `PK`, `gen_random_uuid()` | Khóa chính |
| `module_key` | `varchar(50)` | NO | Default `'BOM'` | Phân hệ nghiệp vụ (`'BOM'`, `'INVOICE'`, `'BANK_TXN'`) |
| `code` | `varchar(50)` | NO | Composite Unique `(module_key, code)` | Mã danh mục viết hoa (vd: `EXPENSE`, `INTERNAL`, `MOTORCYCLE`) |
| `name` | `varchar(255)` | NO | | Tên hiển thị danh mục (Fallback) |
| `description` | `text` | YES | | Mô tả chi tiết danh mục |
| `is_active` | `boolean` | NO | Default `true` | Trạng thái kích hoạt |
| `is_deleted` | `boolean` | NO | Default `false` | Cờ xóa mềm |
| `created_at` | `timestamptz` | NO | Default `now()` | Thời điểm tạo |
| `updated_at` | `timestamptz` | NO | Default `now()` | Thời điểm cập nhật |

### B. Bảng Định nghĩa Thuộc tính Động: `erp_bom_attribute_defs`
| Tên cột | Kiểu dữ liệu | Nullable | Ràng buộc / Mặc định | Mô tả |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO | `PK`, `gen_random_uuid()` | Khóa chính |
| `category_id` | `uuid` | YES | `FK -> erp_bom_categories(id) ON DELETE CASCADE` | Danh mục sở hữu (NULL nếu `is_global = true`) |
| `is_global` | `boolean` | NO | Default `false` | Cờ xác định thuộc tính chung toàn module |
| `module_key_global` | `varchar(50)` | YES | Index `(module_key_global, code)` | Phân hệ của thuộc tính chung khi `is_global = true` |
| `code` | `varchar(100)` | NO | Unique theo category hoặc module | Mã thuộc tính viết thường/snake_case |
| `name` | `varchar(255)` | NO | | Tên thuộc tính hiển thị (Fallback) |
| `field_type` | `varchar(50)` | NO | `'TEXT'`, `'NUMBER'`, `'SELECT'`, `'DATE'`, `'CHECKBOX'` | Kiểu dữ liệu thuộc tính |
| `options` | `jsonb` | YES | Array of `{ value: string, label: string }` | Danh sách options khi `field_type = 'SELECT'` |
| `sort_order` | `int` | NO | Default `0` | Thứ tự sắp xếp trên giao diện |
| `is_system` | `boolean` | NO | Default `false` | Cờ thuộc tính mặc định hệ thống (không thể xóa, cố định `code` và `field_type`) |
| `is_required` | `boolean` | NO | Default `false` | Bắt buộc nhập liệu trước khi lưu (hiển thị `*`) |
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
| `category_id` | `uuid` | YES | `FK -> erp_bom_categories(id) ON DELETE SET NULL` | ID Danh mục (NULL đối với Global Attributes) |
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
│   ├── create-module-attr-def.dto.ts      # Hỗ trợ isGlobal, moduleKeyGlobal, optional categoryId
│   ├── update-module-attr-def.dto.ts
│   └── save-entity-values.dto.ts          # Hỗ trợ categoryId, attributes & globalAttributes
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
| `GET` | `/global-attribute-defs` | `query: { moduleKey: string }` | Lấy danh sách thuộc tính chung (Global) của 1 module |
| `GET` | `/attribute-defs` | `query: { categoryId?: string, isGlobal?: boolean, moduleKey?: string }` | Lấy danh sách thuộc tính |
| `POST` | `/attribute-defs` | `CreateModuleAttrDefDto` | Tạo thuộc tính (`isGlobal`, `moduleKeyGlobal`, `categoryId`, `code`, `name`, `fieldType`, `options`, `isRequired`) |
| `PATCH` | `/attribute-defs/:id` | `UpdateModuleAttrDefDto` | Cập nhật thuộc tính (chặn đổi `fieldType` nếu đã có dữ liệu nhập) |
| `DELETE` | `/attribute-defs/:id` | `id: UUID` | Xóa mềm thuộc tính (chặn xóa nếu thuộc tính đang được sử dụng) |
| `GET` | `/values/:entityType/:entityId` | `params: { entityType, entityId }` | Lấy danh mục, category attributes, global attributes và danh sách global defs của 1 thực thể |
| `PUT` | `/values/:entityType/:entityId` | `SaveEntityValuesDto` (`categoryId`, `attributes`, `globalAttributes`) | Validate các trường `isRequired` (cả global và category), cập nhật `category_id` và upsert giá trị thuộc tính |

---

## 5. Logic Nghiệp vụ Trọng tâm

1. **Global Attributes vs Category Attributes**:
   - Khi `isGlobal = true`: `categoryId = null`, `moduleKeyGlobal` bắt buộc, `code` duy nhất trong phân hệ `moduleKeyGlobal`.
   - Khi `isGlobal = false`: `categoryId` bắt buộc, `code` duy nhất trong danh mục `categoryId`.
2. **Kiểm tra an toàn kiểu dữ liệu (Data Integrity Guard)**:
   - Khi `fieldType === 'SELECT'`, options trong JSONB phải có `value` và `label` hợp lệ, không được trùng lặp `value`.
   - Không cho phép đổi `fieldType` hoặc `code` của thuộc tính nếu `usageCount > 0` (tính cả `erp_bom_attribute_values` và `erp_entity_attribute_values`).
3. **Transaction lưu trữ thực thể (`saveEntityValues`)**:
   - Validate toàn bộ thuộc tính chung có `isRequired = true` trong module xem đã được điền chưa (bất kể có chọn category hay không).
   - Nếu có `categoryId`: Validate các thuộc tính có `isRequired = true` trong danh mục đó.
   - Chạy transaction: Cập nhật `category_id` trên bảng thực thể (`erp_invoices`, `erp_bank_transactions`, `erp_boms`), xóa các giá trị cũ của `(entity_type, entity_id)` và chèn các giá trị mới cho cả `attributes` và `globalAttributes`.
4. **Bảo vệ Thuộc tính Mặc định Hệ thống (`is_system = true`)**:
   - Thuộc tính có `is_system = true` (như loại phiếu nhập/xuất/lý do điều chỉnh kho) **tuyệt đối không thể xóa** (`BadRequestException`).
   - Cố định trường `code` và `fieldType`, chỉ cho phép cập nhật Tên hiển thị (`name`), Ràng buộc bắt buộc (`isRequired`), và Danh sách tùy chọn (`options`).

---

## 6. Tích hợp Frontend (`erp-web`)

- **`moduleConfigApi.ts`**:
  - Expose API methods: `getCategories()`, `getGlobalAttributeDefs()`, `getAttributeDefs()`, `saveEntityValues()`.
  - Helpers: `resolveCategoryName(cat, t)` và `resolveAttrName(attr, moduleKey, categoryCode, t)`.
- **`ModuleEntityCustomFieldsSection`**:
  - Chia thành **2 Drawer Sections riêng biệt**:
    1. `Thuộc tính chung` (Global Attributes): Tự động fetch và hiển thị mọi active global attribute defs mà không cần chọn danh mục.
    2. `Danh mục & Thuộc tính` (Category Attributes): Combobox chọn danh mục, sau đó hiển thị các thuộc tính con của danh mục.
  - Hỗ trợ dấu `*` Asterisk cho toàn bộ field có `isRequired = true`.
- **`ModuleCustomFieldConfigDrawer`**:
  - Giao diện 2 cột chuẩn ERP:
    - Cột trái: Quản lý cả `Thuộc tính chung (Toàn phân hệ)` (Card trên) và `Danh mục & Thuộc tính danh mục` (Danh sách Card dưới).
    - Cột phải: Live Form Preview mô phỏng tức thì cả 2 section trên Drawer chứng từ thực tế.

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
