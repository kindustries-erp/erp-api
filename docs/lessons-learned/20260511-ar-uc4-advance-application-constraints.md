# Lessons Learned — AR UC#4 advance application DB constraints

- ID: LL-2026-05-UC4-001
- Date: 2026-05-11
- Task Link: docs/tasks/20260511-ar-phase2d-apply-advance.md
- Owner: Hermes / Codex

## Context
Implement UC#4: cấn trừ tiền cọc khách hàng vào AR invoice qua `ar_applications`.

## Issue / Symptom
Smoke API tạo `ADVANCE_APPLICATION` fail lần lượt vì:
1. `ar_applications_type_chk` chưa include `ADVANCE_APPLICATION`.
2. API set `source_document_id` bằng payment voucher id, trong khi field này là FK tới `ar_documents`.

## Root Cause
Gate 0 precheck chỉ nhìn columns/triggers/functions, chưa inspect `pg_constraint` và FK semantics của từng reference field.

## Fix Applied
- Widen DB CHECK constraint qua Directus staging migration `20260511_ar_phase2d_advance_application_constraint.sql`.
- API payload dùng `payment_voucher_id` làm source cho advance voucher; không set `source_document_id`.
- Reverse application theo trạng thái `REVERSED` thay vì tạo negative application, phù hợp `amount > 0` constraint.

## Preventive Action
Với các field enum-like text hoặc application type mới, Gate 0 bắt buộc query `pg_constraint`; với các field `*_document_id`, xác nhận FK target trước khi map source/target.

## Reusable Snippet / Pattern (optional)
```sql
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = '<table_name>'::regclass
  AND contype IN ('c','f');
```
