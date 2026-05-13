# Task — FIX Cash/Bank related documents persistence and disable journal reverse

## Request Input
- Type: FIX
- Mục tiêu: Giữ chứng từ liên quan khi tạo/mở lại phiếu tiền mặt/ủy nhiệm thu chi; đảm bảo công nợ cập nhật đã thanh toán; gỡ tính năng đảo bút toán.
- Bối cảnh/ngữ cảnh: User xác nhận thực thi plan đã tạo ở ERP Web task `2026-05-13-plan-fix-cash-voucher-related-doc-persistence-and-ar-settlement.md`.

## Goal
Fix API để persisted `cash_bank_related_documents` luôn được trả lại khi đọc voucher, recompute đầy đủ `settled_amount/open_amount/status` của `ar_documents`, và loại bỏ endpoint đảo bút toán thủ công khỏi Journal Entries.

## Scope
- In-scope:
  - `payment_vouchers` create/update/read liên quan `related_documents`.
  - `ar_documents` settlement recompute khi link đổi.
  - Journal Entries reverse endpoint/service DTO removal hoặc hard-disable.
- Out-of-scope:
  - Thay đổi schema lớn nếu DB gate không yêu cầu.
  - Xoá dữ liệu bút toán đảo đã tồn tại.

## Relevant Files
- `src/payment-vouchers/payment-vouchers.service.ts`
- `src/journal-entries/journal-entries.controller.ts`
- `src/journal-entries/journal-entries.service.ts`
- `src/journal-entries/dto/reverse-journal-entry.dto.ts` (nếu cần xoá khỏi build graph)

## Gate 0 — DB Precheck
- Collections/fields liên quan:
  - `payment_vouchers.id/voucher_type/status/amount`
  - `cash_bank_related_documents.payment_voucher_id/related_type/related_id/amount/sort`
  - `ar_documents.total_amount/settled_amount/open_amount/status`
  - `journal_entries.status` (chỉ đọc, không đổi schema)
- Data nền cần có:
  - Có `ar_documents` sample để smoke link.
  - Hiện `cash_bank_related_documents` có thể rỗng; vẫn DB_READY vì collection/fields/FK tồn tại.
- Constraint/index/default cần có:
  - FK `cash_bank_related_documents.payment_voucher_id -> payment_vouchers.id ON DELETE CASCADE`.
  - `ar_documents.settled_amount/open_amount/status` có field để persist kết quả recompute.
- Kết quả: `DB_READY`.
- Evidence:
  - Precheck psql xác nhận đủ 5 table: `payment_vouchers`, `cash_bank_related_documents`, `ar_documents`, `journal_entries`, `journal_entry_lines`.
  - FK cash-bank related docs tồn tại.

## Coordination Impact
- [ ] Directus staging schema affected
- [x] ERP Web contract affected
- [ ] No cross-system impact

## Checklist
- [x] 1.0 Gate 0 DB Precheck done
- [x] 2.0 Backend workflow/API gate done
  - [x] 2.1 Recompute AR settlement patch cả `settled_amount`, `open_amount`, `status`
  - [x] 2.2 Đảm bảo related docs được attach sau create/update/findOne/findAll
  - [x] 2.3 Gỡ/hard-disable journal reverse endpoint
- [x] 3.0 UI handoff gate done
- [ ] 4.0 Validate
  - [ ] 4.1 `npm run build`
  - [ ] 4.2 Smoke test affected endpoints
  - [ ] 4.3 Reverse endpoint không còn callable
- [ ] 5.0 Close
  - [ ] 5.1 Lessons learned entry (if issue)
  - [ ] 5.2 Commit + push code (web/api)
  - [ ] 5.3 Summary with evidence

## Validation Evidence
- DB precheck result: `DB_READY`; see psql output in session.
- Build: `npm run build` pass
- Smoke:

## Lessons Learned
- Link: No issue yet

## Commit/Push Status
- API repo:
- Web repo (if affected):
- DB/directus staging: no schema change planned
