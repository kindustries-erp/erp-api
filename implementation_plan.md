# Business Partners V2: API Filter Contract

RequestFeedback: false

## Gate 0

- [x] **Task 1.1.1: Xác nhận DB runtime**
  - **Kết quả**: `DB_READY`; `.env` trỏ `erp_greenway_production`, chỉ đọc schema `erp_business_partners`, không có migration.

## API Backend

- [x] **Task 2.1.1: Mở rộng DTO phân trang cho bộ lọc V2**
  - **Files**: `src/common/dto/pagination.dto.ts`
  - **DoD**: nhận `column_operators` và `date_ranges` dưới dạng JSON string, giữ tương thích request cũ.
  - **Verification**: `bunx tsc --noEmit`
- [x] **Task 2.2.1: Áp dụng bộ lọc V2 an toàn vào danh sách**
  - **Files**: `src/business-partners-core/business-partners-core.service.ts`
  - **DoD**: whitelist cột/toán tử; hỗ trợ text/date/blank/all-matching và không ghép SQL từ input tự do.
  - **Verification**: `bunx jest src/business-partners-core/business-partners-core.service.spec.ts`
- [x] **Task 2.2.2: Đồng bộ lọc chéo cho column-options**
  - **Files**: `src/business-partners-core/business-partners-core.service.ts`, `.spec.ts`
  - **DoD**: hiểu payload V2 gồm filters/search/operators/date ranges và vẫn đọc payload V1.
  - **Verification**: `bunx jest src/business-partners-core/business-partners-core.service.spec.ts`

## QC & Knowledge

- [x] **Task 4.1.1: Final Gate API** — `build -> check:style -> full test` PASS trên working tree; wrapper `verify:final` yêu cầu commit sạch.
- [x] **Task 4.3.1: Cập nhật module skill và walkthrough**

## Session Checkpoint

- **Active Task**: Không còn task đang thực hiện.
- **Branch**: `erp-master` (behind remote 2 commits lúc bắt đầu)
- **DB**: `erp_greenway_production`, read-only verification
- **Verification**: 17 scoped Jest tests PASS; build/style PASS; full suite 175 files, 1.291 tests PASS, 10 skipped.
