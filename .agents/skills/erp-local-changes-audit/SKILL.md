---
name: erp-local-changes-audit
description: Kiểm tra thay đổi local chưa commit của erp-api có tuân thủ erp-api-structure không (ngưỡng kích thước, Clean DI, Facade, route và response v2, spec). Nếu chưa đạt thì lập plan enhance và fix và dừng chờ OK. Không sửa code.
---

# ERP API — Audit thay đổi local theo erp-api-structure

Nạp `erp-api-structure` và `erp-api-truth` trước. Quy trình đầy đủ và bảng rule nằm ở workflow `/erp-local-changes-audit` của cùng repo.

## Nguyên tắc

- Chỉ đọc. Không sửa code, không commit, không chạy build, test hay migration.
- Chỉ kết luận từ mã đã đọc. Chưa kiểm thì ghi "chưa kiểm".
- Nếu có FAIL, lập plan enhance và fix theo `/erp-plan` và **dừng chờ `OK`**.

## Các bước

1. Lấy danh sách file đổi bằng `git status --short` và `git diff --stat` trong `erp/erp-api`.
2. Quét kích thước và Clean DI:
   ```bash
   bun .agents/skills/erp-api-structure/scripts/scan-oversized-files.ts --strict
   ```
3. Với từng file đổi, đối chiếu rule trong `erp-api-structure`: ngưỡng Controller 300, Service 500, Engine 800; constructor không overload và không union; Facade giữ contract; Controller không trả Entity; có spec co-located; route và response v2 đúng chuẩn.
4. Ghi bảng tuân thủ: rule | file#dòng | PASS hoặc FAIL.
5. Nếu có FAIL, đưa plan enhance và fix theo mẫu `/erp-plan`, rồi dừng chờ `OK`.
