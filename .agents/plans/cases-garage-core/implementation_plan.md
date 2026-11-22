# Cases garage: lõi `cases-core`, đổi tên bảng dòng, override v2 trên dữ liệu sync v1 (erp-api)

Track: T2 (anh đã ra lệnh cho module cases-garage)
Structure: /erp-api-structure
Plane: chờ anh trả lời Có/Không sau `OK`
Consistency Check: đạt (AC ↔ Task ở bảng cuối; mâu thuẫn mirror v2→v1 ghi ở "Cần anh quyết")

## Context
- `cases_garage` / `case_services_garage` kế thừa thẳng `base-core`, chưa có lõi `cases-core`; tên bảng dòng lệch mẫu `<header>_lines_<hậu tố>`.
- `/erp-api-structure` chưa nói rõ: tên không lấy từ lõi; phải đánh giá use case đa ngành trước khi chia field lõi/module; code camelCase, cột DB snake_case.
- Đang sync KGara → v1 → v2 (`CaseProjectorService`). Anh cần sửa field ở v2 mà **không ảnh hưởng v1**; v2 có 2 giá trị cho 1 field, có giá trị v2 thì dùng, không thì dùng giá trị sync từ v1.
- DB đã xác nhận: `erp_greenway_staging` (`SELECT current_database()`), 753 vụ việc, 5424 dòng, tất cả `origin=KGARA_SYNC`. Task chạm DB phải báo lại tên DB trước khi ghi.

## Phát hiện từ Discovery (dẫn chứng)
- Projector ghi đè **mọi** field map v1→v2 mỗi lần sync: `case-projector.service.ts` (`m.update(CaseGarage, …, patch)` và `projectLines`).
- Cơ chế cũ "erp-local" ghi ngược v2→v1 để projector không ghi đè: `case-kgara-mirror.service.ts`, `case-command.service.ts:update`. Ngược với yêu cầu mới (chỉ ảnh hưởng v2) → **xóa hẳn** (anh đã chốt), không giữ ngoại lệ.
- Xe `KGARA_SYNC` bị khóa: `case-origin.guard.ts` (`assertHeaderPatchAllowed`, `assertStructureEditable`, `assertDeletable`, `assertStatusEditable`) chỉ cho sửa nhóm erp-local (`kgara-case.field-map.ts`); sẽ thay bằng cơ chế override.
- **Cột thừa (đo trên `erp_greenway_staging`)**:
  - `cases_garage.legacy_case_id`: `= id` ở 753/753 dòng → thừa, xóa cùng index `UQ_cases_garage_legacy_case_id`. Projector dùng `id`.
  - `case_services_garage.legacy_service_id`: không trùng `id`, nhưng `external_id` (= `hd_phieu_dich_vu_chi_tiet_id` của v1) không null, duy nhất 5424/5424 và khớp v1 0 chỗ lệch → thay bằng `external_id` làm khóa nối dòng; xóa cột và index `UQ_case_services_garage_legacy_service_id`; thêm unique `(account_key, external_id)`.
  - `cases_garage.external_delete_count`: chỉ được ghi từ field map, không có code nào đọc → thừa, xóa (29 dòng có giá trị > 0, mất đếm lịch sử; `external_deleted_at` giữ).
  - Giữ: `origin` (phân biệt NATIVE/SYNC), `external_id`, `account_key`, `branch_external_id`, `kgara_status_code`, `status_name`, `customer_source_*` (đều đang được đọc).
- Dòng `case_services_garage` kế thừa `CoreAuditedEntity` (không có `is_deleted`), projector không xóa dòng v1 đã mất.
- Precedent Plane (KINDU-1482…1491, 1440, 1565, 1621): việc dựng `cases-garage` trước đây. Em chưa đọc state/cycle từng item; chọn "tạo mới có liên kết" ở Approval Gate.

## Thiết kế

### D1. Lõi `cases-core` (đa ngành)
Tiêu chí: field nào **mọi ngành** (garage, bảo hành thiết bị, phòng khám, spa, công trình, ticket IT, bảo hiểm) đều cần thì vào lõi; còn lại ở module. Đối tượng riêng của ngành (xe) ở module; chỗ phát sinh sau ghi vào `extra_data` (đã có ở `CoreBaseEntity`).

| Nơi | Field |
|---|---|
| `BaseCaseEntity extends CoreSoftDeletableEntity` | `caseCode`, `branchId`, `customerCode`, `customerName`, `payerCode`, `payerName`, `status`, `issuedAt`, `receivedAt`, `startedAt`, `expectedCompletionAt`, `completedAt`, `deliveredAt`, `requestDescription`, `diagnosis`, `assigneeId`, `progressStage`, `progressPercent`, `progressUpdatedAt`, `progressUpdatedBy` (nhóm tiến độ, xem D5), `totalAmountWithTax`, `paidAmount`, `outstandingAmount`, `revenue`, `cost`, `profit`, `categoryId`, `classification`, `internalNotes`, `createdBy` |
| `CaseGarage` (module) | nhóm xe (`licensePlate`, `chassisNumber`, `vehicleBrand*`, `vehicleModel*`, `manufactureYear`), nhóm KGara (`origin`, `externalId`, `accountKey`, `branchExternalId`, `kgaraStatusCode`, `statusName`, `customerSource*`, `externalDeletedAt`), quy tắc báo cáo (`excludeFromReports`, `excludeFromDebt`, `classificationManuallyCleared`). Đã xóa: `legacyCaseId`, `externalDeleteCount` |
| `BaseCaseLineEntity extends CoreAuditedEntity` | `caseId`, `lineNumber`, `description`, `productCode`, `productName`, `unitName`, `quantity`, `unitPrice`, `amountBeforeTax`, `taxRate`, `amountWithTax`, `laborHours`, `serviceAmount`, `partsAmount`, `partsCost`, `lineDiscountRate`, `lineDiscountAmount` |
| `CaseLineGarage` (module) | `externalId`, `accountKey`, `externalDeletedAt`, `productTypeCode`, `warehouseCode`, `surchargeAmount`. Đã xóa: `legacyServiceId` (nối dòng bằng `externalId` + `accountKey`) |

Lõi chỉ có entity trừu tượng, `core.manifest.json` (mẫu `cashflow-vouchers-core`), barrel; không `@Entity`, không bảng. Sinh bằng `bunx plop api-core` (cần chọn style khớp; test `plop-helpers/apiCoreLayout.test.mjs` chặn vi phạm). Tên bảng/entity **không** lấy từ lõi.

### D2. Đổi tên bảng dòng
`case_services_garage` → `case_lines_garage`; entity `CaseServiceGarage` → `CaseLineGarage`. Giữ route `services` và field response `services` để Web không gãy. `ALTER TABLE … RENAME` + đổi tên index/constraint (tiền lệ `20261106140000-rename-stock-ledger-to-garage.ts`). Tên bảng `cases_garage` giữ nguyên. Em ghi nhận 8 file ngoài entity còn nhắc tên bảng.

### D3. Override v2 trên dữ liệu sync v1 (đề xuất)
Cột hiện có (`license_plate`, `status`…) trở thành **giá trị hiệu lực** (effective) để mọi query/filter/sort/index giữ nguyên. Thêm hai cột jsonb trên header và dòng:
- `source_snapshot`: giá trị mới nhất sync từ v1 (chỉ field map v1→v2), projector luôn cập nhật.
- `overrides`: tập khóa field đã bị v2 sửa (có kèm giá trị cũ để audit nếu cần).

Luật:
1. Projector: luôn ghi `source_snapshot`; chỉ ghi vào cột hiệu lực những field **không** nằm trong `overrides`.
2. Sửa ở v2 với xe `KGARA_SYNC`: ghi cột hiệu lực, thêm khóa vào `overrides`, **tuyệt đối không** ghi ngược v1 (không còn mirror, không còn nhóm erp-local).
3. "Về giá trị KGara": copy `source_snapshot[field]` về cột, xóa khóa khỏi `overrides`.
4. Khóa đặc biệt `_deleted` trên dòng: xóa mềm ở v2, projector không hồi sinh. Dòng thêm mới ở v2 (không có `legacy_service_id`) projector không đụng.
5. Cho phép override mọi field trừ: định danh/nguồn (`origin`, `legacyCaseId`, `externalId`, `accountKey`, `branchExternalId`) và `paidAmount`/`outstandingAmount` (suy ra từ sổ công nợ).

So với phương án hai giá trị tách cột + `COALESCE` lúc đọc: phương án này không đổi mọi query/index; đánh đổi là logic nằm ở đường ghi (projector, command). Hết giai đoạn migrate chỉ cần bỏ `source_snapshot`.

Đánh giá câu hỏi của anh: hướng "2 giá trị, v2 ưu tiên" ổn cho giai đoạn migrate. Rủi ro đã tính: (a) màn hình/báo cáo v1 vẫn đọc `kgara_*` sẽ lệch số với v2 → cần danh sách vụ việc đã override để đối chiếu; (b) field tiền suy ra từ công nợ không cho override; (c) bỏ mirror nên các chỉnh sửa cũ ở nhóm erp-local (`category`, `classification`, `exclude*`, ghi chú, giá vốn phụ tùng) từ nay **v1 PnL/đối soát không thấy** — anh đã chấp nhận.

### D5. Theo dõi tiến độ từng xe (yêu cầu bổ sung)
Anh đã chọn: người làm ở cấp vụ việc (cố vấn + KTV chính); tiến độ = công đoạn + % do người nhập; "loại xe" = dòng xe (model, đã có); nguồn ngày dự kiến/nội dung = sync từ KGara và cho v2 sửa đè.

**Dữ liệu thực tế trên staging (753 vụ việc)** — ảnh hưởng thiết kế:
| Field KGara (`kgara_cases.raw_data`) | Số vụ việc có giá trị |
|---|---|
| `NgayBatDauSuaChua` | 739 |
| `NhanVienCoVanDichVuName/Code` (cố vấn) | 739 |
| `NgayDuKienHoanThanh`, `YeuCauDichVu`, `ChanDoan` | **0** (key có nhưng rỗng) |
| Kỹ thuật viên / người làm | không có field nào |
Bảng `employees_management` trên staging đang **0 dòng** (cột: `id`, `employee_code`, `full_name`, `branch_id`, `job_title`…).

Vì vậy ngày dự kiến, yêu cầu, chẩn đoán: vẫn map từ KGara theo ý anh (sẵn sàng khi KGara có dữ liệu) nhưng thực tế sẽ do v2 nhập tay. Khi không có nội dung sửa chữa, hiển thị tóm tắt từ `description` các dòng hạng mục.

| Field | Nơi | Nguồn | Override |
|---|---|---|---|
| `startedAt` (bắt đầu sửa) | lõi `BaseCaseEntity` | sync `NgayBatDauSuaChua` | có |
| `expectedCompletionAt` | lõi | sync `NgayDuKienHoanThanh` | có |
| `requestDescription` (yêu cầu/nội dung sửa chữa) | lõi | sync `YeuCauDichVu` | có |
| `diagnosis` (chẩn đoán) | lõi | sync `ChanDoan` | có |
| `assigneeId` (KTV chính, uuid → `employees_management.id`) | lõi | v2 nhập | không cần (v1 không có) |
| `progressStage` (mã công đoạn, varchar) | lõi | v2 nhập | không cần |
| `progressPercent` (smallint 0–100) | lõi | v2 nhập | không cần |
| `progressUpdatedAt`, `progressUpdatedBy` | lõi | v2 tự ghi | — |
| `advisorCode`, `advisorName` (cố vấn dịch vụ) | `CaseGarage` | sync `NhanVienCoVanDichVuCode/Name` | có |
| Danh sách công đoạn `CaseProgressStage` | `CaseGarage` (enum module) | giả định: `WAITING_PARTS`, `REPAIRING`, `PAINTING`, `QC`, `READY_FOR_DELIVERY` | — |

Kiểm tra "mọi ngành đều cần" cho lõi: người phụ trách, giờ bắt đầu, ngày hẹn xong, yêu cầu, chẩn đoán, công đoạn và % đều dùng được cho bảo hành thiết bị, phòng khám, ticket IT, công trình. Danh sách công đoạn là riêng ngành nên ở module; lõi chỉ lưu mã.

**Tính khi đọc, không lưu cột**: `elapsedMinutes` = (`completedAt` nếu có, ngược lại bây giờ) − (`startedAt` ?? `receivedAt`), tính theo giờ VN bằng `vn-time.util`; `isOverdue` = chưa hoàn thành và `expectedCompletionAt` < bây giờ.

**API**:
- `GET api/v2/cases-garage/progress` (bảng theo dõi): biển số, hãng, dòng xe, ngày tiếp nhận, nội dung sửa chữa, KTV, cố vấn, công đoạn, %, ngày hẹn xong, tình trạng, thời gian đã làm, quá hạn. Lọc theo trạng thái (mặc định `IN_PROGRESS`), KTV, công đoạn, quá hạn; dùng `applyTableFilters`/`TableQueryDto` như `GET /`.
- `PATCH api/v2/cases-garage/:id/progress`: `assigneeId`, `progressStage`, `progressPercent`, `expectedCompletionAt`. Cho phép cả xe `KGARA_SYNC` (field v2-native, không đụng v1). Validate: `% 0–100`, công đoạn thuộc enum, `assigneeId` tồn tại trong `employees_management` thuộc cùng chi nhánh. Ghi `erp_audit_logs`.
- Không tự đổi `status` theo `%` (độc lập); anh cần thì bổ sung sau.
- `GET :id` và list hiện có trả thêm các field mới.

### D4. Rule `/erp-api-structure` (nguồn `.agents/`, sau đó `/sync-agents`)
Thêm vào `workflows/erp-api-structure.md` (mục "Quy tắc đặt tên bảng" và mục tạo lõi/module) và `skills/erp-api-structure/references/v2-module.md` (mục 0b, 1b):
1. **Tên không lấy từ lõi**: lõi chỉ là base để kế thừa; không dùng `base_`/`core_`/tên lõi trong tên bảng, module, entity cụ thể; quan hệ thể hiện bằng `extends` và ghi trong SKILL module.
2. **Đánh giá use case đa ngành** trước khi tạo lõi/module: liệt kê ≥3 use case (không bó trong ERP), mỗi field hỏi "mọi use case cần không"; ghi bảng use case→field vào SKILL của lõi; chỉ một use case thì dừng và hỏi user. Không mâu thuẫn quy tắc "core cho mọi họ".
3. **Quy ước tên**: code và response API camelCase; cột DB snake_case map bằng `name:`.
4. **Mẫu override** (D3) cho module đồng bộ từ hệ ngoài.

## Cần anh quyết (mặc định em ghi giả định, anh sửa được ở bước duyệt)
- [x] Đã chốt: bỏ hẳn "erp-local" và mirror v2→v1; xóa cột thừa/legacy.
- [ ] Danh sách công đoạn giả định `WAITING_PARTS`, `REPAIRING`, `PAINTING`, `QC`, `READY_FOR_DELIVERY` — anh sửa nếu xưởng dùng quy trình khác.
- [ ] `employees_management` trên staging đang rỗng: smoke cần tạo nhân viên mẫu (hoặc kiểm tra DB khác) để thử gán KTV; giả định tạo dữ liệu thử bằng tài khoản `ai-test-*`.
- [ ] `progressPercent` và `status` độc lập (100% không tự chuyển `COMPLETED`) — giả định.
- [ ] Vì xóa `legacy_*`, dòng v1 nào có `hd_phieu_dich_vu_chi_tiet_id` null sau này sẽ không nối được (hiện 0 dòng null) → giả định: projector bỏ qua và log cảnh báo.
- [ ] `payer_*` vào lõi (giả định: có); `exclude_*`, `classification_manually_cleared`, `status_name`: ở module (giả định).
- [ ] `warehouse_code`, `surcharge_amount`, `product_type_code` ở module (giả định).
- [ ] Cho override `status` của xe sync (hiện bị chặn) — giả định: **cho**, vì v2 là nơi quản lý sau migrate; trạng thái KGara vẫn nằm trong `source_snapshot`.
- [ ] Đối tượng riêng ngành ở **module** (anh đã chọn); chưa cần bảng phụ.

## Task Breakdown

Thứ tự: DB → API → QC. Task docs rule (0.x) độc lập, làm trước vì quy định cách làm các phase sau; không chạm DB/API.

### Phase 0 — Rule
- [ ] **0.1.1 Bổ sung rule vào `workflows/erp-api-structure.md`** (D4.1–D4.4) · Files: `[MODIFY] erp/erp-api/.agents/workflows/erp-api-structure.md` · DoD: có 4 mục; không trùng rule cũ · Verification: `bun .agents/skills/erp-api-structure/scripts/scan-oversized-files.ts` không liên quan; kiểm bằng đọc diff + bước 0.1.3
- [ ] **0.1.2 Bổ sung vào `references/v2-module.md`** mục 0b/1b · Files: `[MODIFY] …/references/v2-module.md` · DoD: khớp 0.1.1
- [ ] **0.1.3 Đồng bộ adapter** · chạy `/sync-agents`, `bash .agents/scripts/validate-agent-system.sh` · DoD: không DRIFT

### Phase 1 — Database
- [ ] **1.1.1 Đổi tên bảng dòng** · `[NEW] src/migrations/<ts>-rename-case-services-to-case-lines-garage.ts` (up/down, đổi cả index/constraint) · DoD: bảng `case_lines_garage`, 5424 dòng giữ nguyên · Verification: `bunx tsc --noEmit`; sau `OK`: `bun run migration:run` trên staging đã báo tên DB
- [ ] **1.1.2 Thêm `source_snapshot`, `overrides` (jsonb, default `{}`) cho `cases_garage` và `case_lines_garage` + backfill snapshot từ giá trị hiện có** · `[NEW] src/migrations/<ts>-add-override-columns-cases-garage.ts` · DoD: 753 header, 5424 dòng có snapshot, `overrides = {}` · Verification: truy vấn đếm sau migrate
- [ ] **1.1.3 Xóa cột thừa và thêm khóa nối dòng** · `[NEW] src/migrations/<ts>-drop-legacy-columns-cases-garage.ts` · thứ tự trong `up()`: tạo unique `(account_key, external_id)` trên `case_lines_garage` → drop `UQ_case_services…legacy_service_id` và cột `legacy_service_id` → drop `UQ_cases_garage_legacy_case_id` và cột `legacy_case_id` → drop `external_delete_count`. `down()` thêm lại cột, backfill `legacy_case_id = id`, `legacy_service_id` từ `kgara_case_services` theo `external_id`, `external_delete_count` về 0 (mất đếm lịch sử, ghi chú trong migration) · DoD: không còn 3 cột; 5424 dòng vẫn duy nhất theo `(account_key, external_id)` · Verification: `bunx tsc --noEmit`; sau `OK`: `bun run migration:run` rồi truy vấn `information_schema.columns`

- [ ] **1.2.1 Thêm cột tiến độ** · `[NEW] src/migrations/<ts>-add-progress-columns-cases-garage.ts`: `started_at`, `expected_completion_at` (timestamptz), `request_description`, `diagnosis` (text), `assignee_id` (uuid, FK mềm tới `employees_management.id`, index), `progress_stage` (varchar 30), `progress_percent` (smallint, check 0–100), `progress_updated_at`, `progress_updated_by`, `advisor_code`, `advisor_name`; index `(status, expected_completion_at)` · DoD: có `down()`; tất cả cột nullable, không làm hỏng 753 dòng · Verification: `bunx tsc --noEmit`; sau `OK`: `bun run migration:run`
- [ ] **1.2.2 Backfill từ `kgara_cases.raw_data`** cho `started_at` (739), `advisor_*` (739), `expected_completion_at`, `request_description`, `diagnosis` (hiện 0 giá trị, vẫn chạy để khớp khi KGara có dữ liệu); đồng thời ghi vào `source_snapshot`. Parse ngày theo giờ VN giống `vnLocalDateTimeToInstant` · `[NEW] src/migrations/<ts>-backfill-progress-from-kgara.ts` · DoD: số dòng có `started_at` = 739; kiểm một dòng mẫu đối chiếu raw_data · Verification: truy vấn đếm sau migrate

### Phase 2 — API
- [ ] **2.1.1 Tạo `cases-core`** (plop `api-core`): `BaseCaseEntity`, `BaseCaseLineEntity`, manifest, barrel · `[NEW] src/v2/core/cases-core/**` · Verification: `bunx jest plop-helpers/apiCoreLayout.test.mjs` hoặc lệnh test plop của repo
- [ ] **2.2.1 `CaseGarage extends BaseCaseEntity`** (bỏ cột đã nằm ở lõi, giữ `name:` snake_case) · `[MODIFY] entities/case-garage.entity.ts` · Verification: `bunx tsc --noEmit`
- [ ] **2.2.2 `CaseLineGarage extends BaseCaseLineEntity`; đổi tên entity/`@Entity`** · `[MODIFY→RENAME] entities/case-service-garage.entity.ts` + cập nhật 8 file tham chiếu (mapper, projector, query, writer…) · Verification: `bunx tsc --noEmit`, `bunx jest --findRelatedTests` các file đã sửa
- [ ] **2.2.3 Bỏ cột đã xóa khỏi entity/mapper/field map** (`legacyCaseId`, `legacyServiceId`, `externalDeleteCount`) · `[MODIFY] entities/*.entity.ts`, `helpers/kgara-case.mapper.ts`, `helpers/kgara-case.field-map.ts`, `helpers/kgara-case-service.field-map.ts` · Verification: `bunx tsc --noEmit`, `bunx jest src/v2/modules/cases-garage/helpers`
- [ ] **2.2.4 Xóa hẳn "erp-local" và mirror v2→v1** · `[DELETE] services/case-kgara-mirror.service.ts(+spec)`; `[MODIFY]` bỏ nhóm `erp-local`/`direction 'both'`/`mapBackward`/`CASE_ERP_LOCAL_FIELDS`/`SERVICE_ERP_LOCAL_FIELDS` ở `kgara-case.field-map.ts`, `kgara-case-service.field-map.ts`, `kgara-field-map.engine.ts`, `kgara-case.mapper.ts` (`caseGarageErpLocalToKgara`, `caseServiceErpLocalToKgara`), `case-origin.guard.ts`, `case-command.service.ts`, `case-line-command.service.ts`, `cases-garage.module.ts`, và comment/Swagger/DTO/controller có chữ "ERP-local" · DoD: `grep -ri "erp-local" src/v2/modules/cases-garage` rỗng; không còn lệnh `manager.update(KgaraCase|KgaraCaseService, …)` trong cases-garage · Verification: `bunx tsc --noEmit`; `bunx jest src/v2/modules/cases-garage`
- [ ] **2.3.1 Helper override thuần** (`applyProjection`, `markOverride`, `revertField`) + spec · `[NEW] helpers/case-override.helper.ts(+spec)` · Verification: `bunx jest src/v2/modules/cases-garage/helpers/case-override.helper.spec.ts`
- [ ] **2.3.2 Projector theo luật D3.1, D3.4; nối dòng theo `(accountKey, externalId)`, dùng `id` làm khóa vụ việc** · `[MODIFY] services/case-projector.service.ts` (+spec) · DoD: sync không ghi đè field đã override, không hồi sinh dòng `_deleted` · Verification: jest spec projector
- [ ] **2.3.3 Command: sửa xe sync ghi effective + `overrides`, không ghi gì sang `kgara_*`; endpoint về giá trị KGara** · `[MODIFY] services/case-command.service.ts`, `[NEW]` endpoint revert trong controller ghi (+DTO, RBAC `UPDATE`) · Verification: jest spec command/controller
- [ ] **2.3.4 Nới `case-origin.guard.ts`** theo D3.5 (giữ chặn định danh/tiền suy ra) · `[MODIFY] helpers/case-origin.guard.ts` (+spec) · Verification: jest spec guard
- [ ] **2.4.1 Response bổ sung `overriddenFields`** (danh sách khóa) cho header và dòng · `[MODIFY] helpers/case-response.mapper.ts`, `dto/case-response.types.ts` · Verification: jest spec mapper
- [ ] **2.5.1 Audit trail** ghi vào `erp_audit_logs` cho override/revert · `[MODIFY] services/case-command.service.ts` · Verification: jest spec

- [ ] **2.6.1 Mở rộng field map + projector cho nhóm tiến độ sync** (`startedAt`, `expectedCompletionAt`, `requestDescription`, `diagnosis`, `advisorCode/Name`) từ `raw_data`; vì v1 entity có `rawData`, mapper đọc khóa PascalCase của KGara · `[MODIFY] helpers/kgara-case.field-map.ts`, `helpers/kgara-case.mapper.ts`, `services/case-projector.service.ts` (+spec) · Verification: `bunx jest src/v2/modules/cases-garage/helpers/kgara-case.field-map.spec.ts src/v2/modules/cases-garage/helpers/kgara-case.mapper.spec.ts`
- [ ] **2.6.2 Enum và DTO tiến độ**: `CaseProgressStage`, `UpdateCaseProgressDto` (class-validator), `CaseProgressItem` response · `[NEW] entities/case-progress.enums.ts`, `dto/case-progress.dto.ts` · Verification: `bunx tsc --noEmit`
- [ ] **2.6.3 Service ghi tiến độ** (kiểm tra `assigneeId` cùng chi nhánh, cập nhật `progressUpdatedAt/By`, audit) · `[NEW] services/case-progress-command.service.ts` (+spec) · Verification: `bunx jest src/v2/modules/cases-garage/services/case-progress-command.service.spec.ts`
- [ ] **2.6.4 Service đọc bảng theo dõi** (lọc, sắp xếp, `elapsedMinutes`, `isOverdue`, tóm tắt dòng khi thiếu nội dung) · `[NEW] services/case-progress-query.service.ts`, `helpers/case-progress.mapper.ts` (+spec) · Verification: `bunx jest src/v2/modules/cases-garage/services/case-progress-query.service.spec.ts`
- [ ] **2.6.5 Controller `GET /progress`, `PATCH :id/progress` + RBAC** · `[MODIFY] controllers/cases-garage.controller.ts`, `controllers/cases-garage-commands.controller.ts`, `cases-garage.module.ts` · Verification: `bunx jest src/v2/modules/cases-garage/controllers`. Chú ý đặt route `progress` trước `:id` để không bị bắt nhầm.

### Phase 3 — QC & Knowledge
- [ ] **3.1.1 Jest scope cases-garage + type:check + scanner `--strict`** · `bunx jest src/v2/modules/cases-garage src/v2/core/cases-core`; `bun run type:check`; `bun .agents/skills/erp-api-structure/scripts/scan-oversized-files.ts --strict`
- [ ] **3.1.2 Smoke API đang chạy** (`test/smoke/cases-garage-v2.smoke.mjs`, thêm kịch bản override → sync → giữ giá trị v2 → revert) · tài khoản `ai-test-*`, `E2E_API_URL` theo `PORT` trong `.env`, không DB production
- [ ] **3.2.1 Knowledge Sync**: `skills/modules/cases-garage/SKILL.md` (từ điển, override, bảng use case→field; xóa mọi chỗ "ERP-local", "mirror V2→V1", `legacyCaseId`, `legacyServiceId`, `externalDeleteCount` ở dòng 12, 29, 48 và nơi khác), tạo SKILL `cases-core`, chạy `/sync-agents` · DoD: `grep -ri "erp-local\|legacyCaseId\|legacyServiceId" erp/erp-api/.agents/skills/modules/cases-garage` rỗng (skill `erp-local-changes-*` là tên khác, không đụng)

Mỗi file mới/sửa dưới 180 dòng theo rule (entity header hiện 250 dòng sẽ giảm khi chuyển cột lên lõi; nếu vẫn >180 sẽ tách helper).

## Rollback
- Migration có `down()` (đổi tên ngược; drop hai cột jsonb). Code hoàn tác bằng revert commit; `source_snapshot` không làm mất dữ liệu hiệu lực.
- Backup trước khi `migration:run` theo skill `db-migrate`.

## Breaking changes / follow-up Web (ngoài phạm vi plan này)
- Không đổi route/field response hiện có. Thêm `overriddenFields` và endpoint revert; Web cần hiển thị chỉ báo "đã sửa ở v2" và nút "về giá trị KGara" (plan riêng cho erp-web).
- Mọi chỗ khác đọc bảng cũ `case_services_garage` bằng SQL thô phải đổi tên (đã liệt kê ở 2.2.2).

## Spec: tiêu chí chấp nhận
| AC | Task | Verification |
|---|---|---|
| AC-1 Rule có 4 mục mới, sync adapter không DRIFT | 0.1.1–0.1.3 | validate-agent-system |
| AC-2 Bảng dòng đúng tên `case_lines_garage`, dữ liệu nguyên vẹn | 1.1.1 | đếm 5424 |
| AC-3 Snapshot + overrides có đủ trên 753/5424 | 1.1.2 | truy vấn đếm |
| AC-4 `CaseGarage`/`CaseLineGarage` kế thừa `cases-core`, lõi không có `@Entity` | 2.1.1, 2.2.1, 2.2.2 | tsc, test layout |
| AC-5 Sửa ở v2 không đổi `kgara_*`; sync không ghi đè field đã sửa | 2.3.2, 2.3.3 | jest + smoke |
| AC-6 Về giá trị KGara khôi phục đúng | 2.3.3 | jest + smoke |
| AC-7 Xóa mềm dòng v2 không bị sync hồi sinh | 2.3.2 | jest |
| AC-8 Skill module cập nhật, không còn "erp-local" | 3.2.1 | sync-agents --check, grep rỗng |
| AC-9 Không còn cột `legacy_case_id`, `legacy_service_id`, `external_delete_count`; dòng nối bằng `(account_key, external_id)` | 1.1.3, 2.2.3, 2.3.2 | truy vấn schema + jest projector |
| AC-10 Không còn mirror v2→v1 và nhóm erp-local trong code | 2.2.4 | grep rỗng, jest |
| AC-11 Có cột tiến độ; 739 vụ việc có `started_at` và `advisor_*` từ KGara | 1.2.1, 1.2.2 | truy vấn đếm |
| AC-12 Sync chép nhóm tiến độ và tôn trọng override | 2.6.1 | jest projector |
| AC-13 `PATCH :id/progress` cập nhật KTV/công đoạn/%/ngày hẹn, kể cả xe sync, không đổi `kgara_*`; validate sai trả 400 | 2.6.2, 2.6.3, 2.6.5 | jest + smoke |
| AC-14 `GET /progress` trả đủ cột anh yêu cầu, `elapsedMinutes`, `isOverdue`, lọc theo KTV/công đoạn/quá hạn | 2.6.4, 2.6.5 | jest + smoke |

## Verification end-to-end
1. Staging đã báo tên DB; chạy migration.
2. Sync một vụ việc: sửa `customer_name` ở v2, chạy lại sync → giá trị v2 giữ, `kgara_cases.khach_hang_name` không đổi, `source_snapshot` cập nhật.
3. Gọi revert → giá trị về KGara, `overrides` bỏ khóa.
4. CI GitHub xanh (check, test, build) trên commit cuối trước khi báo xong.
