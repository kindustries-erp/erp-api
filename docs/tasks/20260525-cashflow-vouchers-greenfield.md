# Task — Cashflow Vouchers Greenfield (API)

- Type: FEATURE
- Mục tiêu: Tạo mới module `cashflow-vouchers` cho canonical model nghiệp vụ thu chi.
- Bối cảnh: Plan canonical tại `/opt/docs/ai/liouni-erp/tasks/20260524.2047.2328 - cashflow-vouchers-greenfield.md`

## Gate 0 — DB Precheck
- Kết quả: `DB_GAP_FOUND`
- cashflow_vouchers chưa tồn tại trong DB staging.
- payment_vouchers đang tồn tại và không bị rename.
- DB task phải hoàn tất trước API implementation.

## Coordination Impact
- [x] Directus staging schema affected
- [x] ERP Web contract affected

## Checklist
- [x] 1.0 Gate 0 DB Precheck done — DB_GAP_FOUND
- [x] 2.0 DB applied and verified (cashflow_vouchers, cashflow_voucher_related_documents, cashflow_allocations)
  - Backup: `/opt/backups/directus-staging/<ts>/directus-staging-before-cashflow.sql` (26MB)
  - 3 bảng tạo mới, verified qua information_schema + Directus runtime (62/13/23 fields)
- [x] 3.0 cashflow-vouchers module scaffolded
- [x] 3.1 DTOs / types created (create, update, query DTOs)
- [x] 3.2 CRUD + status transitions (cancel, post) — service 939 lines
- [x] 3.3 Counterparty unified lookup endpoint (`GET /parties/lookup`)
- [x] 3.4 Allocation endpoints (GET, POST, DELETE per allocation)
- [x] 3.5 Related-document endpoints (GET, POST, DELETE per related doc)
- [x] 3.6 Timeline/audit endpoint
- [x] 3.7 Journal posting — gọi Directus admin token tạo journal_entries nếu có
- [x] 3.8 AppModule registration
- [x] 4.0 `nest build` PASS (via Docker build; exit 0)
- [x] 4.1 Smoke `GET /api/v1/cashflow-vouchers` → `{"items":[],"total":0,"page":1}` với Bearer token (HTTP 200)
- [x] 5.0 Commit + push (done — see Commit/Push Status)

## Validation Evidence
- DB: 3 bảng cashflow_* — information_schema PASS
- Directus: 62 fields / 13 fields / 23 fields verified after restart
- API build: `nest build` exit 0 inside Docker (layer #11 DONE 5.3s)
- Container: `liouni-erp-api Up` after `docker compose up -d --build`
- Smoke GET /api/v1/cashflow-vouchers: HTTP 200, `{"items":[],"total":0,"page":1,"pageSize":3}`
- 401 unauthenticated: HTTP 401 Unauthorized (JWT guard active)

## Rollback
- DB: restore từ backup `/opt/backups/directus-staging/<ts>/directus-staging-before-cashflow.sql`
- API: `git -C /opt/repos/liouni-erp/liouni-erp-api revert <commit>` + `docker compose up -d --build`
- Tables: `DROP TABLE cashflow_allocations, cashflow_voucher_related_documents, cashflow_vouchers CASCADE;`

## Lessons Learned
- `write_file` dùng tool nào cũng có thể prefix line numbers vào file thật (lỗi `1|import...`). Phải kiểm tra raw bytes hoặc rewrite sạch nếu có artifact.
- `sed -i` trên Unicode file Vietnam cần kiểm tra context rộng hơn để tránh replace nhầm dòng.

## Commit/Push Status
- API repo: committed and pushed
