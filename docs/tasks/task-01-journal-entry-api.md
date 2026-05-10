# Task Template — ERP API

## Request Input
- Type: FEATURE
- Mục tiêu: Xây dựng API endpoints cho tính năng Journal Entry — list/filter bút toán đã hạch toán + tạo bút toán thủ công
- Bối cảnh/ngữ cảnh: Module kế toán core. Phụ thuộc DB gate: directus-staging/ops/tasks/task-01-journal-entry-db.md (phải DB_READY trước)

## Goal
Cung cấp API endpoints:
1. GET /journal-entries — list với filter: account_id, period_id, status, date range, search voucher_no/description; pagination
2. GET /journal-entries/:id — chi tiết 1 entry + lines
3. POST /journal-entries — tạo manual journal entry (header + lines), validate balanced (sum debit = sum credit)
4. POST /journal-entries/:id/post — chuyển draft -> posted
5. POST /journal-entries/:id/reverse — tạo bút toán đảo ngược

## Scope
- In-scope: CRUD endpoints, validation balanced entry, business rules (không sửa/xóa entry đã posted), Directus SDK queries
- Out-of-scope: reporting/aggregation, import từ file, tự động hạch toán từ module khác

## Relevant Files
- `src/modules/journal-entries/` (tạo mới)
- `src/modules/journal-entries/journal-entries.controller.ts`
- `src/modules/journal-entries/journal-entries.service.ts`
- `src/modules/journal-entries/dto/create-journal-entry.dto.ts`
- `src/modules/journal-entries/journal-entries.module.ts`
- `src/app.module.ts` - đăng ký module mới

## Gate 0 — DB Precheck (bắt buộc)
- Collections/fields liên quan: journal_entries, journal_entry_lines, chart_of_accounts, accounting_periods
- Data nền cần có: DB gate (task-01-journal-entry-db.md) phải hoàn tất với trạng thái DB_READY
- Constraint/index/default cần có: đã xử lý tại DB gate
- Kết quả: `DB_READY` — DB gate đã hoàn tất trong `directus-staging/ops/tasks/task-01-journal-entry-db.md`
- Nếu `DB_GAP_FOUND`: N/A

## Coordination Impact
- [ ] Directus staging schema affected (đã xử lý tại DB gate)
- [x] ERP Web contract affected — cần expose đúng response shape
- [ ] No cross-system impact

## Checklist (cập nhật realtime)
- [x] 1.0 Gate 0 DB Precheck done — xác nhận DB gate READY
- [x] 2.0 Backend workflow/API gate done
  - [x] 2.1 Tạo module journal-entries (NestJS)
  - [x] 2.2 DTO: CreateJournalEntryDto với validation lines balanced
  - [x] 2.3 Service: list với filter/pagination, getById, create, post, reverse
  - [x] 2.4 Controller: routes GET /journal-entries, GET /:id, POST /, POST /:id/post, POST /:id/reverse
  - [x] 2.5 Đăng ký vào AppModule
  - [x] 2.6 Guard: không cho sửa/xóa entry đã posted
- [x] 3.0 UI handoff gate done — export API contract/types cho Web
- [x] 4.0 Validate
  - [x] 4.1 `npm run build`
  - [x] 4.2 Smoke test: POST tạo entry balanced, POST tạo entry không balanced (expect 400), GET list với filter
- [x] 5.0 Close
  - [x] 5.1 Lessons learned entry (if issue)
  - [x] 5.2 Commit + push code (web/api)
  - [x] 5.3 Summary with evidence

## Validation Evidence
- DB precheck result: `DB_READY` — directus-staging/ops/tasks/task-01-journal-entry-db.md
- Build: `npm run build` PASS (Nest build)
- Smoke (local API port 11001, Directus staging admin token, no secret printed):
  - `GET /journal-entries/lookup/accounts` -> 200, 189 accounts
  - `POST /journal-entries` balanced -> 201, id present
  - `POST /journal-entries` unbalanced -> 400
  - `GET /journal-entries?status=draft&account_id=<uuid>&page=1&pageSize=5` -> 200, items returned
  - `GET /journal-entries/:id` -> 200, 2 lines
  - `POST /journal-entries/:id/post` -> 201
  - `POST /journal-entries/:id/reverse` -> 201, reversed_entry_id present
- UI handoff: `docs/api-journal-entries.md`

## Lessons Learned
- Link: `docs/lessons-learned/LL-2026-05-001-journal-entries-schema-alias.md#lessons-learned--journal-entries-api-schema-alias-mismatch`

## Commit/Push Status
- API repo: bắt buộc commit+push khi hoàn tất
- Web repo: bắt buộc commit+push sau gate UI
- DB/directus staging: apply+verify+document (no code push required)
