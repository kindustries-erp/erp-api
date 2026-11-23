---
description: Quy trình kiểm tra, review code, phân tích kiến trúc Backend API và hỏi đáp kỹ thuật trong erp-api (Read-Only 100%, không tự ý lập plan hay sửa code)
---

# 🔍 ERP API Review & Technical Q&A Workflow (`/erp-review`) - Backend

Workflow khi người dùng muốn kiểm tra, review mã nguồn, phân tích lỗi hoặc hỏi đáp kỹ thuật liên quan đến **`erp-api`** (NestJS, PostgreSQL, TypeORM) mà **CHƯA MUỐN LÊN PLAN & CHƯA SỬA CODE**.

Nạp trước: `erp-api-truth`, `erp-api-structure`, và `.agents/skills/modules/<module>/SKILL.md` của module đang hỏi (nếu có). Rule đối chiếu lấy từ `/erp-local-changes-audit` (bảng rule api), không chép lại ở đây.

---

## 🎯 Khi Nào Kích Hoạt

1. Hỏi về logic nghiệp vụ, tính toán, khấu hao, tồn kho hoặc luồng xử lý trong backend.
2. Review một DTO, Service, Controller, Entity hoặc Migration.
3. Tìm nguyên nhân lỗi (API trả 500, dữ liệu trùng, lỗi TypeORM query).
4. Thảo luận thiết kế API v2 hoặc refactor Service trước khi làm.

Phân biệt với workflow khác: `/erp-local-changes-audit` kiểm diff local và lập plan nếu FAIL; `/erp-bug-fix` sửa lỗi có kiểm chứng; `/erp-plan` lập kế hoạch tính năng.

---

## 🛡️ 4 Nguyên Tắc Cốt Lõi

1. **Read-Only 100%**: chỉ đọc mã. Không sửa file, không chạy test ghi dữ liệu, không chạy `migration:run`, không commit/push. Không chạy `vitest` trong `erp-api` (repo dùng jest).
2. **Zero Premature Plan**: không tạo plan, task `X.Y.Z` hay tài liệu triển khai. Chỉ chuyển sang plan khi user yêu cầu rõ (ví dụ "OK, lên plan đi" hoặc gõ `/erp-plan`).
3. **Evidence-First**: mọi nhận định trích `file#dòng`. Khi cần làm rõ quan hệ bảng hoặc cột, kiểm tra schema thật qua `erp-gate-0-precheck` (xác nhận `SELECT current_database();` trước). Không đoán tên field.
4. **Chuẩn cấu trúc**: đối chiếu theo bảng rule của audit api, không tự đặt tiêu chí mới.

---

## 📋 Checklist Đánh Giá

Với file hoặc module được hỏi, áp dụng đầy đủ bảng rule của `/erp-local-changes-audit` api. Mỗi rule ghi PASS, FAIL hoặc "chưa kiểm", kèm `file#dòng`. Điểm chính:

- **Kích thước**: Controller 300 (cảnh báo), Service 500, Helper/engine 800. Có thể chạy `bun .agents/skills/erp-api-structure/scripts/scan-oversized-files.ts` (chỉ đọc) và lọc theo file được hỏi.
- **Cấu trúc**: Controller chỉ parse/validate và gọi Service; Controller không trả Entity (chỉ DTO đã map); Clean DI không overload và không union type; Facade giữ nguyên contract (`erp-api-structure`).
- **Route và response v2**: `@Controller('api/v2/<module>')`, không alias v1; list trả `{ items, pagination, summaries?, extraData? }`.
- **Validation DTO**: đủ `class-validator`; không nhận param lỏng.
- **Concurrency**: tiền, tồn kho, công nợ bọc trong QueryRunner với `setLock("pessimistic_write")`.
- **RBAC và bảo mật**: `@RequirePermissions(...)` với hằng số chuẩn; kiểm tra cách ly tenant và đối tác. Endpoint, auth, DTO, upload, SQL: đối chiếu `erp-api-truth/references/security-baseline.md`.
- **Field link FK sửa cục bộ**: field FK nội bộ cần sửa giá trị hiển thị không đè nguồn phải dùng `link-override-core` (port + engine), không tự viết `source_snapshot`/`overrides`; chỉ ĐỌC bảng nguồn, không ghi ngược; FK không tồn tại trả 404; chỉ cho Nhóm A (không áp cho khóa cha-con, FK hệ thống).
- **Xóa**: soft delete với `isDeleted`; chỉ ngoại lệ đã ghi trong `erp-api-structure` mục "Chính sách xóa".
- **Lỗi**: dùng exception chuẩn NestJS, không nuốt lỗi.
- **Spec**: logic mới có `.spec.ts` cạnh file (integration spec cho luồng nhiều bước).

---

## 💬 Định Dạng Phản Hồi

```markdown
### 1. Phân tích hiện trạng / Trả lời
[Nhận định hoặc giải đáp ngắn gọn, đi thẳng vào câu hỏi]

### 2. Dẫn chứng mã nguồn (Evidence)
- File `[erp/erp-api/src/...#L...]`: [đoạn logic thực tế]
- Rule audit (nếu có review): PASS/FAIL/chưa kiểm, kèm `file#dòng`
- Rủi ro (nếu có): [race condition, thiếu index, thiếu validation, lệch contract...]

### 3. Đề xuất phương án
- **Phương án 1 (Khuyến nghị)**: [mô tả + ưu điểm]
- **Phương án 2 (Thay thế)**: [mô tả + hạn chế]

---
*(Chờ phản hồi từ User trước khi chuyển sang lập Plan triển khai)*
```
