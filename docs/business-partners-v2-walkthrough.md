# Business Partners: API v2 và Web v2 (walkthrough và nghiệm thu)

Written for: đội kỹ thuật ERP, người duyệt thay đổi trước khi commit.

## 1. Tóm tắt

- **API** `erp/erp-api/src/v2/business-partners-core/` chuyển sang kiến trúc v2 (Facade, query/command service, mapper, response DTO, spec). Route, RBAC `business_partners`, bảng `erp_business_partners` giữ nguyên. Entity chuyển cùng module vào `src/v2/business-partners-core/entities/`, và 16 file khác đang import đã được cập nhật đường dẫn.
- **Lọc, sắp xếp, subtotal** dùng helper chung mới `src/common/utils/table-query/`. Helper này dùng cho cả plop và BP.
- **Plop** `api-module-v2` và `v2-module` được sửa theo các lỗi phát hiện khi làm BP (G1–G7, mục 4).
- **Web v2** BP đã có sẵn. Đã thêm ô tổng (summary row), tách thông báo tạo/sửa như V1, và đối chiếu parity V1 bằng test.
- Chưa commit, chưa push, chưa chạy `verify:final`. Cần anh ra lệnh.

## 2. Thay đổi chính

| Phạm vi | File | Ghi chú |
| :--- | :--- | :--- |
| API helper | `src/common/utils/table-query/table-query.{parse,filters,query}.ts` (+ spec) | Lọc theo kiểu cột, `summaries`, column-options, sort |
| API DTO | `src/common/dto/table-query.dto.ts` | Thêm `date_from`, `date_to` (các trường còn lại đã có ở `PaginationDto`) |
| API BP | `src/v2/business-partners-core/business-partners-core.service.ts` | Facade: sinh mã, chuẩn hóa, envelope |
| API BP | `services/erp-business-partner-{query,command}.service.ts` | Lọc, search 7 cột, trùng mã, `summaries` |
| API BP | `helpers/erp-business-partner-code.helper.ts` (+ spec) | Hàm thuần: tiền tố, số thứ tự |
| API BP | `controllers/erp-business-partner.controller.ts` | Thêm `next-code`, `partnerType` cho column-options |
| API plop | `plop-templates/module-v2/*`, `plop-helpers/apiV2Data.mjs`, `apiV2Wiring.mjs`, `plopfile.mjs` | G1–G7 |
| Web plop | `plop-templates/v2-module/*`, `plop-helpers/v2Fields.mjs`, `v2ModuleData.mjs` | `decimal`, cột số có summary, `summaries` |
| Web BP | `api/queries/useBusinessPartnersQuery.ts`, `api/mutations/useBusinessPartnerMutations.ts`, `components/organisms/business-partner-table/BusinessPartnerTable.columns.tsx`, `businessPartners.locale.ts` | Summary đếm, toast tách tạo/sửa |
| Docs | `erp-api/.agents/skills/api-v2-refactor/SKILL.md` (2b, 3b), `erp-api/.agents/skills/modules/business-partners-core/SKILL.md` (mới), `erp-web/.agents/skills/modules/business-partners/SKILL.md`, `plop-generate` (cả hai repo) | Knowledge-Sync |

## 3. Bằng chứng (chạy trong phiên này, trên working tree chưa commit)

| Kiểm tra | Kết quả |
| :--- | :--- |
| `erp-api`: `bun test plop-helpers` | 31/31 pass |
| `erp-api`: `bunx tsc --noEmit` | 0 lỗi |
| `erp-api`: `bunx jest src/v2/business-partners-core src/common/utils/table-query` | 8 suites, 53/53 pass |
| `erp-api`: prettier và eslint (`--max-warnings=0`) trên file đã đổi | Đạt |
| `erp-api`: `scan-oversized-files.ts --strict` | Không có file BP hay table-query bị cảnh báo |
| `erp-web`: `bun test plop-helpers` | 25/25 pass |
| `erp-web`: `bunx tsc --noEmit` | 0 lỗi |
| `erp-web`: `vitest` `src/v2/modules/business-partners` | 8 files, 27/27 pass |
| `erp-web`: eslint `src/v2/modules/business-partners` | Đạt (sau `--fix` định dạng test mới) |
| Sinh module scratch từ template đã sửa (API và web), tsc, jest, vitest | Đạt; scratch đã xóa, git sạch |
| Schema DB (chỉ đọc) | Khớp entity: 15 cột, unique index `code` |

Chưa làm:
- **Smoke HTTP trực tiếp** trên API đang chạy. `.env` trỏ `erp_klotus_production` (xem mục 6), không dùng để ghi thử.
- **`bun run verify:final`** và push: chưa commit.

## 4. Lỗi plop đã sửa

| # | Lỗi | Sửa |
| :--- | :--- | :--- |
| G1 | Envelope API và web không khớp | Facade trả `{ message, data }` |
| G2 | List thiếu `totalPages` | Thêm |
| G3 | Không lọc/sắp xếp được theo kiểu cột | Helper `table-query`, toán tử theo kiểu |
| G4 | Summary row luôn 0 | `summaries` từ API, web merge |
| G5 | Trùng `ErpResource` khi module đã có | `enumEntryExists` bỏ qua chèn |
| G6 | `:id` bắt route tĩnh | Route tĩnh đặt trước |
| G7 | Module cũ bị `plop add` từ chối | Quy trình trong skill 3b |
| — | Mapper trả `null` cho field nullable, tsc lỗi | `?? undefined` cho string, text, number, date |
| — | Web plop thiếu `decimal` | Thêm, khớp API |

## 5. Ma trận parity V1 → V2 (BP)

V1: `erp-web/src/modules/business-partners-core/` (`BusinessPartnersListPage.tsx`, `BusinessPartnerDetailDrawer.tsx`, `hooks/useBusinessPartnersList.ts`). V2: `erp-web/src/v2/modules/business-partners/`.

| Tính năng V1 | V2 | Trạng thái |
| :--- | :--- | :--- |
| Cột STT 1-based | `V2StandardTable` tự render `__index` | Có |
| 11 cột (mã, tên, tên hiển thị, MST, điện thoại, email, người liên hệ, địa chỉ, trạng thái, ngày tạo) | `BusinessPartnerTable.columns.tsx` | Có |
| Badge "Ngưng" và tooltip cạnh mã | `BusinessPartnerTable.columns.tsx` (`V2Tooltip`) | Có |
| Copy mã và click mở chi tiết | `V2TableText` `enableCopy`, `onDetailClick` | Có |
| Header filter text, cột tên hiển thị/MST/SĐT/email/liên hệ/địa chỉ có "để trống" | `filter.showBlankOption` | Có, khớp |
| Filter trạng thái (Hoạt động, Ngưng) | `filter.filterOptions` | Có |
| Filter khoảng ngày `createdAt` | `ColumnValueType.DATE` + `date_ranges`/`date_from`/`date_to` | Có |
| 3 view: Tổng quan, Pháp nhân & Thuế, Tất cả cột | `BusinessPartnerTable.views.ts` (`PARTNER_VIEW_VISIBILITY`) | Có, cùng cột ẩn/hiện |
| Lưu cấu hình cột, view theo bảng | `v2ColumnPreferencesStorage`, `v2ViewPresetStorage` | Có (theo skill) |
| Page size 50 (màn cao) hoặc 20 | `getDefaultPageSize` (`v2TableFormat.ts`) | Có, cùng ngưỡng |
| Tìm kiếm toàn cục (7 cột) | Toolbar search; API `SEARCH_COLUMNS` (7 cột) | Có. Chưa có test riêng cho 7 cột |
| Lọc theo nhiều giá trị, `(Trống)`, `Tất cả khớp` | API: selection, `__BLANK__`, `__ALL_MATCHING__` (test trong `table-query.filters.spec.ts`) | Có |
| Lọc văn bản: chứa, bắt đầu, kết thúc, bằng, khác, trống | API: `applyTextOperator` (test) | Có |
| Lọc cột chéo cho gợi ý (cascading options) | API: `findColumnOptions` với `exceptColumn` và `partnerType` (test) | Có |
| Sắp xếp đa cột (`a,-b`) | API: `applyTableSort` (test) | Có |
| Làm mới | `V2ModuleListTab` onRefresh từ `refetch` | Có |
| Xóa tất cả bộ lọc | `V2StandardTable.filterpanel` `onResetAll` | Có |
| Hành động hàng: xem, sửa, xóa (có xác nhận) | `useBusinessPartnersPage.tsx`, `V2ConfirmModal` | Có. Khác có chủ đích: có kiểm quyền từng hành động |
| Nút tạo mới theo loại | `createCustomer` / `createSupplier` | Có. Khác có chủ đích: kiểm quyền `create` |
| Drawer: mã tự sinh khi tạo, nút sinh mã lại, khóa mã khi sửa | `BusinessPartnerFormSections.tsx` (`codeEditable`, `onRegenerateCode`) | Có |
| Mã viết hoa khi nhập | `setField("code", v.toUpperCase())` | Có |
| Tên pháp nhân bắt buộc, báo lỗi | `validateBusinessPartnerForm`, `nameError` | Có |
| Copy mã, MST, SĐT, email ở chế độ xem | `V2TextField` (`font-mono` hoặc email) | Có |
| Email `type="email"`, trạng thái, ghi chú | `BusinessPartnerFormSections.tsx` | Có |
| Đóng khi có thay đổi chưa lưu: hỏi xác nhận | `confirmOnClose={state.dirty && !state.viewing}` | Có |
| Toast: thiếu tên, lỗi tải, tạo/cập nhật thành công và thất bại, xóa | `useBusinessPartnerMutations.ts`, `useBusinessPartnersQuery.ts` | Có. Tiêu đề tạo/sửa đã tách như V1 (mục 6, test) |
| Chặn trang khi không có quyền đọc | Route guard (theo skill) | Có, chưa chạy lại trong phiên này |
| Modal chứng từ phụ thuộc khi xóa (409) | `V2DocumentDependencyModal` qua `v2HttpClient` | V2 có thêm. V1 không có |
| Ô tổng (subtotal và total) | Mới: cột mã, variant `count`, `summaries.code = total` | V2 có thêm. V1 không có |

## 6. Những thay đổi đã làm trong phiên này (web)

- `useBusinessPartnersQuery`: trả `summaries: { code: total, ...API summaries }`.
- `BusinessPartnerTable.columns.tsx`: cột mã có `summary: { variant: "count", accessor: () => 1 }`.
- `useBusinessPartnerMutations.ts`: tiêu đề toast tạo/sửa, thất bại tách theo `id`, như V1. Bỏ key `saveSuccess` không còn dùng.
- Test mới: `BusinessPartnerTable.columns.test.tsx` (summary), `useBusinessPartnersQuery.test.tsx` (summaries), `useBusinessPartnerMutations.test.tsx` (tiêu đề toast).

## 7. Khác biệt có chủ đích so với V1 (cần duyệt)

1. **Response bỏ `isDeleted`.** V1 trả cả entity. Web không dùng trường này.
2. **`status` validate `IsIn(ACTIVE, INACTIVE)`.** V1 nhận chuỗi tự do. Client gửi giá trị khác sẽ nhận 400.
3. **`PATCH`/`DELETE` dùng `ParseUUIDPipe`.** Id sai định dạng: 400 (V1 không kiểm tra).
4. **`DELETE` trên bản ghi đã xóa mềm: 404.** V1 cho xóa lại và ghi đè.
5. **Thông báo lỗi 404** dùng tiếng Việt theo template: `Không tìm thấy ErpBusinessPartner với id ...`. V1 là `Business partner ... not found`.
6. **Quyền từng hành động** trên web V2 (V1 hiển thị hết).

## 8. Vấn đề mở cần anh quyết định

1. **`.env` của `erp-api` trỏ `erp_klotus_production`.** Quy tắc workspace yêu cầu DB master là `erp_local` và cấm trộn DB giữa ERP và Klotus. Em chỉ đọc schema, không ghi. Cần kiểm tra lại `DATABASE_URL` trước khi chạy smoke hay migration.
2. **Trùng mã với bản ghi đã xóa mềm gây lỗi 500 (đã viết sửa, chưa chạy).** Entity và migration `20261018160000-PartialUniqueBusinessPartnerCode.ts` đổi unique index thành partial (`WHERE is_deleted = false`). Đã kiểm tra chỉ đọc trên DB hiện tại: 0 nhóm mã trùng giữa bản ghi chưa xóa, 2 bản ghi đã xóa, không đụng mã đang dùng. Anh cần duyệt trước khi chạy migration trên `erp_klotus_production`.
3. **Smoke HTTP** (task 3.2.3) chưa chạy. Cần DB dev riêng để thử ghi.
4. **Commit và push.** Cần lệnh rõ ràng. Khi commit, dùng quy trình `erp-git-workflow` (commit ở `erp-api` và `erp-web`, pull --rebase, `verify:final` một lần trên commit cuối).
5. **`walkthrough.md` có sẵn ở root `erp-api`** thuộc task khác. Em không ghi đè. Báo cáo này ở `docs/`.
6. **Copy `.claude/skills/*` không do `sync-agents` quản lý**, nên vẫn cũ so với `.agents/`. `sync-agents --check` vẫn pass. Cần quyết định có đồng bộ thủ công không.
