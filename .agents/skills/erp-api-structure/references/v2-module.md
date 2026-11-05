
# Kỹ Năng API v2 Refactor (`erp-api`)

Workflow đầy đủ: [`../../../workflows/api-structure.md`](../../../workflows/api-structure.md). Skill này là checklist và quy ước để thực thi workflow.

## 0. Vị trí

Kiến trúc API V2 được tổ chức phân cấp tương tự Web V2 (`erp-web/src/v2/`):
- **Core Foundations & Shared Engines**: Nằm trong `src/v2/core/<core-name>/` (vd: `src/v2/core/goods-receipts/` chứa Base Voucher Engine, shared voucher contracts).
- **Business Modules**: Nằm trong `src/v2/modules/<module-name>/` (vd: `src/v2/modules/garage-goods-receipts/`).
- Tách biệt hoàn toàn khỏi các module V1 legacy (`src/<module>-core/`). Import trong module dùng alias `@/` (`@/common`, `@/auth`, `@/rbac-core`, `@/v2/core/...`). Generator `api-module-v2` và `api-voucher-v2` tự sinh đúng vị trí `src/v2/modules/...` và wiring `./v2/modules/...`.

## 1. Quy ước v2

| Lớp | File | Quy tắc |
| :--- | :--- | :--- |
| Entity | `entities/*.entity.ts` | Cột snake_case qua `name:`; cờ `isDeleted` (không dùng `DeleteDateColumn`) |
| DTO vào | `dto/create-*.dto.ts`, `update-*` (PartialType), `query-*` (PaginationDto) | class-validator + Swagger |
| DTO ra | `dto/*-response.dto.ts` | Không trả entity ra ngoài module |
| Mapper | `helpers/*.mapper.ts` | Hàm thuần. Hai chiều: entity→response, DTO→entity (bỏ `undefined`) |
| Đọc | `services/*-query.service.ts` | Chỉ đọc, lọc `isDeleted = false` |
| Ghi | `services/*-command.service.ts` | create / update / softDelete |
| Facade | `<module>.service.ts` | Điều phối, `NotFoundException`, luôn trả response DTO |
| Controller | `controllers/*.controller.ts` | `@RequirePermissions({ resource: ErpResource.X, action: ErpAction.READ\|CREATE\|UPDATE\|DELETE })` |

Enum quyền: `src/rbac-core/enums/erp-action.enum.ts` (`ErpAction`), `src/rbac-core/enums/erp-resource.enum.ts` (`ErpResource`). Không dùng chuỗi literal cho quyền.

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
- **Entities**: Header và Line kế thừa `BaseGoodsReceiptEntity` và `BaseGoodsReceiptLineEntity` từ `@/v2/core/goods-receipts/entities/`, tự động có sẵn các trường chuẩn chứng từ (`receiptNo`, `status`, `totalAmount`, timestamps, timestamps line, FK cascade).
- **DTOs**: Create, Update, Query, Response DTOs kế thừa trực tiếp từ `@/v2/core/goods-receipts/dto/`, loại bỏ mã lặp class-validator & Swagger annotations.
- **Helpers**: Mapper hai chiều Header + nested Lines (tự tính tổng dòng hàng).
- **Core Engine Integration**: Tự động kết nối `BaseVoucherEngineService` (`@/v2/core/goods-receipts`):
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
| `business-partners-core` | `src/v2/business-partners-core/` (route `/api/v2/business-partners`, alias v1 còn dùng bởi web V1) | Đã v2 (module mẫu). Đối chiếu với plop: khác biệt còn lại đều là nghiệp vụ viết tay |
| `erp-invoices-core` (lõi: list/get/create/update/bulk/soft-delete) | `src/v2/core/invoices/` (Core Foundation) & `src/v2/modules/finance-invoices/` (route `/api/v2/invoices`, chạy song song) | Đang migrate. Tách Core (Abstract entities, Engine tính toán dùng chung, DTOs) và Business Module `finance-invoices` (kế thừa Core, Controller V2, Query/Command). Entity `FinanceInvoice`, `FinanceInvoiceItem` trỏ cùng bảng `erp_invoices` / `erp_invoice_items`, không migration. |
| `purchase-orders-core` (lõi: list/detail/create/update/approve/confirm/cancel/soft-delete, next-no, column-options, receipts, connections, link/unlink hóa đơn) | `src/v2/modules/purchase-orders/` (route `/api/v2/purchase-orders`, chạy song song, dùng chung bảng `erp_purchase_orders`). Lõi `src/v2/core/purchase-orders/` (entity/service/DTO trừu tượng) được v1 kế thừa khi refactor. Giữ ở v1: Excel (range và từng phiếu), `/items`, `/supplier-stats`, `goods-receipts-core` ghi trạng thái PO | Đang migrate. Entity v2 trỏ cùng bảng, không migration. Đổi trạng thái qua action endpoint, không qua PATCH. Chưa có UI v2. |
| Garage purchase orders (mới, không có ở v1) | `src/v2/modules/garage-purchase-orders/` (route `/api/v2/garage-purchase-orders`, bảng `erp_garage_purchase_orders`, quyền `garage_purchase_orders`) | Mới. Chưa nối phiếu nhập garage (`purchase_order_id` trên GR garage chưa có). |

Module v2 PO (`purchase-orders`, `garage-purchase-orders`) không dùng plop, đã đối chiếu cả hai generator:
- `api-voucher-v2` sinh code kế thừa `BaseGoodsReceipt*`, không hợp PO.
- `api-module-v2` sinh cấu trúc Facade + sub-service + mapper + controller + wiring giống module đã dựng, nhưng sinh thêm entity, DTO và migration. Với PO, chạy nó sẽ tạo lại bảng `erp_purchase_orders` đã có và nhân bản logic thay vì kế thừa lõi `src/v2/core/purchase-orders/`.
Vì vậy dựng tay theo đúng cấu trúc của `api-module-v2` (cùng tên marker `api-v2-module:<module>:<key>`), rồi kế thừa lõi. Khi làm module v2 mới không có lõi dùng chung và có bảng mới, nên dùng `api-module-v2`.

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
