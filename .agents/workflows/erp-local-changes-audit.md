---
description: Kiểm tra thay đổi local của erp-api có tuân thủ erp-api-structure không. Nếu chưa đạt thì lập plan enhance và fix theo /erp-plan và dừng chờ OK.
---

# 🛡️ `/erp-local-changes-audit` — erp-api

Workflow này đối chiếu thay đổi local (chưa commit) của `erp/erp-api` với chuẩn cấu trúc trong `erp-api-structure`. Nếu chưa đạt thì **lập plan** enhance và fix, trình trong hội thoại, rồi **dừng chờ `OK`**. Không tự sửa code.

Kỹ năng chi tiết nằm ở skill `erp-local-changes-audit`. Nạp `erp-api-structure` và `erp-api-truth` trước.

## Quy trình

1. **Thu thập thay đổi** (chỉ đọc, trong `erp/erp-api`): `git status --short`, `git diff --stat`, rồi đọc từng file đổi.
2. **Quét kích thước và Clean DI**:
   ```bash
   bun .agents/skills/erp-api-structure/scripts/scan-oversized-files.ts --strict
   ```
   Chỉ lấy kết quả liên quan đến file đổi. Danh sách tồn đọng cả repo chỉ để tham khảo.
3. **Đối chiếu từng rule** trong bảng dưới. Mỗi dòng ghi PASS hoặc FAIL kèm `file#dòng`.
4. **Xuất báo cáo** theo bố cục tuân thủ: `1. Tổng quan`, `2. Bảng tuân thủ`, `3. Kết luận`.
5. **Nếu có FAIL**: lập plan enhance và fix theo mẫu `/erp-plan` (Task 3 cấp, DoD, Verification), trình trong hội thoại, đặt `RequestFeedback: true`, rồi **DỪNG** chờ `OK`.

## Bảng rule kiểm

| Rule | Ngưỡng hoặc tiêu chí | Nguồn |
| :--- | :--- | :--- |
| Controller không vượt ngưỡng | > 300 dòng là cảnh báo, >= 1000 là nghiêm trọng | `erp-api-structure` mục 1 |
| Service không vượt ngưỡng | > 500 dòng là cảnh báo | `erp-api-structure` mục 1 |
| Helper, engine không vượt ngưỡng | > 800 dòng là cảnh báo | `erp-api-structure` mục 1 |
| Clean DI, không overload và không union type trong constructor | Bắt buộc | `erp-api-structure` mục "Clean Constructor" |
| Facade giữ nguyên contract | Không đổi route, query, status, DTO response | `erp-api-structure` mục 2 |
| Controller không trả Entity | Chỉ trả DTO đã map | `erp-api-structure` mục 4 |
| Spec co-located | Logic mới có `.spec.ts` cạnh file | `erp-api-structure` mục 4 |
| Route v2 | `api/v2/<module>`, không alias v1 | `erp-api-structure` Phần B |
| Response list v2 | `{ items, pagination, summaries?, extraData? }` | `erp-api-structure` Phần B |
| Script độc lập | Không đường dẫn tuyệt đối, dry-run mặc định | `erp-api-structure` mục "Script độc lập" |

## Quy tắc

- Không chạy `bun run build`, test runner hay `migration:run` trong audit.
- Nếu cần đọc DB để xác nhận schema, chạy `SELECT current_database();` trước và báo tên DB.
- Không in giá trị từ `.env`.
- Chỉ kết luận từ mã đã đọc. Nếu chưa kiểm, ghi "chưa kiểm".
