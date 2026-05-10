# Technical Instructions (Canonical) — Liouni ERP API

Status: Active
Scope: Áp dụng cho mọi AI agent/model làm việc trong repo backend API.

## 1) Source of truth và thứ tự đọc
Khi bắt đầu task:
1. `AGENTS.md`
2. `docs/ai/technical-instructions.md` (file này)
3. `README.md`
4. Task file trong `docs/tasks/`

## 2) Non-negotiable workflow
### 2.1 No code without task
- Không bắt đầu sửa code nếu chưa có task file trong `docs/tasks/`.
- Task phải có checklist sub-task rõ ràng.

### 2.2 Tick done realtime
- Mỗi sub-task xong phải tick ngay `- [ ]` -> `- [x]`.

### 2.3 Lessons learned khi có issue
- Nếu phát sinh lỗi/blocker/sai hướng triển khai, phải ghi lessons learned trước khi đóng task.
- Dùng template `docs/lessons-learned/_template.md`.

## 3) API architecture rules
### 3.1 Module boundaries
- Tổ chức theo Nest module/domain dưới `src/`.
- Không trộn controller/service/dto của domain khác nếu không cần thiết.

### 3.2 Directus integration discipline
- Mọi thay đổi schema/collection naming phải kiểm tra tương thích với Directus staging.
- Khi đổi contract liên quan Directus, phải đồng bộ với ERP Web nếu có ảnh hưởng response DTO.

### 3.3 Validation & DTO
- Input/params/query phải đi qua DTO + validator.
- Không bypass validation cho endpoint public hoặc endpoint nghiệp vụ chính.

### 3.4 Reuse-first
Trước khi tạo mới utility/service/helper, rà soát:
- `src/common/**`
- `src/directus/**`
- module hiện có theo domain

## 4) Data-safety rules (Directus staging aware)
- Không viết migration phá huỷ dữ liệu khi chưa có backup.
- Không đổi schema staging mà không ghi rõ migration note + verification.
- Không in secret từ `.env` ra log/report.

## 5) Validation gates
- `npm run build`
- Nếu có test: chạy test scope liên quan.
- Nếu có đổi contract: kiểm tra endpoint affected bằng smoke request.

## 6) Output contract khi báo hoàn tất
Phải kèm:
1. File đã đổi
2. Checklist đã tick
3. Lessons learned entry (nếu có issue)
4. Kết quả build/test/smoke check

## 7) Templates liên quan
- Task template: `docs/tasks/_template.md`
- Lessons template: `docs/lessons-learned/_template.md`
