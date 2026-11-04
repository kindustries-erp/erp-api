---
name: plop-generate
description: Fast boilerplate code generator for ERP API (erp-api) using PlopJS. Generates V2 core families, thin V2 modules wired into app.module and data-source, V2 facade modules, legacy V1 NestJS modules and TypeORM migrations.
---

# ⚡ Plop Boilerplate Generator Guide (ERP API)

Skill này giúp AI Agent và Developer sinh boilerplate chuẩn cho **`erp-api`** với **0 tốn token** viết code lặp lại. Generator web (`erp-web`) nằm ở skill `plop-generate` của repo `erp-web`.

Chạy từ thư mục `erp/erp-api`. Thứ tự chọn generator cho module V2: họ mới → `api-core`; họ đã có lõi → `api-thin-module`; module đứng riêng → `api-module-v2`. Generator V1 chỉ dùng khi sửa module V1 cũ.

---

## 1. Generator V2 (`src/v2/`)

### 🧬 Generator: `api-core` (Lõi họ V2: khung dùng chung)

Sinh `src/v2/core/<họ>/`: contracts, Base entity, Base create DTO, service nền, module lõi, barrel `index.ts`, spec và `core.manifest.json`. Chỉ sinh khung, không có logic nghiệp vụ.

**Prompts (tương tác):** `familyInput` (kebab-case, ví dụ `customer-claims`), `entityInput` (PascalCase), `styleInput`:
- `engine`: `Base<Họ>EngineService`, dùng cho lõi kiểu voucher (ví dụ `goods-receipts`, `invoices`).
- `abstract-services`: `Abstract<E>CommandService` và query service, dùng cho lõi kiểu `purchase-orders`. Module lõi không đăng ký lớp abstract làm provider (Nest không khởi tạo được lớp abstract).

- Từ chối nếu `src/v2/core/<họ>` đã tồn tại.
- `core.manifest.json` là nguồn duy nhất để `api-thin-module` đọc tên class và kiểu lõi.

### 🧩 Generator: `api-thin-module` (Module V2 mỏng ghép lõi, đầy đủ CRUD)

Sinh 16 file trong `src/v2/modules/<module>/` theo đúng pipeline `api-module-v2` (facade, query/command service, mapper, DTO response/query/update, controller có RBAC, spec co-located, module). Khác với `api-module-v2`:
- Entity và create DTO **kế thừa Base của lõi** (`src/v2/core/<họ>`) và chỉ khai báo cột riêng.
- Command service ghi cả cột lõi và cột riêng qua DTO.
- Module import module lõi.

**Prompts (tương tác):** `coreInput` (họ có `core.manifest.json`), `moduleInput` (kebab-case), `entityInput` (PascalCase), `fieldSpecInput` (trường riêng, cùng cú pháp với `api-module-v2`), `tableNameInput`, `routePathInput`, `permissionResourceInput`, `wireInput`.

- Trường riêng trùng tên với cột của lõi (ví dụ `status` khi lõi đã có) bị từ chối trước khi ghi file, với thông báo tên trường.
- RBAC luôn đăng ký trong `erp-resource.enum.ts`. `wireInput = true` nối `app.module.ts` và `data-source.ts`, chạy lại không nhân đôi.
- Đã kiểm chứng trên `goods-receipts`, `purchase-orders`, `invoices` (wire bật): `tsc` 0 lỗi, 57 test sinh ra pass.

**Hạn chế đã biết:**
- Response và mapper chỉ trả cột riêng cùng `id`, `createdAt`, `updatedAt`. Cột của lõi cần bổ sung vào mapper bằng tay nếu API phải trả về.
- Command service ép kiểu DTO sang entity (`as unknown as DeepPartial`) vì kiểu ngày của lõi là chuỗi. TypeORM nhận chuỗi ISO cho cột timestamptz.
- Logic nghiệp vụ riêng của lõi (ví dụ kiểm tra chuyển trạng thái, đánh số) không được gọi tự động. Gọi tay qua service của lõi khi cần.

### 📦 Generator: `api-module-v2` (Module API v2 đứng riêng: Facade + sub-services + spec)

Sinh module theo kiến trúc v2 (Facade, sub-services Query/Command, mapper, response DTO, controller có RBAC `ErpResource`/`ErpAction`, spec co-located). Quy ước và bẫy xem skill [`api-structure`](../api-structure/SKILL.md).

```bash
bunx plop api-module-v2 <module-core> <Entity> "<fieldSpec>" "<tableName>" "<routePath>" "<permissionResource>" <wire>
# Ví dụ:
bunx plop api-module-v2 customer-claims-core CustomerClaim "code:string:required,amount:decimal,status:status" "" "" "" false
```

- Tham số theo thứ tự: `moduleInput`, `entityInput`, `fieldSpecInput`, `tableNameInput`, `routePathInput`, `permissionResourceInput`, `wireInput`. Chuỗi rỗng = mặc định.
- `wire = true`: nối vào `app.module.ts` và `data-source.ts`. Resource RBAC luôn được đăng ký trong `erp-resource.enum.ts`.
- Input sai bị chặn trước khi ghi file nào.
- Test generator: `bun test plop-helpers`.
- Hợp đồng sinh ra: list `{ items, total, page, pageSize, totalPages, summaries }`, bản ghi đơn `{ message, data }`, `GET column-options` và lọc/sắp xếp/tổng qua `src/common/utils/table-query/`. Chi tiết xem `api-structure` mục 2b.
- Cột `number`/`decimal` được cộng vào `summaries` (SUM trên toàn bộ dòng khớp bộ lọc).
- Resource RBAC đã có trong enum thì generator không chèn lại (`enumEntryExists`).
- Entity nullable (`string | null`) được map sang `undefined` trong response.
- Module đã có entity/service cũ: không chạy trực tiếp lên thư mục đó. Làm theo `api-structure` mục 3b.

### 🧱 Generator: `api-voucher-v2` (Chứng từ Header + Lines, không có lõi)

Giữ nguyên để tương thích. Khi họ đã có `src/v2/core/<họ>/core.manifest.json`, generator chỉ in cảnh báo: dùng `api-thin-module` thay cho module đứng riêng.

---

## 2. Generator V1 (legacy, `src/<module>/`) [LEGACY-V1]

Chỉ dùng khi sửa module V1 cũ. Module V2 mới không dùng các generator này.

### 🚀 `api-module` [LEGACY-V1] (Full NestJS Module chuẩn, V1)

Sinh ra:
1. `src/[module]/entities/[entity].entity.ts` (TypeORM entity có UUID, timestamps, soft delete)
2. `src/[module]/dto/create-[entity].dto.ts` (Class validator + Swagger)
3. `src/[module]/dto/update-[entity].dto.ts`
4. `src/[module]/[module].service.ts` (Pagination, Filter, Search, Sort & `getColumnOptions`)
5. `src/[module]/[module].controller.ts` (Auth & RBAC Guards + Swagger)
6. `src/[module]/[module].module.ts`

```bash
bun plop api-module <moduleName> <entityName> <tableName> <routePath> <permissionResource> <prefix> <hasAmount>
bun plop api-module customer-claims-core CustomerClaim erp_customer_claims customer-claims customer_claims CLM true
```

---

## 3. Migration

### 🗄️ `api-migration` (TypeORM Database Migration)

Sinh ra: `src/migrations/<timestamp>-<migrationName>.ts`

```bash
bun plop api-migration <migrationName> <tableName>
bun plop api-migration CreateCustomerClaims erp_customer_claims
```

---

## 4. Quy trình Đề xuất cho Agent

Khi nhận yêu cầu tạo module API mới:
1. **Kiểm tra họ**: họ đã có `src/v2/core/<họ>` chưa. Chưa có thì chạy `api-core`. Đã có thì dùng `api-thin-module`.
2. **Chạy Plop generator tương ứng** để tạo boilerplate chuẩn.
3. **Review và customize** các trường và nghiệp vụ riêng. Nếu không bật `wire`, import module vào `app.module.ts` và đăng ký data-source thủ công.
4. **Kiểm tra**: `bun run type:check` và `bunx jest <đường dẫn module>` (chỉ chạy scope hẹp, không chạy full test ở local).
