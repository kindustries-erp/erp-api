---
name: plop-generate
description: Fast boilerplate code generator for ERP Web and ERP API using PlopJS. Generates standardized Table Pages, Drawers, Modals, Table Sections, NestJS API Modules, and Migrations with 1 command.
---

# ⚡ Plop Boilerplate Generator Guide

Skill này giúp AI Agent và Developer tự động sinh boilerplate code chuẩn cho **`erp-web`** và **`erp-api`** với **0 tốn token** viết code lặp lại.

---

## 🌐 1. ERP Web Generators (`erp-web/`)

Chạy từ thư mục `/home/dev/repos/erp/erp-web`:

### 📄 Generator 1: `table-page` (Toàn bộ module Table Page + API + Hook + Drawer + Locales)

Sinh ra 6 files chuẩn hệ thống:
1. `src/modules/[module]/api/[component]Api.ts` (CRUD + `getColumnOptions`)
2. `src/modules/[module]/hooks/use[Component]List.ts` (Server-side query + responsive pageSize)
3. `src/modules/[module]/components/[Component]Tab.tsx` (SpreadsheetPageTemplate + TableColumnHeaderFilter + rowActions)
4. `src/modules/[module]/components/[Component]DetailDrawer.tsx` (StandardFormDrawer)
5. `src/modules/[module]/locales/vi.ts`
6. `src/modules/[module]/locales/en.ts`

**Cách chạy không cần tương tác (Non-interactive):**
```bash
bun plop table-page <moduleName> <componentName> "<pageTitle>" <tableId> <drawerType> <drawerSize> <hasDateColumn> <hasAmountColumn> <hasStatusColumn>
```

**Ví dụ:**
```bash
bun plop table-page purchase-orders-core PurchaseOrder "Đơn mua hàng" po-table multi-tab xl true true true
```

---

### 📑 Generator 2: `drawer` (Standalone StandardFormDrawer)

Sinh ra: `src/modules/[module]/components/[Component]Drawer.tsx`

**Cách chạy:**
```bash
bun plop drawer <moduleName> <componentName> <drawerType> <drawerSize> <hasStatus>
```

**Ví dụ:**
```bash
bun plop drawer sales-orders-core CustomerSelect 2-columns lg true
```

---

### 🪟 Generator 3: `modal` (Dialog Modal chuẩn Radix/Shadcn & Glassmorphism)

Sinh ra: `src/modules/[module]/components/[Component]Modal.tsx`

**Cách chạy:**
```bash
bun plop modal <moduleName> <componentName> <modalType> <modalSize>
```

- `modalType`: `form` hoặc `confirm`
- `modalSize`: `sm` (360px), `md` (480px), `lg` (560px), `xl` (680px)

**Ví dụ:**
```bash
bun plop modal erp-invoices-core ConfirmCancel confirm sm
```

---

### 📊 Generator 4: `table-section` (Bảng dữ liệu nhúng cho Drawer / Section)

Sinh ra: `src/modules/[module]/components/[Component]Section.tsx`

**Cách chạy:**
```bash
bun plop table-section <moduleName> <componentName> <rowTypeName>
```

**Ví dụ:**
```bash
bun plop table-section goods-issues-core IssueLineItems IssueLineItem
```

---

## ⚙️ 2. ERP API Generators (`erp-api/`)

Chạy từ thư mục `/home/dev/repos/erp/erp-api`:

### 🚀 Generator 1: `api-module` (Full NestJS Module chuẩn)

Sinh ra:
1. `src/[module]/entities/[entity].entity.ts` (TypeORM entity có UUID, timestamps, soft delete)
2. `src/[module]/dto/create-[entity].dto.ts` (Class validator + Swagger)
3. `src/[module]/dto/update-[entity].dto.ts`
4. `src/[module]/[module].service.ts` (Pagination, Filter, Search, Sort & `getColumnOptions`)
5. `src/[module]/[module].controller.ts` (Auth & RBAC Guards + Swagger)
6. `src/[module]/[module].module.ts`

**Cách chạy:**
```bash
bun plop api-module <moduleName> <entityName> <tableName> <routePath> <permissionResource> <prefix> <hasAmount>
```

**Ví dụ:**
```bash
bun plop api-module customer-claims-core CustomerClaim erp_customer_claims customer-claims customer_claims CLM true
```

---

### 🗄️ Generator 2: `api-migration` (TypeORM Database Migration)

Sinh ra: `src/migrations/<timestamp>-<migrationName>.ts`

**Cách chạy:**
```bash
bun plop api-migration <migrationName> <tableName>
```

**Ví dụ:**
```bash
bun plop api-migration CreateCustomerClaims erp_customer_claims
```

---

## 🎯 3. Quy trình Đề xuất cho Agent

Khi nhận yêu cầu tạo màn hình hoặc module mới:
1. **Chạy Plop generator tương ứng** bằng `run_command` để tạo toàn bộ boilerplate chuẩn trong < 1 giây.
2. **Review và customize các fields đặc thù** nếu có nghiệp vụ riêng.
3. **Đăng ký PageKey và Navigation** (cho web) hoặc **import vào `app.module.ts`** (cho api).
4. **Kiểm tra TypeScript compile**: `bun run type:check`.
