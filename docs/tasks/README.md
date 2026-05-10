# Task Index — ERP API

## Quy tắc bắt buộc cho mọi task mới

### 1) No code without task
- Không bắt đầu sửa code khi chưa có task file trong `docs/tasks/`.
- Task mới khởi tạo từ template: `docs/tasks/_template.md`.

### 2) Universal DB-first (FEATURE/ENHANCE/FIX)
- Mọi task đều phải làm Gate 0 DB precheck trước.
- Nếu `DB_GAP_FOUND` thì bổ sung từ DB/directus staging trước, rồi mới tới API/UI.
- Thứ tự bắt buộc: DB -> API workflow -> UI.

### 3) Tick done realtime
- Mỗi sub-task xong phải đổi ngay `- [ ]` -> `- [x]`.

### 4) Lessons learned khi có issue
- Nếu gặp issue/blocker/sai hướng triển khai: bắt buộc ghi lessons learned trước khi đóng task.
- Dùng template: `docs/lessons-learned/_template.md`.

### 5) Task closing rule
- Sau khi hoàn tất task: commit + push code (web/api).
- Riêng DB/directus staging: không bắt buộc commit/push code DB repo, nhưng phải có evidence apply+verify+document.

### 6) Directus staging coordination
- Task có ảnh hưởng schema/contract phải ghi rõ phạm vi ảnh hưởng tới:
  - `liouni-erp-api`
  - `liouni-erp-web`
  - `directus-staging`
- Không thực hiện thay đổi phá vỡ contract mà không có plan phối hợp.

## Quick start
1. Copy từ `docs/tasks/_template.md`
2. Điền request input + Gate 0 DB precheck
3. Làm task và tick realtime
4. Ghi lessons learned nếu có issue
5. Close bằng commit+push code web/api
