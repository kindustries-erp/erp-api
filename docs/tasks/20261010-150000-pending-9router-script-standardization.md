# TODO còn pending: 9router, số chứng từ, chuẩn hóa script

Cập nhật: 2026-10-10 · Nhánh: `erp-master` · Bối cảnh: đợt tối ưu 9router + script invoice (xem commit cùng ngày).

## 0. Đã xong trong đợt này (để đối chiếu)
- `NineRouterClient`: retry đúng loại lỗi, timeout/retry qua env, `NineRouterError`, bản đồ tier→model (`NINE_ROUTER_TIER_MODELS`), health-check sâu `GET /ai-hub/health-check?deep=true`.
- Captcha dùng chung client; lỗi cấu hình (thiếu/sai key) dừng ngay cả hai cổng.
- `invoice-ai.handler.ts` tách module thuần (`handlers/invoice/`); `fallbackReason`; marker `[T0003_FALLBACK:<lý do>]`; bộ nhớ theo người bán (`InvoiceCategoryMemoryService`).
- Script phân loại `scripts/backfill-invoice-categories-autopost.ts` viết lại (mode `new|retry-fallback|unposted`, dry-run mặc định); script item-codes dùng handler.
- Migration `20261010150000-CreateDocumentSequences` (idempotent, no-op trên greenway).
- Loader env `src/common/scripts/load-script-env.ts`, `script-db.ts` (dry-run bằng rollback), `dry-run-probe.helper.ts`.
- Dọn 70 script không còn được tham chiếu; workflow `/api-service-refactor`, script scan, SKILL và `CLAUDE.md` đã cập nhật.

## 1. VIỆC VẬN HÀNH (cần làm ngay, không phải code)
- [ ] **Tier 9router đang hỏng** (`low/medium/high` → 503 "No active credentials for provider: codex"; `ultra` → 404). AI phân loại hóa đơn, trích biển số, captcha… đang rơi về lỗi.
  - Cách nhanh: thêm vào file env và **secret GitHub** `ERP_MASTER_API_ENV`, `GREENWAY_PRODUCTION_API_ENV`, `GREENWAY_STAGING_API_ENV`, `KLOTUS_PRODUCTION_API_ENV`, `KLOTUS_STAGING_API_ENV`:
    `NINE_ROUTER_TIER_MODELS={"low":"ag/gemini-3.8-flash-low","medium":"ag/gemini-3.8-flash-medium","high":"ag/gemini-3.8-flash-high"}`
  - Cách gốc: sửa credentials provider `codex` ở 9router.
  - Kiểm tra sau khi deploy: `GET /ai-hub/health-check?deep=true` kỳ vọng `ok: true` và đủ 3 tier.
- [ ] **Model `ag/gemini-3.7-flash-*` bị upstream trả 404** — rà các chỗ còn nhắc model này (comment/prompt/doc) và chuyển sang `3.8`.
- [ ] **Deploy**: pipeline `erp-master` chạy migration gate tự động. Migration mới là no-op trên DB đã có bảng; sẽ tạo `erp_document_sequences` trên klotus-staging/production khi các nhánh `erp-klotus-*` được sync.

## 2. CHUYỂN 19 SCRIPT SANG LOADER (plan v4, chưa làm)
Hành vi mới: chạy trực tiếp `bun scripts/xxx.ts` là **dry-run**; ghi cần `--apply`, production cần `--confirm=<tên DB>`; lệnh `bun run ...` trong `package.json` được sửa để giữ tác dụng ghi cũ.
Tiện ích đã sẵn: `getWriteGuard` (ma trận cờ), `connectPg`/`withPgSession`, `createScriptDataSource`.
- [ ] **B1 (lệnh hằng ngày)**: `backfill-out-invoices`, `backfill-invoice-license-plates` (+ `backfill:*`), `seed-garage-opex`, `update-cases-classification` (+ `gw:*`), `batch-post-historical`.
- [ ] **B2 (rủi ro cao)**: `bulk-upload-invoice-pdfs` (đang ép `erp-api/.env` = production, ghi R2, không dry-run), `realign-old-invoice-journal-entries` (có xóa bút toán trùng; **giữ**, không thay thế được bằng script phân loại mới), `standardize-journal-entry-numbers` (`--execute`).
- [ ] **B3**: `sync-invoice-netoffs-to-case-settlements`, `backfill-personal-invoices`, `run-backfill-xml-relations`, `backfill-related-invoices` (xác nhận phần `fetch`/S3 chỉ đọc).
- [ ] **B4**: `seed-chart-of-accounts-tt99`, `seed-chart-of-accounts-tt200`, `seed-invoice-categories`, `sync-module-config-invoice-categories`, `backfill-kgara-classification`, `import-omoda-cases`, `replicate-opex`.
- Kiểm chứng mỗi script: `bunx tsc --noEmit` + dry-run trên `.env` + `countRows`/`diffCounts` trước/sau (không đổi).
- Đích cuối: `bun .agents/skills/api-service-refactor/scripts/scan-oversized-files.ts --strict` báo script hygiene = 0.

## 3. CẦN QUYẾT ĐỊNH
- [ ] Xoá thêm 4 script nghi trùng/một lần? `replicate-opex.ts`, `import-omoda-cases.ts`, `backfill-kgara-classification.ts` (trùng `update-cases-classification.ts`), `sync-module-config-invoice-categories.ts` (chồng `seed-invoice-categories.ts`).
- [ ] MST chi nhánh VinFast `0108926276-001..-004`: script cũ coi là VinFast, handler (`VINFAST_TAX_CODES`) chưa có. Kiểm tra dữ liệu greenway/klotus (trên `erp_local` không có) rồi quyết có thêm không.
- [ ] Bộ nhớ theo người bán học cả nhãn do AI: soát các người bán hay gặp (vd MST `0302539983` Hải Triều = `GARAGE_SUBCONTRACT`, đúng với dòng hàng "cân mâm", "chỉnh thước lái"). Cân nhắc thêm `--mode=audit-memory` (chỉ đọc) để liệt kê.
- [ ] Nhóm `GARAGE_SUBCONTRACT` đang hạch toán TK `632`, các dịch vụ mua ngoài khác ở `6427` — kế toán xác nhận.

## 4. VIỆC DỌN SAU
- [ ] `erp_journal_entries` không có unique `entry_no`; trên `erp_local` có 14 cặp (số, chi nhánh) trùng do dữ liệu cũ. Greenway-production: 0 trùng theo (số, chi nhánh).
- [ ] 14 công cụ giữ lại vì chưa có tham chiếu (seed/backfill/import/khởi tạo workspace) — xem mục 2 và `.agents/scripts/init-workspace-agents.sh`.
- [ ] Sync downstream (`erp-greenway-*`, `erp-klotus-*`) **chưa làm**: theo `/erp-git-workflow` Kịch bản 4 sau khi `erp-master` ổn định.

## 5. LƯU Ý CÔNG CỤ / QUY ƯỚC
- Trong shell agent, `grep` là hàm bọc tôn trọng `.gitignore` (bỏ sót file bị ignore). Dùng `/usr/bin/grep` khi cần kiểm tra "không còn sót".
- `bun run migration:run` mặc định nạp `.env` (đang trỏ greenway-production). Dùng `.agents/skills/db-migrate/scripts/typeorm-runner.sh run <ENV_FILE>` hoặc DataSource riêng khi chạy tay.
- Đường dẫn trong tài liệu tính từ workspace root (`erp/...`, `klotus/...`); không dùng symlink; không hard-code `/home/dev/repos*`.
- Các file ở workspace root (`/.agents`, `/.claude`, `erp/.agents`, `klotus/.agents`) **không nằm trong git** nên không được push; bản sao lưu trước khi sửa chỉ nằm ở thư mục tạm.
