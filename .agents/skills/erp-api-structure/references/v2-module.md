
# Kỹ Năng API v2 Refactor (`erp-api`)

Workflow đầy đủ: [`../../../workflows/api-structure.md`](../../../workflows/api-structure.md). Skill này là checklist và quy ước để thực thi workflow.

## 0. Vị trí

Kiến trúc API V2 được tổ chức phân cấp tương tự Web V2 (`erp-web/src/v2/`):
- **Core Foundations & Shared Engines**: Nằm trong `src/v2/core/<core-name>/` (vd: `src/v2/core/goods-receipts-core/` chứa Base Voucher Engine, shared voucher contracts).
- **Business Modules**: Nằm trong `src/v2/modules/<module-name>/` (vd: `src/v2/modules/goods-receipts-garage/`).
- Tách biệt hoàn toàn khỏi các module V1 legacy (`src/<module>-core/`). Import trong module dùng alias `@/` (`@/common`, `@/auth`, `@/rbac-core`, `@/v2/core/...`). Generator `api-module-v2` và `api-voucher-v2` tự sinh đúng vị trí `src/v2/modules/...` và wiring `./v2/modules/...`.

## 0a. Quy ước đặt tên thư mục v2

- **Lõi** `src/v2/core/<họ>-core/`: tên luôn kết thúc `-core`. Generator `api-core` nhận tên có hoặc không có `-core` và tự thêm hậu tố. Tên class (`<Họ>CoreModule`, `Base<Entity>...`) và tên file service giữ theo phần gốc, không nhân đôi `-core`.
- **Module** `src/v2/modules/<gốc>-<biến thể>/`: biến thể đặt ở hậu tố, ví dụ `procurement-orders-garage`, `procurement-orders-erp`, `invoices-finance`. Không dùng tiền tố `erp-`, `garage-`, `finance-`. `rbac` là tên miền (quản trị quyền), không phải tiền tố biến thể, nên module quản trị role là `rbac-roles`. Module không có biến thể (`business-partners-management`, `purchase-orders`) giữ nguyên.
- **Hợp đồng không đổi khi đổi tên thư mục**: route (`@Controller`), `permissionPattern` và `ErpResource`, tên bảng (`@Entity`), tên class và symbol trong barrel. Khi triển khai module đã có, truyền tường minh `tableNameInput`, `routePathInput`, `permissionResourceInput` cho generator; không để generator suy ra từ tên thư mục.
- Generator `api-voucher-v2` vẫn chuẩn hóa tên module thành `<gốc>-core`. Module đổi tên theo quy ước trên không đi qua generator này; khi tạo module mới theo quy ước suffix, đặt tên theo `<gốc>-<biến thể>` và kiểm tra lại `moduleName`/`moduleBase` sinh ra.

## 1. Quy ước v2

| Lớp | File | Quy tắc |
| :--- | :--- | :--- |
| Entity | `entities/*.entity.ts` | Kế thừa chuỗi base trong `src/v2/core/base-core` (xem mục 1b). Cột snake_case qua `name:`; cờ `isDeleted` (không dùng `DeleteDateColumn`) |
| DTO vào | `dto/create-*.dto.ts`, `update-*` (PartialType), `query-*` (PaginationDto) | class-validator + Swagger |
| DTO ra | `dto/*-response.dto.ts` | Không trả entity ra ngoài module |
| Mapper | `helpers/*.mapper.ts` | Hàm thuần. Hai chiều: entity→response, DTO→entity (bỏ `undefined`) |
| Đọc | `services/*-query.service.ts` | Chỉ đọc, lọc `isDeleted = false` |
| Ghi | `services/*-command.service.ts` | create / update / softDelete / hardDelete (có điều kiện, xem `api-structure` Phần B mục "Chính sách xóa") |
| Facade | `<module>.service.ts` | Điều phối, `NotFoundException`, luôn trả response DTO |
| Controller | `controllers/*.controller.ts` | `@RequirePermissions({ resource: ErpResource.X, action: ErpAction.READ\|CREATE\|UPDATE\|DELETE\|PURGE })`; xóa cứng dùng `PURGE` và route `:id/permanent` |

Enum quyền: `src/v2/core/rbac-core/enums/erp-action.enum.ts` (`ErpAction`), `src/v2/core/rbac-core/enums/erp-resource.enum.ts` (`ErpResource`), xuất qua `@/v2/core/rbac-core`. Không dùng chuỗi literal cho quyền.

## 1b. Chuỗi base chung và `extraData`

Lõi `src/v2/core/base-core` (barrel `@/v2/core/base-core`) là chuỗi entity nền dùng chung. Mỗi lớp thêm đúng một nhóm cột:

| Lớp | Cột thêm | Dùng cho |
| :--- | :--- | :--- |
| `CoreBaseEntity` | `id` (uuid), `extra_data` (jsonb, mặc định `{}`) | danh mục, dòng không có timestamp, lõi không xóa mềm |
| `CoreAuditedEntity` | `created_at`, `updated_at` (timestamptz) | dòng chứng từ |
| `CoreSoftDeletableEntity` | `is_deleted` (có `@Index`) | entity module v2 (plop `module-v2`) |
| `CoreHeaderEntity` | `status` (mặc định `DRAFT`), `created_by` | header chứng từ có vòng đời (plop `workflow-common`) |

- TypeORM 0.3: khi cột trùng tên, **cột của lớp cha thắng**. Entity legacy có cột `timestamp` (hóa đơn, dòng hóa đơn, chi nhánh, đối tác) chỉ kế thừa `CoreBaseEntity` và giữ khai báo riêng, không override.
- `extraData` là dữ liệu tùy biến để bổ sung field sau này mà không đổi cột cũ. Quy tắc:
  - DTO create/update khai báo bằng `@ExtraDataField()` (`base-core/dto/extra-data.decorator.ts`); client cũ không gửi field vẫn hợp lệ.
  - Tạo: không gửi thì lưu `{}`.
  - Sửa header/danh mục: **merge cấp 1** qua `mergeExtraData` (`base-core/helpers/extra-data.util.ts`); giá trị `null` xóa key; không gửi field thì giữ nguyên.
  - Dòng chứng từ được thay theo bộ nên ghi theo payload, không merge.
  - Giới hạn (`assertValidExtraData`, 400 khi vi phạm): object, tối đa 16 KB, sâu 5 cấp, key tối đa 64 ký tự, cấm `__proto__`, `constructor`, `prototype`.
  - Chặn ở hai lớp: `RejectUnsafeExtraDataPipe` (`base-core/pipes`, đăng ký trong `main.ts` TRƯỚC ValidationPipe) kiểm body thô, vì ValidationPipe của Nest tự xóa key `__proto__` mà không báo lỗi; và service kiểm lại cho mọi caller không đi qua HTTP.
  - Logic kiểm và merge nằm ở lớp command/service, không ở controller. Response luôn trả `extraData` là object (không null).
- Migration thêm cột: `ADD COLUMN IF NOT EXISTS "extra_data" jsonb NOT NULL DEFAULT '{}'::jsonb` kèm `CHECK (jsonb_typeof("extra_data") = 'object')`. Không đổi kiểu cột cũ.

## 2. Kiểu trường (`fieldSpec`)

| Kiểu | Cột TypeORM | DTO vào | Ghi chú |
| :--- | :--- | :--- | :--- |
| `string` | varchar(255) | `string` | Tham gia ô tìm kiếm chung |
| `text` | text | `string` | Tham gia ô tìm kiếm chung |
| `number` | integer | `number` | |
| `decimal` | numeric(18,2) | `number` | Entity giữ `string` (TypeORM); response ép `number` |
| `boolean` | boolean, default false | `boolean` | |
| `date` | timestamptz | `string` (ISO) | DTO→entity đổi thành `Date` |
| `status` | varchar(50), default `ACTIVE` | `string` ∈ `ACTIVE/INACTIVE` | Sửa danh sách giá trị thủ công nếu nghiệp vụ khác |

## 2b. Hợp đồng HTTP (đã chốt, khớp web v2)

| Endpoint | Response |
| :--- | :--- |
| `GET /` (list) | `{ items, total, page, pageSize, totalPages, summaries }` |
| `GET /:id` | `{ message, data: ResponseDto }` |
| `POST /` | `{ message, data: ResponseDto }` |
| `PATCH /:id` | `{ message, data: ResponseDto }` |
| `DELETE /:id` (xóa mềm) | `{ message, data: ResponseDto }` |
| `GET /column-options` | `{ items: [{label, value}], total, next }` |

- **Lọc, sắp xếp, tổng** dùng helper chung `src/common/utils/table-query/` (`applyTableFilters`, `applyTableSort`, `findTableColumnOptions`, `computeTableSummaries`). Whitelist cột sinh từ fieldSpec (`TABLE_COLUMNS`), có cả key camelCase và snake_case. Kiểu cột quyết định toán tử hợp lệ: `text`/`status` (contains, equals, is_empty...), `number` (eq, gt, between...), `date` (eq, before, after, between). Toán tử sai kiểu bị bỏ qua.
- **`summaries`**: SUM của mọi cột `number`/`decimal` trên toàn bộ dòng khớp bộ lọc (không phân trang). Key là tên trường, khớp `V2Column.key` phía web. Tổng được tính trước khi phân trang.
- **`DTO query`** kế thừa `TableQueryDto` (`src/common/dto/table-query.dto.ts`), gồm `column_filters`, `column_search`, `column_operators`, `date_ranges`, `date_from`, `date_to`, `sort`, `search`.
- **Route tĩnh** (`column-options`, và `next-code` khi module cần) đặt trước `:id`, nếu không `ParseUUIDPipe` trả 400.

## 3. Bẫy đã gặp (đã xử lý trong generator)

1. **Plop ghi đè dữ liệu bằng giá trị prompt rỗng.** Node-plop chỉ copy `data` của action khi key chưa có trong câu trả lời. Vì vậy prompt phải dùng hậu tố `Input` (`tableNameInput`, `moduleInput`, …) để không trùng key dữ liệu đã tính.
2. **`Object.assign` với `undefined` xóa dữ liệu cũ.** Mapper `to<Entity>EntityFields` đã lọc `undefined`. Không bỏ bước này.
3. **Import thừa làm lint lỗi** (`--max-warnings=0`). Generator tính import theo đúng decorator được dùng.
4. **Decimal nullable** trả `undefined`, không `Number(null)` (sẽ ra `0`).
5. **Handlebars escape** mặc định làm hỏng dấu `'` và `"`. Template dùng `{{{ }}}` cho đoạn code.
6. **`@Entity('')` hoặc `@Controller('')`** xuất hiện nếu bỏ qua mặc định. Đã có fallback trong `apiV2Data.mjs`.
7. **Envelope không đồng nhất (G1).** Facade trả `{ message, data }` cho bản ghi đơn, khớp web v2 và V1. Trước đây facade trả DTO phẳng nên module sinh ra không chạy được với web.
8. **Thiếu `totalPages` (G2)** đã được bổ sung ở facade.
9. **Bảng không lọc được (G3)** vì query service chỉ có `search`. Nay mọi toán tử và `date_ranges` đi qua helper chung.
10. **Summary row luôn 0 (G4).** Nay `summaries` được trả từ API.
11. **Trùng `ErpResource` (G5).** Generator bỏ qua chèn khi key hoặc value đã có trong `erp-resource.enum.ts` (`enumEntryExists`), nên module cũ có sẵn resource không bị lỗi tsc.
12. **Thứ tự route (G6)** xử lý như mục 2b.
13. **Mapper trả `null` (nullable).** Entity nullable (`string | null`) sinh mapper `?? undefined`, khớp response DTO optional. Trước đây tsc lỗi.

## 3b. Chuyển module cũ có sẵn entity/service (G7)

Generator không ghi đè file đã có (`plop add` lỗi). Trình tự đã dùng cho `business-partners-core`:

1. Lưu bản gốc của file cũ ra ngoài repo (scratchpad) để đối chiếu hợp đồng. Không để `*.legacy.ts` trong `src/` vì tsc sẽ lỗi.
2. Xóa các file cũ trùng tên với generator (`<module>.service.ts`, `<module>.module.ts`, `<module>.controller.ts`, spec của service). Giữ entity cũ.
3. Chạy generator với entity tên `ErpBusinessPartner` và `wire=false`.
4. Xóa entity do generator sinh (`entities/erp-*.entity.ts`), trỏ import về entity cũ (`entities/erp_*.entity.ts`). Tên class phải giữ nguyên, nếu không TypeORM đăng ký hai entity cùng tên.
5. Viết lại nghiệp vụ ở command/query/facade (mã tự sinh, kiểm tra trùng, normalize). Nghiệp vụ này nằm ngoài generator.
6. Xóa DTO cũ không còn dùng.

## 4. Checklist sau khi sinh

- [ ] `bunx prettier --write "src/v2/<module>-core/**/*.ts"`
- [ ] Nếu module có cột số: `summaries` có trong response list (không thì web không có ô tổng)
- [ ] Route không trùng controller khác (`grep -rn "@Controller('<route>')" src`)
- [ ] `ErpResource` có entry mới (luôn được thêm bởi generator). Xác nhận seed quyền ở `rbac-core` không cần bước tay khác.
- [ ] `wire` đã nối đúng `app.module.ts` và `data-source.ts` (nếu chọn `true`). Nếu chọn `false`, phải nối tay.
- [ ] Nghiệp vụ thêm vào command/query service, kèm spec
- [ ] `bun run type:check`, `bunx jest src/v2/<module>-core --forceExit`, `bunx eslint` đều pass
- [ ] Module skill `.agents/skills/modules/<module>/SKILL.md` đã cập nhật (Knowledge-Sync)

## 4b. Generator Chứng Từ V2 (`api-voucher-v2`)

Dành cho các module dạng **Document - Detail Lines (Master-Detail / Voucher)** như: `garage-goods-receipts`, `garage-goods-issues`, `purchase-orders`, `sales-orders`, `inventory-adjustments`.

### Cách chạy
```bash
bunx plop api-voucher-v2
```

### Prompt yêu cầu:
1. `moduleInput`: Tên thư mục module (kebab-case, vd: `garage-goods-issues-core`).
2. `headerEntityInput`: Tên Entity Header chính (PascalCase, vd: `GarageGoodsIssue`).
3. `lineEntityInput`: Tên Entity Line chi tiết (mặc định `<Header>Line`, vd: `GarageGoodsIssueLine`).
4. `voucherPrefixInput`: Tiền tố mã chứng từ tự sinh theo ngày (vd: `GGI`, `GR`, `PO`).
5. `tableNameInput`: Tên bảng PostgreSQL Header (mặc định `erp_<module>`).
6. `lineTableNameInput`: Tên bảng PostgreSQL Lines (mặc định `<header_table>_lines`).
7. `routePathInput`: Đường dẫn API (mặc định theo module).
8. `permissionResourceInput`: Tên RBAC resource snake_case.
9. `wireInput`: Nối tự động vào AppModule và DataSource (`true`/`false`).

### Cấu trúc sinh ra (tại `src/v2/modules/<module-name>/`):
- **Entities**: Header và Line kế thừa `BaseGoodsReceiptEntity` và `BaseGoodsReceiptLineEntity` từ `@/v2/core/goods-receipts-core/entities/`, tự động có sẵn các trường chuẩn chứng từ (`receiptNo`, `status`, `totalAmount`, timestamps, timestamps line, FK cascade).
- **DTOs**: Create, Update, Query, Response DTOs kế thừa trực tiếp từ `@/v2/core/goods-receipts-core/dto/`, loại bỏ mã lặp class-validator & Swagger annotations.
- **Helpers**: Mapper hai chiều Header + nested Lines (tự tính tổng dòng hàng).
- **Core Engine Integration**: Tự động kết nối `BaseVoucherEngineService` (`@/v2/core/goods-receipts-core`):
  - Sinh mã theo ngày: `generateDailyVoucherNo` (`PREFIX-YYYYMMDD-001`).
  - Kiểm tra trạng thái: `validateVoucherTransition` (`DRAFT` -> `POSTED` -> `CANCELLED`).
  - Xóa mềm: Chỉ cho phép xóa khi ở trạng thái `DRAFT`.
  - Transaction an toàn: Lưu cả Header và Lines trong một transaction.
- **Specs co-located**: Đầy đủ unit test cho Mapper, QueryService, CommandService, Facade, Controller (kèm RBAC verification test).

---

## 5. Test generator

```bash
bun test plop-helpers
```

Các file trong `plop-helpers/` là hàm thuần: `apiV2Fields`, `apiV2Data`, `apiV2Files`, `apiV2Wiring`. Dùng `bun:test`. Jest của repo không chạy được ở đây vì `rootDir` là `src`.

## 5b. Trạng thái migrate (cập nhật mỗi lần migrate)

| Module V1 | Module V2 (`src/v2/`) | Trạng thái |
| :--- | :--- | :--- |
| `business-partners-core` | Lõi `src/v2/core/business-partners-core/` (entity `ErpBusinessPartner`, services, contracts, `core.manifest.json`) & module `src/v2/modules/business-partners-management/` (route `/api/v2/business-partners`, alias v1 `business-partners`) | Đã v2 chuẩn hóa 2 tầng Core & Module. Controller và route giữ nguyên 100%, UI không đổi. |
| `branches-core` | Lõi `src/v2/core/branches-core/` (một entity `ErpBranch`, query/command, facade) & module `src/v2/modules/branches-management/` (controller/response mapper, route vẫn `/api/v1/branches`). | Đã chuyển cấu trúc v2, giữ nguyên DB/API/UI. Ngoại lệ legacy: JWT-only, body không siết validator, `DELETE /:id` xóa cứng, không có `is_deleted`; xem module skill `branches-core`. Manifest đánh dấu `legacy-compatible`, không dùng làm base cho `api-thin-module`. |
| `erp-invoices-core` (lõi: list/get/create/update/bulk/soft-delete) | `src/v2/core/invoices-core/` (Core Foundation) & `src/v2/modules/invoices-finance/` (route `/api/v2/invoices`, chạy song song) | Đang migrate. Tách Core (Abstract entities, Engine tính toán dùng chung, DTOs) và Business Module `finance-invoices` (kế thừa Core, Controller V2, Query/Command). Entity `FinanceInvoice`, `FinanceInvoiceItem` trỏ cùng bảng `erp_invoices` / `erp_invoice_items`, không migration. |
| `purchase-orders-core` (v2, đã gỡ) | Không còn module/lõi v2 `purchase-orders`. Đã kiểm tra: không có caller nào (erp-web, erp-api, test, scripts) gọi `/api/v2/purchase-orders`. Khôi phục từ commit `5b1ec29` nếu cần. PO dùng v1: `src/purchase-orders-core/`, route `/api/v1/purchase-orders`. | Đã gỡ cùng đợt đổi tên. |
| `rbac-core` (kiểm quyền dùng chung + quản trị role) | Lõi `src/v2/core/rbac-core/` (entity `CoreRole`/`CorePermission`/`CoreUserRole`, `RbacCoreService` 5 method kiểm quyền, `enums/` xuất qua `@/v2/core/rbac-core`, `@Global`); module `src/v2/modules/rbac-roles/` (route vẫn `/api/v1/rbac-core`, chung UI). Đã xóa sạch `src/rbac-core`. | Đã v2, giữ nguyên hợp đồng v1. Khác biệt có chủ đích: `GET roles/:roleId/users` chỉ trả `{id, email}`; id/roleId sai UUID trả 400 (trước đây 500). Xóa role vẫn là xóa cứng (bảng `core_roles` không có `isDeleted`). |

Khi làm module v2 mới không có lõi dùng chung và có bảng mới, dùng `api-module-v2`. Ví dụ PO v2 từng dựng tay theo cấu trúc này đã được gỡ; khôi phục từ commit `5b1ec29` nếu cần tham khảo.

Route v2: `GLOBAL_PREFIX_EXCLUDE` cho phép controller `api/v2/...` không mang prefix `api/v1`. Plop sinh `@Controller('<routePath>')` có prefix `api/v1`, nên module v2 mới cần đổi tay path sang `api/v2/...` và cập nhật `global-prefix.config.ts` nếu cần.

Knowledge-Sync: mỗi lần migrate xong, thêm/đổi dòng ở bảng này và cập nhật `.agents/skills/modules/<module>/SKILL.md` của module đó.

## 6. Giới hạn

- Không sinh nghiệp vụ, không sinh phân quyền theo dữ liệu, không sinh audit log.
- Không kiểm tra trùng route hay trùng `ErpResource` lúc sinh. Lỗi trùng sẽ lộ khi `tsc` (enum) hoặc lúc chạy (route).
- Scope theo loại (ví dụ `partnerType` của BP) không có trong template: thêm tay vào query service và controller (xem `business-partners-core`).
- Trùng `code` với bản ghi đã xóa mềm: index unique DB không lọc `is_deleted`, nên mã cũ không dùng lại được (lỗi 500). Đây là hành vi V1, cần migration (partial unique index) để sửa.

## 4. Họ workflow (`abstract-services`) và module chứng từ

Dùng cho chứng từ có vòng đời trạng thái (ví dụ đơn mua, phiếu nhập). Họ CRUD dùng `api-core` kiểu `engine` và `api-thin-module`.

1. **`api-core`** với style `abstract-services` sinh khung lõi trong `src/v2/core/<họ>/`:
   - `contracts/<họ>.contract.ts`: kiểu `<Entity>Action` và bảng `<ENTITY>_TRANSITIONS` (mặc định rỗng).
   - `entities/base-*.entity.ts`: cột `id`, `isDeleted`, `status` (mặc định `DRAFT`), `createdBy`, timestamp.
   - `services/abstract-*-command.service.ts`: `transition()` và `createDraft()` chạy trong transaction, khóa `pessimistic_write`, ghi nhật ký `ApprovalEvent`. Hook rỗng đánh dấu `// CUSTOM`: `initialStatus`, `beforeTransition`, `applyFields`.
2. **`api-workflow-module`** (chỉ nhận họ `abstract-services`) sinh module trong `src/v2/modules/<module>/`: entity con, DTO tạo, command con (điền `headerEntity`, `docType`), controller `POST /` và `POST /:id/transition/:action`, module, spec tối thiểu, và RBAC (`ErpResource`). Wiring `app.module.ts` và `data-source.ts` chỉ khi bật `wireInput`.

Quy ước "điền chỗ trống":
- Nghiệp vụ riêng viết ở các hook `// CUSTOM` của command con hoặc lõi, không sửa template.
- Bảng chuyển trạng thái điền trong `contracts/<họ>.contract.ts`, kèm khai báo kiểu `<Entity>Action`.
- Trường trùng với lõi (`status`, `createdBy`, `isDeleted`, `id`) bị từ chối khi sinh.
- Module workflow không có đọc danh sách/chi tiết: dev thêm query service và endpoint `GET` theo nhu cầu.
- Generator không ghi đè file đã có. Đổi mẫu về sau không tự cập nhật các họ/module đã sinh.
