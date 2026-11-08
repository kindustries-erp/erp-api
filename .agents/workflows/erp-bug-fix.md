---
description: Quy trình sửa lỗi có kiểm chứng cho erp-api (đánh giá read-only, sửa tối thiểu, test, kết luận verified / partial / failed)
---

# 🐞 ERP Backend Bug Fix Workflow (`/erp-bug-fix`)

Dùng khi user báo lỗi hoặc yêu cầu sửa bug trong `erp-api`. Khác `/erp-review` (chỉ hỏi đáp, không sửa) và `/erp-plan` (tính năng, refactor): workflow này đi từ tái hiện lỗi tới kết luận có bằng chứng. Phần plan, `OK` và theo dõi Plane vẫn theo `/erp-plan`.

---

## 🛡️ Nguyên Tắc

1. **Đánh giá trước, sửa sau**: Bước 1 và 2 là read-only 100%. Không sửa file, không chạy test runner khi chưa có `OK` cho kế hoạch sửa.
2. **Tìm nguyên nhân gốc**: không vá triệu chứng. Nếu chưa xác định được nguyên nhân, báo rõ đã loại trừ gì và cần thêm dữ kiện gì, đừng đoán.
3. **Sửa tối thiểu**: chỉ đổi những gì cần cho lỗi này. Phát hiện lỗi khác thì ghi vào báo cáo, không sửa lan.
4. **Mỗi lỗi một test**: có test tái hiện lỗi (đỏ trước, xanh sau) khi khả thi. Nếu không khả thi, nêu lý do và cách kiểm chứng thay thế.
5. **Kết luận phải có bằng chứng**: chỉ ghi `verified` khi đủ điều kiện ở Bước 4.

---

## 🧭 Quy Trình 4 Bước

### 🔹 BƯỚC 1: Assess (tái hiện và khoanh vùng, READ-ONLY)

1. Ghi lại triệu chứng: hành vi thực tế, hành vi mong đợi, môi trường, bước tái hiện, mức độ ảnh hưởng.
2. Tìm đúng chỗ trong code bằng grep và đọc file; đọc skill module tương ứng ở `.agents/skills/modules/<module>/SKILL.md` và skill truth của repo.
3. Trước khi đổi DTO, filter, persistence hoặc business rule: query trực tiếp DB để xác nhận tên cột, kiểu, constraint (skill `erp-gate-0-precheck`). Đụng endpoint, auth, DTO, upload, xử lý lỗi: đối chiếu `erp-api-truth/references/security-baseline.md`.
4. Nêu giả thuyết nguyên nhân kèm bằng chứng (file:dòng, log, dữ liệu). Phân biệt rõ điều đã xác minh với điều suy đoán.

### 🔹 BƯỚC 2: Plan sửa và duyệt (DỪNG chờ `OK`)

1. Trình bày: nguyên nhân gốc, cách sửa tối thiểu, file sẽ đổi, test sẽ thêm, rủi ro hồi quy.
2. Tiêu chí chấp nhận dạng `AC-n` (ít nhất: lỗi không còn tái hiện, không hỏng hành vi lân cận).
3. **DỪNG**: chờ user trả lời `OK` hoặc `Confirm`. Sau `OK`, hỏi về Plane theo mục "Sau `OK`" của `/erp-plan`. Nếu lỗi nhỏ và user đã yêu cầu sửa thẳng, vẫn phải nêu nguyên nhân và cách sửa trong một đoạn ngắn trước khi sửa.

### 🔹 BƯỚC 3: Fix và Test

1. **Đỏ trước**: viết hoặc cập nhật `.spec.ts` tái hiện đúng lỗi (Auto-TDD), chạy thấy đỏ.
2. Sửa tối thiểu theo kế hoạch đã duyệt. Giữ chuẩn của repo (giới hạn 180 dòng, i18n, token màu, DTO có class).
3. **Xanh sau**: chạy scoped verification: `bunx jest <spec>` hoặc `bunx jest --findRelatedTests <file>`, và `bunx tsc --noEmit`. **Cấm `vitest` trong `erp-api`**. Không chạy full test hay full build ở bước này.
4. Cập nhật `.agents/skills/modules/<module>/SKILL.md` nếu đổi DTO, API, schema hoặc business rule (Knowledge-Sync Guard).

### 🔹 BƯỚC 4: Verdict (kết luận có bằng chứng)

| Kết luận | Điều kiện |
| :--- | :--- |
| `verified` | Đã tái hiện lỗi trước khi sửa; test tái hiện từ đỏ sang xanh (hoặc có cách kiểm chứng thay thế đã nêu); scoped verification pass; không thấy hồi quy ở hành vi lân cận. |
| `partial` | Triệu chứng hết nhưng chưa xác định nguyên nhân gốc, hoặc còn bước kiểm chưa chạy được, hoặc chỉ sửa một phần các tình huống. Nêu rõ phần còn lại. |
| `failed` | Lỗi vẫn tái hiện, hoặc cách sửa gây hồi quy. Không giữ thay đổi sai; nêu những gì đã loại trừ. |

Báo cáo cuối gồm: nguyên nhân gốc, file đã đổi, test đã thêm, lệnh đã chạy và kết quả, kết luận (`verified` / `partial` / `failed`), việc còn lại. Chỉ commit và push khi user yêu cầu, theo `/erp-git-workflow`, trong đúng repo `erp-api`.
