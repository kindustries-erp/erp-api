---
name: branches-core
description: Contract hiện hành của chi nhánh ERP trong kiến trúc API v2 core + management module.
---

# Chi nhánh ERP

## Vị trí và phụ thuộc

- Lõi `src/v2/core/branches-core/` **chỉ là base** (style `v2-core`, `module: null`): `BaseBranchEntity`, `BaseBranchExternalLinkEntity` (không `@Entity`), `AbstractBranchQueryService`, `AbstractBranchCommandService`, contract `BranchRef`/`BranchInput`/`BranchReferencePort`. Không có Nest module, controller hay bảng.
- Module `src/v2/modules/branches-management/` là điểm bắt đầu của DB và API: `BranchManagement` (`@Entity('branches_management')`), `BranchManagementExternalLink` (`@Entity('branches_management_external_links')`), `BranchManagementQueryService`/`CommandService` (kế thừa lõi), `BranchReferenceService` (cài `BranchReferencePort`, biết các bảng tham chiếu; thêm bảng mới ở đây), `BranchExternalLinkService`, `BranchesManagementService` (facade), controller `ErpBranchController`, script `scripts/seed-kgara-branches.ts`.
- `src/app.module.ts` chỉ đăng ký `BranchesManagementModule`. Entity consumers (ngân hàng, cash book, accounting, operating expenses, invoice, `src/db/data-source.ts`) import `BranchManagement` từ `@/v2/modules/branches-management/entities/branch-management.entity`. Lõi `employees-core` không import module: dùng quan hệ chuỗi `@ManyToOne('BranchManagement')` và kiểu `BranchRef` của lõi.

## Database

`branches_management` (đổi tên từ `erp_branches` ở migration `20261118100000`, giữ nguyên id/dữ liệu): `id uuid`, `extra_data jsonb`, `created_at`/`updated_at` **timestamptz**, `is_deleted boolean DEFAULT false` (index), `code varchar(100)`, `name varchar(255)`, `address text NULL`, `is_active boolean DEFAULT true`. `code` duy nhất một phần: `UQ_branches_management_code_active WHERE is_deleted = false`.

- FK trỏ vào bảng (`NO ACTION`): `erp_bank_accounts`, `erp_bank_transactions`, `erp_cash_books`, `erp_journal_entries`, `erp_operating_expenses`, `employees_management`; từ migration `20261118100100` thêm `branch_id` nullable ở `debts_garage`, `debt_allocations_garage`, `cashflow_vouchers_garage` (chưa dùng để lọc, `branch_external_id` giữ nguyên).
- View tương thích `erp_branches` (đọc/ghi được, chỉ dòng chưa xóa mềm) giữ cho bản code cũ trong lúc deploy; code mới không dùng. Xóa view bằng migration riêng ở release sau.
- `branches_management_external_links`: `branch_id` FK, `source` (ví dụ `KGARA`), `external_id`, `account_key` (mặc định `''`), `is_deleted`; unique một phần `(source, external_id, account_key) WHERE is_deleted = false`. GR/MAIN và GN(CN2)/OJ dùng chung `external_id` Kgara nên phân biệt bằng `account_key`.

## HTTP contract (route `/api/v2/branches`)

Toàn bộ dưới `/api/v2/branches`, guard `JwtAuthGuard` duy nhất và Swagger tag `branches_management`:

| Method | Path | Response |
| --- | --- | --- |
| GET | `/` | `{items,pagination}` (xem mục phân trang); `PaginationDto` mặc định page 1, pageSize 20; tìm code/name bằng ILIKE, sort whitelist `createdAt,code,name` (alias `created_at`), mặc định createdAt DESC; chỉ bản ghi chưa xóa mềm, không lọc inactive |
| POST | `/` | HTTP 201 `{data: ErpBranchResponseDto,message:'Branch created successfully'}` |
| PATCH | `/:id` | HTTP 200 `{data: ErpBranchResponseDto \| null,message:'Branch updated successfully'}`; ID không có hoặc đã xóa mềm trả `data:null`, không ghi |
| DELETE | `/:id` | HTTP 200 `{message:'Branch deleted successfully'}`; **xóa mềm** (`is_deleted=true`, `is_active=false`). 404 khi không có hoặc đã xóa mềm; **409** `{message, references:[{table,count}]}` khi còn bản ghi tham chiếu (6 bảng ở trên cộng 3 bảng garage v2; nhân viên/phiếu/công nợ đã xóa mềm không chặn) |

Response entity JSON giữ `id`, `code`, `name`, `address` (giữ `null`), `isActive` (camelCase), `createdAt`, `updatedAt` (ISO qua JSON). POST/PATCH chỉ ghi `code`, `name`, `is_active` (map sang `isActive`).

Client `erp-web` (`src/modules/branches/api/branchApi.ts`, `normalizeBranch`) đọc `isActive` trước, fallback `is_active` nếu phản hồi cũ; thiếu cả hai thì coi là active. Đừng đổi response sang `is_active` để "khớp" UI.

**Body POST/PATCH (đã siết, follow-up `branches-core-v2-followup`)**: validate qua `ParseBranchBodyPipe(CreateErpBranchDto | UpdateErpBranchDto)` gắn ở tham số `@Body()`, không dùng `ValidationPipe` toàn cục trên body.
- POST: `code` và `name` là chuỗi không rỗng (tối đa 100 và 255); `is_active` tùy chọn nhưng phải là boolean.
- PATCH: mọi field tùy chọn; field có mặt thì phải hợp lệ, kể cả `null` đều bị 400.
- Field thừa (ví dụ `address`, `foo`) bị bỏ, không trả 400.
- Input sai trả 400 (trước đây là 500 do lỗi DB). Chuỗi `is_active` như `"true"` cũng trả 400 vì không còn ép kiểu. UI gửi boolean thật (`BranchFormDrawer`, `BranchTab`).
- Đây là thay đổi hành vi có chủ đích với input sai; payload hợp lệ của UI không đổi.

Không thêm `CoreRbacGuard`, `ParseUUIDPipe`, endpoint chi tiết, column-options, `summaries` hoặc đổi route `/api/v2/branches` khi chưa có yêu cầu contract riêng. JWT-only và body không siết `ValidationPipe` vẫn là ngoại lệ legacy, không áp dụng cho module mới.

## Kiểm chứng

`src/v2/modules/branches-management/branches-management.contract.spec.ts` khóa HTTP contract (dùng mock repository, không ghi DB). Spec co-located ở lõi và module phủ query, command, reference, external link, mapper, facade, controller, DI, route và script seed; migration có spec riêng (`src/migrations/20261118*.spec.ts`). Chạy Jest theo phạm vi trên, `bun run type:check`, scanner `--strict` cho hai thư mục, lint/format, `bun run build`. DB runtime xác nhận qua `.env` và `SELECT current_database()` trước bất kỳ thao tác DB.

## Seed Kgara -> chi nhánh hệ thống

`bun src/v2/modules/branches-management/scripts/seed-kgara-branches.ts .env.<tenant>-<stage> [--apply --confirm=<tên DB>]`: tạo chi nhánh `GR` (GREENWAY AUTO, MAIN) và `GN` (GREENWAY AUTO - CN2, OJ) cho các cặp `(external_id, account_key)` thật sự có vụ việc trong `kgara_cases`, kèm liên kết `KGARA`. Mặc định dry-run (rollback), idempotent. Đã chạy trên staging 2026-11-18. Chưa đổi logic lọc/ghi garage sang `branch_id`.

## extraData (JSON tùy biến, 2026-11-08)

- **DB**: cột `extra_data jsonb NOT NULL DEFAULT '{}'` (CHECK: object) trên: `branches_management`. Migration `20261108120000-add-extra-data-to-v2-tables.ts`. Dữ liệu cũ là `{}`.
- **DTO**: field `extraData?: Record<string, unknown>` (`@ExtraDataField()`, base-core). Không gửi thì không đổi.
- **Ghi**: tạo mặc định `{}`. Sửa header merge cấp 1 (`null` xóa key). Dòng chứng từ ghi theo payload, không merge.
- **Giới hạn**: 16 KB, sâu 5 cấp, key ≤ 64 ký tự, cấm `__proto__`/`constructor`/`prototype` (400 qua `RejectUnsafeExtraDataPipe` và service).
- **Response**: luôn có `extraData` (object).

## Hợp đồng phân trang chuẩn v2 (pagination)

- List trả `{ items, pagination, summaries? }`; `pagination` = `{ page, pageSize, total, totalPages, next, previous }` (`next`/`previous` là số trang hoặc `null`). Không còn key phẳng `total`/`page`/`totalPages` ở cấp gốc.
- Column-options trả `{ items: { label, value }[], pagination }`. Dựng bằng `findTableColumnOptions` hoặc `emptyOptionsPage` (`src/common/utils/table-query`).
- Builder: `buildPagination` / `toPagedList` / `toPaginatedResult` (`src/common/utils/paginated-result.ts`). DTO Swagger: `PaginationMetaDto`, `ColumnOptionsResponseDto`.
- Web phải đọc `res.pagination.*`. Xem web `src/v2/shared/utils/v2FetchOptionsAdapter.ts`.
