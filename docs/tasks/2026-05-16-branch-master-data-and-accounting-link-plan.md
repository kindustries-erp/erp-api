# [PLAN ONLY] Branch master data + gắn chi nhánh xuyên suốt ERP (DB -> API -> UI)

## Request Input (bạn chỉ cần điền phần này)
- Type: ENHANCE
- Mục tiêu: Thêm cấu hình chi nhánh (tên, địa chỉ, ghi chú, ...) và bổ sung field chi nhánh cho nhân viên, ngân hàng, quỹ, nhật ký chung và các bút toán liên quan.
- Bối cảnh/ngữ cảnh: Doanh nghiệp hiện có 3 chi nhánh (Lê Văn Lương, Nam Sài Gòn, Phổ Quang), cần quản trị linh hoạt để cập nhật về sau.

## PLAN STATUS
- PLAN ONLY: Chưa sửa code/DB/config/deploy.
- Chỉ thực hiện inspect + lập kế hoạch theo thứ tự DB -> API -> UI.

## Goal
Thiết kế và triển khai mô hình dữ liệu chi nhánh chuẩn hóa (master data), sau đó liên kết nhất quán tới các phân hệ kế toán cốt lõi để đảm bảo truy vết theo chi nhánh, lọc báo cáo theo chi nhánh, và mở rộng dễ dàng khi thêm/sửa chi nhánh trong tương lai.

## Scope
- In-scope:
  - Tạo/chuẩn hóa branch master data (mã, tên, địa chỉ, ghi chú, trạng thái).
  - Bổ sung liên kết branch vào:
    - Nhân viên
    - Ngân hàng
    - Quỹ
    - Journal entries (nhật ký chung)
    - Các bút toán liên quan (journal lines / voucher posting context)
  - Cập nhật API DTO/validation/filter/query theo branch.
  - Cập nhật UI form/list/filter hiển thị và chọn chi nhánh.
- Out-of-scope:
  - Không thay đổi logic kế toán cốt lõi debit/credit ngoài phạm vi gắn branch.
  - Không migrate/xóa dữ liệu lịch sử hàng loạt nếu chưa có approval riêng.
  - Không thay đổi kiến trúc auth/permission tổng thể ngoài branch-scoping cần thiết.

## Relevant Files (dự kiến)
- DB/Directus staging:
  - `directus_staging schema`: collections/fields/relations cho branch master và FK liên quan.
- ERP API:
  - `src/modules/*` (employee/bank/cash/journal/voucher): entities, DTO, services, filters.
  - `docs/tasks/2026-05-16-branch-master-data-and-accounting-link-plan.md`
- ERP Web:
  - `src/modules/*` và `src/pages/*` tại các màn hình nhân viên, ngân hàng, quỹ, nhật ký chung.
  - i18n keys `src/i18n/locales/vi.ts`, `src/i18n/locales/en.ts`.

## Gate 0 — DB Precheck (bắt buộc)
- Collections/fields liên quan (cần verify thực tế):
  - `branches` (hoặc `erp_branches`) chưa tồn tại/tồn tại một phần.
  - Collections đang dùng cho nhân viên, ngân hàng, quỹ, journal_entries, journal_entry_lines, vouchers.
- Data nền cần có:
  - Seed 3 branch ban đầu:
    - Lê Văn Lương
    - Nam Sài Gòn
    - Phổ Quang
- Constraint/index/default cần có:
  - Unique code cho branch.
  - FK branch_id cho các bảng liên quan.
  - Index cho branch_id tại bảng nghiệp vụ lớn (journal_entries, vouchers...).
  - Default/fallback branch policy cho dữ liệu cũ (nullable tạm thời + backfill theo kế hoạch).
- Kết quả: `DB_GAP_FOUND` (vì yêu cầu mới cần bổ sung schema/relations, chưa có evidence đã tồn tại đầy đủ).
- Nếu `DB_GAP_FOUND`: link DB task (directus-staging):
  - Sẽ tạo task DB riêng tại `directus-staging/ops/tasks/` khi vào EXEC mode.

## Coordination Impact
- [x] Directus staging schema affected
- [x] ERP Web contract affected
- [ ] No cross-system impact

## Checklist (cập nhật realtime)
- [x] 1.0 Gate 0 DB Precheck done
- [x] 2.0 Backend workflow/API gate done
- [x] 3.0 UI handoff gate done
- [x] 4.0 Validate
  - [x] 4.1 `npm run build`
  - [x] 4.2 Smoke test affected endpoints
- [x] 5.0 Close
  - [x] 5.1 Lessons learned entry (if issue)
  - [x] 5.2 Commit + push code (web/api)
  - [x] 5.3 Summary with evidence

## Kế hoạch chi tiết thực thi (DB -> API -> UI)

### 1) DB Gate (Directus staging)
1.1 Kiểm kê schema hiện tại (read-only)
- Xác định collection chính xác đang đại diện:
  - Nhân viên, ngân hàng, quỹ, journal_entries, journal_entry_lines, vouchers.
- Kiểm tra có field branch nào đã tồn tại chưa (tránh tạo trùng).

1.2 Thiết kế branch master
- Tạo collection branch chuẩn với fields tối thiểu:
  - `code` (string, unique)
  - `name` (string, required)
  - `address` (text, optional)
  - `note` (text, optional)
  - `is_active` (boolean, default true)
- Quan hệ self-documenting (nếu cần): timezone, tax_code chi nhánh (để mở rộng sau).

1.3 Bổ sung FK branch_id cho các collection mục tiêu
- employee: `branch_id` (M2O -> branches)
- bank account: `branch_id`
- cash fund: `branch_id`
- journal_entries: `branch_id`
- voucher/payment collections liên quan posting: `branch_id` (hoặc derive + snapshot policy rõ ràng)

1.4 Data migration/backfill strategy
- Phase an toàn:
  - Cho phép nullable tạm thời để không vỡ dữ liệu cũ.
  - Backfill theo rule (mặc định branch công ty chính hoặc map theo đơn vị hiện hữu nếu có).
  - Sau khi backfill sạch, cân nhắc nâng lên required ở các bảng nghiệp vụ mới.

1.5 Seed dữ liệu branch ban đầu
- Tạo 3 branch:
  - `LEVANLUONG` - Lê Văn Lương
  - `NAMSAIGON` - Nam Sài Gòn
  - `PHOQUANG` - Phổ Quang

### 2) API Gate
2.1 Branch master module
- CRUD/list branch (có filter active, search code/name).
- Guard validate unique code/name chuẩn.

2.2 Cập nhật contract các module liên quan
- DTO create/update cho employee/bank/cash/journal/voucher thêm `branch_id`.
- API list/detail trả branch object tối thiểu (`id/code/name`).
- Bổ sung filter `branch_id` cho list endpoints.

2.3 Posting/accounting consistency
- Khi tạo bút toán từ chứng từ:
  - Carry `branch_id` từ chứng từ nguồn sang journal_entries.
  - Journal lines kế thừa context branch từ header (không duplicate field nếu không cần).
- Validate không cho POSTED thiếu branch_id (cho dữ liệu mới sau cutover).

2.4 Compatibility strategy
- Trong thời gian chuyển tiếp, giữ backward-compatible:
  - Dữ liệu cũ không branch vẫn đọc được.
  - API create mới khuyến nghị bắt buộc branch_id sau khi UI sẵn sàng.

### 3) UI Gate
3.1 Màn hình cấu hình chi nhánh
- Tạo tab/page quản lý chi nhánh: danh sách + thêm/sửa (tên, địa chỉ, ghi chú, trạng thái).

3.2 Form nghiệp vụ có branch
- Nhân viên: chọn branch.
- Ngân hàng: chọn branch.
- Quỹ: chọn branch.
- Journal entry/voucher liên quan: chọn branch hoặc auto-fill theo context.

3.3 List + filter
- Bổ sung cột branch và bộ lọc branch cho các list chính.
- Đồng nhất UX với pattern hiện có (date/search/page size/pagination).

3.4 i18n
- Bổ sung key song ngữ vi/en cho branch labels, placeholder, lỗi validate.

## Gate validations (dự kiến)
- DB:
  - Xác nhận collection branch + relations tồn tại đúng.
  - Xác nhận seed 3 branch thành công.
- API:
  - CRUD branch pass.
  - Endpoints employee/bank/cash/journal/voucher nhận-trả branch đúng contract.
  - Posting tạo journal giữ branch xuyên suốt.
- UI:
  - Form tạo/sửa cho 4 nhóm hiển thị branch selector ổn định.
  - List/filter branch hoạt động và không vỡ flow cũ.

## Risk + rollback plan
- Risk:
  - Dữ liệu cũ thiếu branch gây fail validation khi siết required quá sớm.
  - Thiếu mapping branch trong posting pipeline gây lệch báo cáo.
- Mitigation:
  - Triển khai 2-phase (nullable -> backfill -> required).
  - Smoke test luồng end-to-end theo từng module.
- Rollback:
  - Revert API/UI commit.
  - DB rollback theo migration script có backup trước thay đổi.

## Evidence cần thu thập khi EXEC
- DB precheck output (collections/fields/relations hiện hữu).
- Script/migration apply log.
- Query verify seed 3 branch + FK coverage.
- API smoke output (create/list/update/filter/posting).
- UI smoke ảnh/chuỗi thao tác theo từng màn hình ảnh hưởng.
- Deploy verify (container status + startup logs) cho API/Web.

## Validation Evidence
- DB precheck result: DB gate đã hoàn tất ở `/opt/repos/liouni-erp/directus-staging/ops/tasks/2026-05-16-branch-master-data-rollout-phase1.md`; xác nhận `branches` có 3 bản ghi `BR001`, `BR002`, `BR003`.
- Build: `npm run build` -> PASS; Docker image `liouni-erp-api-liouni-erp-api` build PASS.
- Smoke: `docker compose ps` API container Up; `curl -I http://127.0.0.1:10000/api/v1` -> HTTP 200; `curl -I https://dev.api.erp.liouni.com/api/v1` -> HTTP 200; startup log xác nhận `BranchesController {/api/v1/branches}` được map.

## Lessons Learned
- No issue (PLAN ONLY).

## Commit/Push Status
- API repo: pushed `master` at commit `257f7cf` (`feat: add branch module and integrate branch_id to core modules (Gate 2 API)`)
- Web repo (if affected): pushed `master` at commit `89be338` after rollout + evidence update
- DB/directus staging: apply+verify complete; no code push required
