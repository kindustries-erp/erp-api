---
name: cases-garage
description: Module vụ việc garage v2 (api/v2/cases-garage), CRUD đầy đủ trên bảng cases_garage + case_services_garage, xe NATIVE nhập tay và xe KGARA_SYNC chiếu từ V1 (kgara_cases), kèm từ điển tên V1 sang V2 và projector/mirror/backfill. Đọc trước khi sửa vụ việc garage, projector hoặc field-map.
---

# cases-garage (api/v2/cases-garage)

Vị trí: `src/v2/modules/cases-garage`. Entity `CaseGarage` (header, `cases_garage`, soft delete `isDeleted`) và `CaseServiceGarage` (dòng, `case_services_garage`, FK `case_id` ON DELETE CASCADE). Migration `20261119120000-create-cases-garage-tables`. Plan: `build-v2-garage-cases-crud`.

## 1. Nguồn gốc (`origin`)
- `NATIVE`: nhập tay ở v2, sửa mọi field, xóa mềm được. Tổng tiền tính từ dòng trong cùng transaction; `paidAmount` = 0 cho tới khi nối thu chi/cấn trừ.
- `KGARA_SYNC`: chiếu từ `kgara_cases`, cùng UUID với `kgara_cases.id` (`legacyCaseId`). Chỉ sửa nhóm ERP-local: `classification`, `categoryId`, `classificationManuallyCleared`, `excludeFromReports`, `excludeFromDebt`, `internalNotes`, `partsCost` của dòng. Field khác 400, xóa 409 (`CaseOriginGuard`).

## 2. Route (route tĩnh trước `:id`)
Đọc (`GARAGE:READ`): `GET /`, `column-options`, `services`, `gross-profit-report`, `by-code/:code`, `:id`. Query: `page`, `pageSize` ≤ 200, `search`, `sort`, `column_filters`, `column_*`, `date_ranges`, `summary_keys`, `origin`.
Ghi (`CasesGarageCommandsController`): `GET next-code`, `POST /` (CREATE), `PATCH :id` (UPDATE), `PATCH :id/status`, `DELETE :id` (DELETE), `POST :id/services`, `PUT :id/services/:lineId`, `PATCH :id/services/:lineId/parts-cost`, `DELETE :id/services/:lineId`.
Chi nhánh: header `x-kgara-branch-id` bắt buộc (thiếu 400). Mọi đọc/ghi kèm `branchExternalId`; xe chi nhánh khác = 404. Role `ai-test-tao` không có `GARAGE:DELETE` (403); smoke dùng `ai-test-duyet`.

## 3. Quy tắc
- Mã xe NATIVE: `VV-YYYYMMDD-NNN` (tái dùng `nextDocumentNo`). Unique `(branchExternalId, accountKey, caseCode)` khi chưa xóa (`UQ_cases_garage_case_code_active`).
- Trạng thái `CaseStatus` (`INTAKE`, `QUOTED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`) map từ `tinh_trang_dich_vu` 0/1/2/3/9 ở `kgara-status.map.ts`; `canTransition` giới hạn chuyển trạng thái của NATIVE.
- Dòng NATIVE: thành tiền do server tính (`computeLineAmounts`), DTO không nhận `amountBeforeTax`/`amountWithTax`. Sửa dòng khóa `pessimistic_write` header.
- Gross profit join `kgara_gross_profit.vu_viec_code = caseCode` cho SYNC; không join theo id KGara.
- Sort theo biểu thức SQL + phân trang: truy vấn hai bước (id có sort rồi entity). Filter/sort/summary dùng `common/utils/table-query`.
- Số tiền response là number; không trả `raw_data`.

## 4. Đồng bộ V1 ↔ V2
- Projector V1→V2: port `GARAGE_CASE_PROJECTOR` (`kgara-api-core/hub/case-projector.port.ts`), `CaseProjectorService`, idempotent theo `id`/`legacyServiceId`, lỗi chỉ log. Hook V1: `sync-case.service.ts` (3 điểm), `kgara-case-config.service.ts`, `kgara-case-lookup.service.ts`, `sync-deletion.service.ts`. Query-builder `update()` và writer khác không có hook, backfill đối soát.
- Mirror V2→V1 (`CaseKgaraMirrorService`): sửa ERP-local trên xe SYNC ghi ngược `kgara_cases` cùng transaction.
- Backfill: `scripts/backfill-cases-garage-from-kgara.ts` (dry-run mặc định; `--apply --confirm=<db>`; `--limit`, `--branch`). Chạy bằng `TS_NODE_TRANSPILE_ONLY=1 node -r ts-node/register -r tsconfig-paths/register` (bun lỗi vòng import `data-source`).
- Một bộ map duy nhất: `helpers/kgara-case.field-map.ts`, `kgara-case-service.field-map.ts` + engine `kgara-field-map.engine.ts`; projector, mirror, backfill chỉ gọi `kgara-case.mapper.ts`. Spec chống lệch đọc metadata TypeORM của `KgaraCase`/`KgaraCaseService`: cột V1 mới phải được map hoặc đưa vào `KGARA_CASE_IGNORED_COLUMNS`.
- Tiền khi chiếu (`revenue`/`cost`/`profit`): `helpers/kgara-case-money.ts` (`resolveKgaraCaseMoney`), cùng quy tắc dashboard V1: `kgara_gross_profit` trước (nối theo `hd_phieu_dich_vu_id` hoặc `vu_viec_code = so_chung_tu`), rồi cột `doanh_thu/chi_phi/loi_nhuan` của `kgara_cases`, rồi `tien_co_thue`, rồi 0; lợi nhuận thiếu thì doanh thu trừ chi phí. Trước 2026-11-20 projector chỉ chép cột `doanh_thu` nên doanh thu V2 luôn 0. Chiếu lại sau khi sửa bằng backfill. Lưu ý: đổi `kgara_gross_profit` không kích hoạt chiếu lại, chỉ chiếu khi vụ việc V1 đổi.

## 5. Từ điển V1 → V2 (camelCase EN; cột DB snake_case EN)
Header: `so_chung_tu`→`caseCode`, `hd_phieu_dich_vu_id`→`externalId`, `bien_so_xe`→`licensePlate`, `so_khung`→`chassisNumber`, `hang_xe_code/name`→`vehicleBrandCode/Name`, `dong_xe_code/name`→`vehicleModelCode/Name`, `nam_san_xuat`→`manufactureYear`, `khach_hang_code/name`→`customerCode/Name`, `kgara_classification(_code)`→`customerSourceName/Code`, `doi_tuong_thanh_toan_code/name`→`payerCode/Name`, `tinh_trang_dich_vu`→`kgaraStatusCode`+`status`, `ten_tinh_trang_dich_vu`→`statusName`, `ngay_phat_sinh/tiep_nhan/hoan_thanh_cong_viec/giao_xe_full`→`issuedAt/receivedAt/completedAt/deliveredAt`, `tien_co_thue`→`totalAmountWithTax`, `tien_da_thanh_toan`→`paidAmount`, `tien_con_phai_thanh_toan`→`outstandingAmount`, `doanh_thu/chi_phi/loi_nhuan`→`revenue/cost/profit`, `erp_notes`→`internalNotes`, `kgara_deleted_at/count`→`externalDeletedAt/externalDeleteCount`. `exclude_from_*`, `category_id`, `classification*` đổi sang camelCase cùng nghĩa. Không chép `raw_data`, `data_as_of`.
Dòng: `noi_dung_chi_tiet`→`description`, `san_pham_code/name`, `loai_san_pham_code`→`productCode/productName/productTypeCode`, `don_vi_tinh_text`→`unitName`, `so_luong_hoa_don`→`quantity`, `don_gia`→`unitPrice`, `tien_chua_thue/co_thue`→`amountBeforeTax/amountWithTax`, `thue_suat`→`taxRate`, `so_gio_cong_lam`→`laborHours`, `tien_dich_vu/phu_tung`→`serviceAmount/partsAmount`, `gia_von_phu_tung`→`partsCost`, `ty_le/tien_chiet_khau_ct`→`lineDiscountRate/Amount`, `tien_phu_phi`→`surchargeAmount`, `kho_code`→`warehouseCode`, `deleted_at`→`externalDeletedAt`.

## 6. Chưa làm / follow-up
- Công nợ, thu chi, cấn trừ, hóa đơn liên kết vẫn ở V1; `paidAmount` NATIVE chưa nối. Projector không có `raw_data` nên list bỏ tách phải thu bảo hiểm/khách (cần khi cutover công nợ).
- **Web follow-up (breaking đã báo)**: tên field response đổi từ tiếng Việt sang EN (`soChungTu`→`caseCode`, `bienSoXe`→`licensePlate`...); `phaiThuKhachHang`/`phaiThuBaoHiem` đã bỏ. Web chưa gọi `api/v2/cases-garage`; type `GarageCaseVehicleFields` (`erp-web/src/v2/core/garage-cases/vehicle/`) còn dùng tên V1, phải sửa khi nối Web.
- Smoke: `bun run test:smoke:cases-garage-v2` (chi nhánh giả `smoke-<tag>`, xóa mềm cuối chạy).

## 7. Liên quan: báo cáo theo xe
`cases_garage` mỗi dòng là một phiếu (không có khóa xe). Báo cáo/drill-down theo XE nằm ở module `cases-dashboard-garage` (`GET api/v2/cases-dashboard-garage`, mỗi dòng một xe; tổng/phễu ở `GET …/overview`; khóa xe = `normalizedPlateSql('license_plate')` trong `src/common/utils/license-plate.ts`: bỏ dấu tiếng Việt, Đ thành D, chỉ giữ `A-Z0-9`; phiếu không biển khóa theo id). Danh sách phiếu `cases-garage` vẫn theo phiếu; đừng dùng `COUNT(id)` làm "số xe".


## Giá vốn `partsCost` từ sync V1 (KINDU-1386, cập nhật 2026-11-21)
- `partsCost` (`parts_cost`) ánh xạ từ V1 `giaVonPhuTung` (field-map `erp-local`/`both`); `CaseProjectorService.projectLines` ghi đè khi chiếu, nên sau `POST sync/gross-profit` V2 phải bằng V1 mà không cần mở drawer. Cổng chiếu được gọi từ `KgaraCaseFinalizeService.finalizePeriod` (kể cả phiếu V1 đã đúng giá vốn) và sau sync chi tiết phiếu.
- Chi tiết luồng journal → giá vốn → V2 và quy tắc không ghi đè `journal_items`: xem `../garage-cases/SKILL.md`, mục "Giá vốn phụ tùng".
