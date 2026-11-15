---
name: branches-core
description: Contract hiện hành của chi nhánh ERP trong kiến trúc API v2 core + management module.
---

# Chi nhánh ERP

## Vị trí và phụ thuộc

- Core: `src/v2/core/branches-core/`; HTTP: `src/v2/modules/branches-management/`.
- `src/app.module.ts` chỉ đăng ký `BranchesManagementModule`. Module core có `TypeOrmModule.forFeature([ErpBranch])`, query/command và `BranchesCoreService` facade; module HTTP import core và expose duy nhất `ErpBranchController`.
- Entity canonical duy nhất nằm tại `src/v2/core/branches-core/entities/erp_branch.entity.ts`. Các entity ngân hàng, cash book, accounting, operating expenses, invoice và `src/db/data-source.ts` import trực tiếp từ đường dẫn v2. Không duy trì source tree hay compatibility import tại `src/branches-core`.

## Database

`erp_branches`: `id uuid`, `code varchar(100) UNIQUE`, `name varchar(255)`, `address text NULL`, `is_active boolean DEFAULT true`, `created_at`, `updated_at` (timestamp without time zone). Không có `is_deleted`, không có migration khi chuyển v2. Bank accounts, bank transactions, cash books, journal entries, operating expenses có FK chi nhánh `ON DELETE NO ACTION`; xóa bản ghi được tham chiếu có thể bị PostgreSQL từ chối.

## HTTP contract (route `/api/v2/branches`)

Toàn bộ dưới `/api/v2/branches`, guard `JwtAuthGuard` duy nhất và Swagger tag `erp_branches`:

| Method | Path | Response |
| --- | --- | --- |
| GET | `/` | `{items,total,page,pageSize,totalPages}`; `PaginationDto` mặc định page 1, pageSize 20; tìm code/name bằng ILIKE, sort whitelist `createdAt,code,name` (alias `created_at`), mặc định createdAt DESC; không lọc inactive |
| POST | `/` | HTTP 201 `{data: ErpBranchResponseDto,message:'Branch created successfully'}` |
| PATCH | `/:id` | HTTP 200 `{data: ErpBranchResponseDto \| null,message:'Branch updated successfully'}`; ID không có trả `data:null` |
| DELETE | `/:id` | HTTP 200 `{message:'Branch deleted successfully'}`; hard-delete, không kiểm tồn tại trước |

Response entity JSON giữ `id`, `code`, `name`, `address` (giữ `null`), `isActive` (camelCase), `createdAt`, `updatedAt` (ISO qua JSON). POST/PATCH chỉ ghi `code`, `name`, `is_active` (map sang `isActive`).

Client `erp-web` (`src/modules/branches/api/branchApi.ts`, `normalizeBranch`) đọc `isActive` trước, fallback `is_active` nếu phản hồi cũ; thiếu cả hai thì coi là active. Đừng đổi response sang `is_active` để "khớp" UI.

**Body POST/PATCH (đã siết, follow-up `branches-core-v2-followup`)**: validate qua `ParseBranchBodyPipe(CreateErpBranchDto | UpdateErpBranchDto)` gắn ở tham số `@Body()`, không dùng `ValidationPipe` toàn cục trên body.
- POST: `code` và `name` là chuỗi không rỗng (tối đa 100 và 255); `is_active` tùy chọn nhưng phải là boolean.
- PATCH: mọi field tùy chọn; field có mặt thì phải hợp lệ, kể cả `null` đều bị 400.
- Field thừa (ví dụ `address`, `foo`) bị bỏ, không trả 400.
- Input sai trả 400 (trước đây là 500 do lỗi DB). Chuỗi `is_active` như `"true"` cũng trả 400 vì không còn ép kiểu. UI gửi boolean thật (`BranchFormDrawer`, `BranchTab`).
- Đây là thay đổi hành vi có chủ đích với input sai; payload hợp lệ của UI không đổi.

Không thêm `CoreRbacGuard`, `ParseUUIDPipe`, endpoint chi tiết, column-options, `summaries`, soft-delete, đổi HTTP lỗi hoặc route `/api/v2/branches` khi chưa có yêu cầu contract riêng. `DELETE /:id` hard-delete là ngoại lệ legacy, không áp dụng cho module mới.

## Kiểm chứng

`src/v2/modules/branches-management/branches-management.contract.spec.ts` khóa HTTP contract (dùng mock repository, không ghi DB). Các spec co-located ở hai thư mục v2 phủ query, command, mapper, facade, controller, DI và route. Chạy Jest theo phạm vi trên, `bun run type:check`, scanner `--strict` cho hai thư mục, lint/format, `bun run build`. DB runtime xác nhận qua `.env` và `SELECT current_database()` trước bất kỳ thao tác DB.

## extraData (JSON tùy biến, 2026-11-08)

- **DB**: cột `extra_data jsonb NOT NULL DEFAULT '{}'` (CHECK: object) trên: `erp_branches`. Migration `20261108120000-add-extra-data-to-v2-tables.ts`. Dữ liệu cũ là `{}`.
- **DTO**: field `extraData?: Record<string, unknown>` (`@ExtraDataField()`, base-core). Không gửi thì không đổi.
- **Ghi**: tạo mặc định `{}`. Sửa header merge cấp 1 (`null` xóa key). Dòng chứng từ ghi theo payload, không merge.
- **Giới hạn**: 16 KB, sâu 5 cấp, key ≤ 64 ký tự, cấm `__proto__`/`constructor`/`prototype` (400 qua `RejectUnsafeExtraDataPipe` và service).
- **Response**: luôn có `extraData` (object).

## Hợp đồng phân trang chuẩn v2 (pagination)

- List trả `{ items, pagination, summaries? }`; `pagination` = `{ page, pageSize, total, totalPages, next, previous }` (`next`/`previous` là số trang hoặc `null`). Không còn key phẳng `total`/`page`/`totalPages` ở cấp gốc.
- Column-options trả `{ items: { label, value }[], pagination }`. Dựng bằng `findTableColumnOptions` hoặc `emptyOptionsPage` (`src/common/utils/table-query`).
- Builder: `buildPagination` / `toPagedList` / `toPaginatedResult` (`src/common/utils/paginated-result.ts`). DTO Swagger: `PaginationMetaDto`, `ColumnOptionsResponseDto`.
- Web phải đọc `res.pagination.*`. Xem web `src/v2/shared/utils/v2FetchOptionsAdapter.ts`.
