---
name: api-v2-refactor
description: Playbook tạo và chuyển module erp-api sang kiến trúc API v2 (Facade + sub-services + mapper + response DTO + spec co-located) bằng plop api-module-v2; gồm quy ước, bẫy đã biết và checklist kiểm tra.
---

# Kỹ Năng API v2 Refactor (`erp-api`)

Workflow đầy đủ: [`../../workflows/api-v2-refactor.md`](../../workflows/api-v2-refactor.md). Skill này là checklist và quy ước để thực thi workflow.

## 0. Vị trí

Mọi module API v2 nằm trong `src/v2/<module>-core/`, tách khỏi module v1 (`src/<module>-core/`). Import trong module dùng alias `@/` (`@/common`, `@/auth`, `@/rbac-core`). Generator `api-module-v2` tự sinh đúng vị trí và wiring `./v2/...`.

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

## 5. Test generator

```bash
bun test plop-helpers
```

Các file trong `plop-helpers/` là hàm thuần: `apiV2Fields`, `apiV2Data`, `apiV2Files`, `apiV2Wiring`. Dùng `bun:test`. Jest của repo không chạy được ở đây vì `rootDir` là `src`.

## 5b. Trạng thái migrate (cập nhật mỗi lần migrate)

| Module V1 | Module V2 (`src/v2/`) | Trạng thái |
| :--- | :--- | :--- |
| `business-partners-core` | `src/v2/business-partners-core/` (route `/api/v2/business-partners`, alias v1 còn dùng bởi web V1) | Đã v2 (module mẫu). Đối chiếu với plop: khác biệt còn lại đều là nghiệp vụ viết tay |
| `erp-invoices-core` (lõi: list/get/create/update/bulk/soft-delete) | `src/v2/invoices/` (route `/api/v2/invoices`, chạy song song) | Đang migrate. Entity `Invoice`, `InvoiceItem` trỏ cùng bảng, không migration. v2 không import v1: helper copy sang `helpers/`. Giữ ở v1: attributes, stats, export, netoff, post/unpost/cancel/category, portal GDT, import XML, file/PDF, dashboard, debts, UC2 (accounting-core). |

Route v2: `GLOBAL_PREFIX_EXCLUDE` cho phép controller `api/v2/...` không mang prefix `api/v1`. Plop sinh `@Controller('<routePath>')` có prefix `api/v1`, nên module v2 mới cần đổi tay path sang `api/v2/...` và cập nhật `global-prefix.config.ts` nếu cần.

Knowledge-Sync: mỗi lần migrate xong, thêm/đổi dòng ở bảng này và cập nhật `.agents/skills/modules/<module>/SKILL.md` của module đó.

## 6. Giới hạn

- Không sinh nghiệp vụ, không sinh phân quyền theo dữ liệu, không sinh audit log.
- Không kiểm tra trùng route hay trùng `ErpResource` lúc sinh. Lỗi trùng sẽ lộ khi `tsc` (enum) hoặc lúc chạy (route).
- Scope theo loại (ví dụ `partnerType` của BP) không có trong template: thêm tay vào query service và controller (xem `business-partners-core`).
- Trùng `code` với bản ghi đã xóa mềm: index unique DB không lọc `is_deleted`, nên mã cũ không dùng lại được (lỗi 500). Đây là hành vi V1, cần migration (partial unique index) để sửa.
