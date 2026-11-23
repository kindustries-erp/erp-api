---
name: cases-core
description: Lõi đa ngành `src/v2/core/cases-core` (BaseCaseEntity, BaseCaseLineEntity) cho vụ việc/phiếu dịch vụ, chỉ abstract, không bảng. Đọc trước khi thêm module vụ việc ngành mới hoặc đổi field lõi.
---

# cases-core (`src/v2/core/cases-core`)

Chỉ có entity trừu tượng (không `@Entity`, không bảng), `core.manifest.json`, barrel. Module cụ thể kế thừa: hiện có `cases-garage` (`CaseGarage extends BaseCaseEntity`, `CaseLineGarage extends BaseCaseLineEntity`). Tên bảng/entity của module không lấy từ lõi. Generic `BaseCaseEntity<TStatus>` để mỗi ngành có enum trạng thái riêng. TypeORM: khi cột trùng giữa lớp cha và con, lớp cha thắng.

## Field lõi
- `BaseCaseEntity` (extends `CoreSoftDeletableEntity`): `caseCode`, `branchId`, `customerCode/Name`, `payerCode/Name`, `status`, `issuedAt`, `receivedAt`, `startedAt`, `expectedCompletionAt`, `completedAt`, `deliveredAt`, `requestDescription`, `diagnosis`, `assigneeId`, `progressStage`, `progressPercent`, `progressUpdatedAt/By`, `totalAmountWithTax`, `paidAmount`, `outstandingAmount`, `revenue`, `cost`, `profit`, `categoryId`, `classification`, `internalNotes`, `createdBy`.
- `BaseCaseLineEntity` (extends `CoreAuditedEntity`): `caseId`, `lineNumber`, `description`, `productCode/Name`, `unitName`, `quantity`, `unitPrice`, `amountBeforeTax`, `taxRate`, `amountWithTax`, `laborHours`, `serviceAmount`, `partsAmount`, `partsCost`, `lineDiscountRate/Amount`.
- Ở module (không vào lõi): đối tượng riêng ngành (xe), nhóm hệ ngoài (`origin`, `externalId`, `accountKey`, `kgara*`, `customerSource*`), `source_snapshot`/`overrides`, quy tắc báo cáo, danh sách công đoạn.

## Đánh giá use case đa ngành (tiêu chí vào lõi: mọi ngành đều cần)
| Use case | Dùng field lõi |
|---|---|
| Sửa chữa garage | tất cả; xe ở module |
| Bảo hành thiết bị | khách, mã vụ việc, yêu cầu/chẩn đoán, người phụ trách, tiến độ, dòng hạng mục |
| Phòng khám / spa | khách, trạng thái, bắt đầu/hẹn xong, người phụ trách, dòng dịch vụ |
| Ticket IT / công trình | yêu cầu, người phụ trách, tiến độ %, ngày hẹn xong |
Chỉ dùng được cho một ngành thì ở module, chỗ phát sinh sau ghi vào `extra_data` của `CoreBaseEntity`.

## Quy tắc
- Code/response camelCase, cột DB snake_case bằng `name:`.
- Mẫu override cho module đồng bộ từ hệ ngoài: xem `../cases-garage/SKILL.md` mục 4. Helper override thuần nay nằm ở lõi `link-override-core` (`src/v2/core/link-override-core/`), `cases-garage` chỉ giữ re-export mỏng; cột `source_snapshot`/`overrides` vẫn khai báo ở entity module, không vào `cases-core`.
- Test `plop-helpers/apiCoreLayout.test.mjs` chặn `@Entity` trong lõi.
