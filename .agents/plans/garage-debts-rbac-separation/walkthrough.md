# Walkthrough: Tách RBAC `garage-debts`

## Kết quả

- Thêm resource `GARAGE_DEBTS = garage_debts` ở API/Web và permission group Garage.
- Migration `20261013100000-SeparateGarageDebtsPermissions` đã chạy trên database `erp_local`.
- Xác nhận sau migration: `core_permissions` có `1` row cho resource `garage_debts`.
- API debts analytics/customer/supplier dùng `GARAGE_DEBTS:READ`.
- API financial dùng chung hỗ trợ OR giữa `GARAGE` và `GARAGE_DEBTS`; mutation cấu hình case vẫn giữ `GARAGE`.
- Web page debts có Forbidden gate độc lập; menu Garage hiển thị cases/debts/opex theo permission riêng.

## Verification Evidence

### API

- `bunx tsc --noEmit`: PASS.
- `bunx jest src/kgara-api-core/controllers/garage-debts-analytics.controller.spec.ts --runInBand`: PASS, 3 tests.
- `bunx jest src/kgara-api-core/controllers/kgara-case-financial.controller.spec.ts --runInBand`: PASS, 4 tests.
- `bun run build`: PASS; `dist/main.js` tồn tại.
- `bun run check:ci`: PASS.
- `bunx jest --forceExit`: PASS, 136 suites, 936 passed, 10 skipped.
- Refactor audit `scan-oversized-files.ts --strict`: không có vi phạm Clean DI; các file lớn là baseline hiện hữu.

### Web

- `bunx tsc --noEmit`: PASS.
- `bunx vitest run` scoped Garage page/sidebar tests: PASS, 12 tests.
- `bun run build`: PASS; chỉ còn cảnh báo chunk size hiện hữu.
- `bun run check:ci`: PASS.
- `bun run type:check`: PASS.
- `bun run test` (Vitest): PASS, 417 files, 1806 passed, 12 skipped.
- `bun test` không dùng làm evidence vì Bun native runner bỏ qua Vitest config của repo.

## Manual Acceptance

1. Role chỉ có `GARAGE:READ`: thấy cases/opex, không được gọi debt API mới.
2. Role chỉ có `GARAGE_DEBTS:READ`: thấy menu và trang debts, không thấy cases.
3. Role có cả hai: thấy đầy đủ cases và debts; cashflow vẫn phụ thuộc `GARAGE_CASHFLOW`.

## Notes

- `.env` trỏ `erp_greenway_production`; migration không dùng file này.
- Migration được chạy trên database cục bộ `erp_local`, sau khi xác nhận `SELECT current_database()`.
- Không commit file untracked `.claude/commands/clean-brain.md` có sẵn từ trước.
