# Task: AR Phase 2D — UC#4 Cấn trừ tiền cọc vào invoice

## Request Input
- Type: FEATURE
- Mục tiêu: Implement UC#4 — Apply customer advance (tiền cọc) vào AR invoice/document
- Bối cảnh: Phase 2C đã có advance receipt. UC#4 cần API + UI để cấn trừ advance vào invoice (N131_advance / C131_invoice pattern), tức là tạo ar_applications type=ADVANCE_APPLICATION linking advance voucher → ar_document.

## Goal
Cho phép operator chọn 1 advance voucher (POSTED, còn remaining_amount > 0) + 1 AR document (POSTED, còn open_amount > 0) và apply amount ≤ min(advance.remaining, invoice.open_amount). Kết quả:
- Tạo ar_application record (ADVANCE_APPLICATION / POSTED)
- Triggers tự recalc advance.ar_advance_applied/remaining
- Triggers tự recalc ar_document.settled_amount/open_amount/status
- Không cần JE riêng (bút toán N131advance/C131invoice là internal offset, không ảnh hưởng P&L)

## Scope
- In-scope: DTO applyAdvanceToInvoice, service applyAdvanceToInvoice + findAdvanceApplications, controller endpoints, Web UI tab "Cấn trừ cọc"
- Out-of-scope: Partial advance split > 1 invoice trong 1 lần, FX difference

## Relevant Files
- `src/ar-workbench/dto/apply-advance-to-invoice.dto.ts` — mới
- `src/ar-workbench/ar-workbench.service.ts` — thêm applyAdvanceToInvoice, findAdvanceApplications, reverseAdvanceApplication
- `src/ar-workbench/ar-workbench.controller.ts` — thêm 3 endpoints
- `src/ar-workbench/dto/create-ar-application.dto.ts` — đã có ADVANCE_APPLICATION type

## Gate 0 — DB Precheck
- Collections: ar_applications, payment_vouchers (ar_advance_*), ar_documents (open_amount, settled_amount)
- Trigger recalc đã có: liouni_ar_application_advance_recalc_aiud + ar_applications_recalc_aiud
- Index: ar_applications_payment_voucher_idx, ar_applications_target_idx đã có
- Constraint gap phát hiện khi smoke: `ar_applications_type_chk` chưa allow `ADVANCE_APPLICATION`; `source_document_id` là FK tới `ar_documents` nên không dùng cho payment voucher source.
- Kết quả: DB_GAP_FOUND → fixed bằng Directus staging migration `20260511_ar_phase2d_advance_application_constraint.sql`; sau fix DB_READY.

## Coordination Impact
- [x] ERP Web contract affected (thêm tab Cấn trừ)
- [x] Directus staging schema affected (widen `ar_applications_type_chk`)

## Checklist
- [x] 1.0 Gate 0 DB Precheck done
- [x] 2.0 DTO applyAdvanceToInvoice
- [x] 3.0 Service methods (applyAdvanceToInvoice, findAdvanceApplications, reverseAdvanceApplication)
- [x] 4.0 Controller endpoints
- [x] 5.0 Web UI tab Cấn trừ cọc
- [x] 6.0 Build + smoke
- [x] 7.0 Commit + push

## Validation Evidence
- DB precheck: DB_GAP_FOUND on `ar_applications_type_chk`; backup `/opt/backups/directus-staging/20260511151103-pre-uc4-constraint.sql`; migration applied; verify constraint includes `ADVANCE_APPLICATION`; final DB_READY.
- API build: `npm run build` PASS.
- Web build: `npm run build` PASS (Vite chunk warnings only, existing pattern).
- Runtime deploy: API container recreated, Web container recreated.
- Runtime web marker check: `http://127.0.0.1:8808/` returns `200`; served JS asset contains `Cấn trừ cọc` / `advanceApplications` marker.
- Runtime API route check: `https://dev.api.erp.liouni.com/api/v1/ar-workbench/advance-applications` unauthenticated returns `401 Không tìm thấy access token`, confirming route is live behind auth.
- Smoke:
  - Apply advance 40,000: PASS (`ADV_REMAIN=20000.00`, `INV_OPEN=70000.00`).
  - Over-apply guard: PASS (`HTTP 400`).
  - Reverse advance application: PASS (`advance_remaining=60000.00`, `invoice_open=110000.00`, app status `REVERSED`).
  - Read-only DB evidence after reverse: latest `ADVANCE_APPLICATION` row is `REVERSED` with payment voucher + target document links; `UC4-ADV-20260511150952` remaining restored to `60000.00`; `UC4-INV-20260511150952` open amount restored to `110000.00`.

## Lessons Learned
- Gate 0 phải inspect cả `pg_constraint` cho enum-like text fields; chỉ thấy trigger/function không đủ để kết luận DB_READY.
- `ar_applications.source_document_id` là FK tới `ar_documents`; với advance voucher source phải dùng `payment_voucher_id`, không set `source_document_id` bằng voucher id.

## Commit/Push Status
- API repo: committed + pushed `1b7ece4 feat(ar): apply customer advances to invoices`; task close-out evidence pushed in `0e44865 docs(ar): close advance application task`.
- Web repo: committed + pushed `845fab8 feat(ar): apply advances to invoices in workbench`.
- DB: migration applied to Directus staging; DB repo file created for evidence; per ops rule DB repo commit/push not required.
