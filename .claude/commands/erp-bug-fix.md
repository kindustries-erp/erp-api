---
description: "Quy trình sửa lỗi có kiểm chứng cho erp-api (đánh giá read-only, sửa tối thiểu, test, kết luận verified / partial / failed)"
---

<!-- GENERATED FILE - DO NOT EDIT. Sửa nguồn .agents/workflows/erp-bug-fix.md, rồi chạy /sync-agents. -->

Please read and strictly execute the workflow defined in:
`.agents/workflows/erp-bug-fix.md` (đường dẫn tính từ thư mục chứa `.claude/`)

Follow all principles, delivery sequence (DB -> API -> UI -> QC), task breakdowns, Plan-First gates, and verification rules defined in that document.

## Chỉ Claude Code: review bổ sung bằng `code-review`

Bước này chỉ áp dụng khi chạy trong Claude Code. Agent khác bỏ qua hoàn toàn.

1. Chỉ chạy khi repo đang có thay đổi local (`git diff --stat` không rỗng) trong đúng repo con. Nếu không có diff thì ghi "code-review: không có diff" và bỏ qua.
2. Gọi skill `code-review` trên diff hiện tại, chỉ đọc: không `--fix`, không `--comment`, không `ultra`, không mức `max`. Dùng mức mặc định.
3. Thêm mục "Review bổ sung (code-review)" vào cuối báo cáo, liệt kê finding đã xác minh kèm `file#dòng`. Nếu skill không khả dụng hoặc không chạy được thì ghi "chưa chạy" và lý do.
4. Không tự sửa code theo finding. Finding chỉ là đầu vào cho bước đánh giá của workflow này.
