---
name: erp-continue
description: "Quy trình tiếp tục task erp-api đang dở - đọc Session Checkpoint, đối chiếu git và trạng thái Plane, báo cáo vị trí dừng, rồi chờ User xác nhận trước khi thực thi (Read-Only cho đến khi có xác nhận)"
---

<!-- GENERATED FILE - DO NOT EDIT. Nguồn canonical (repo workflow erp/erp-api): .agents/workflows/erp-continue.md -->

# erp-continue — Repo Local Execution (erp/erp-api)

Quy trình thực thi cục bộ cho repo `erp/erp-api`.

1. **Ngữ cảnh repo**:
   - Đọc `.agents/AGENTS.md` của repo này và nạp skill current-truth (`erp-api-truth` hoặc `erp-web-truth`) trước khi thực hiện.
   - Giữ nguyên ranh giới repo: Không sửa file sang repo khác ngoài phạm vi task.
2. **Quy trình thực thi**:
   - Đọc toàn bộ workflow canonical tại `.agents/workflows/erp-continue.md`.
   - Tuân thủ toàn bộ checklist, cổng duyệt (Approval Gate), và tiêu chuẩn kỹ thuật đặc thù của repo.
Không sửa stub generated này; sửa nguồn canonical trong .agents/ rồi chạy /sync-agents.
