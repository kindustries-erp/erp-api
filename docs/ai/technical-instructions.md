# Technical Instructions (Canonical) — Liouni ERP API

Status: Active
Scope: Áp dụng cho mọi AI agent/model làm việc trong repo backend API.

## 1) Source of truth và thứ tự đọc
Khi bắt đầu task:
1. `AGENTS.md`
2. `docs/ai/technical-instructions.md` (file này)
3. `README.md`
4. Task file trong `docs/tasks/`

## 2) Universal DB-first policy (FEATURE / ENHANCE / FIX)
Áp dụng cho mọi thay đổi API, kể cả enhancement và bugfix.

### Gate 0 — DB Precheck bắt buộc
Trước khi sửa workflow/API, phải ghi rõ DB precheck trong task:
- Collections/fields liên quan
- Data nền cần có
- Constraint/index/default cần có
- Kết quả: `DB_READY` hoặc `DB_GAP_FOUND`

Nếu `DB_GAP_FOUND`: tạo/hoàn tất DB task trước, sau đó mới xử lý API.

### Gate order bắt buộc
1. DB / Directus staging
2. Backend workflow/API
3. UI

## 3) Non-negotiable workflow
### 3.1 No code without task
- Không bắt đầu sửa code nếu chưa có task file trong `docs/tasks/`.
- Task phải có checklist sub-task rõ ràng.

### 3.2 Tick done realtime
- Mỗi sub-task xong phải tick ngay `- [ ]` -> `- [x]`.

### 3.3 Lessons learned khi có issue
- Nếu phát sinh lỗi/blocker/sai hướng triển khai, phải ghi lessons learned trước khi đóng task.
- Dùng template `docs/lessons-learned/_template.md`.

### 3.4 Task closing rule
- Hoàn tất task phải commit + push code web/api liên quan.
- Riêng DB/directus staging không bắt buộc commit/push code DB repo; bắt buộc có evidence apply + verify + documentation.

## 4) API architecture rules
### 4.1 Module boundaries
- Tổ chức theo Nest module/domain dưới `src/`.
- Không trộn controller/service/dto của domain khác nếu không cần thiết.

### 4.2 Directus integration discipline
- Mọi thay đổi schema/collection naming phải kiểm tra tương thích với Directus staging.
- Khi đổi contract liên quan Directus, phải đồng bộ với ERP Web nếu có ảnh hưởng response DTO.

### 4.3 Validation & DTO
- Input/params/query phải đi qua DTO + validator.
- Không bypass validation cho endpoint public hoặc endpoint nghiệp vụ chính.

### 4.4 Reuse-first
Trước khi tạo mới utility/service/helper, rà soát:
- `src/common/**`
- `src/directus/**`
- module hiện có theo domain

## 5) Data-safety rules (Directus staging aware)
- Không viết migration phá huỷ dữ liệu khi chưa có backup.
- Không đổi schema staging mà không ghi rõ migration note + verification.
- Không in secret từ `.env` ra log/report.

## 6) Validation gates
- Bun-first tooling: dùng `bun` / `bunx` mặc định cho install/build/test/lint/format; chỉ fallback `npm`/`npx` nếu đã verify Bun không hỗ trợ và phải ghi rõ trong task evidence.
- `bun run build`
- Nếu có test: chạy test scope liên quan.
- Nếu có đổi contract: kiểm tra endpoint affected bằng smoke request.

## 7) Output contract khi báo hoàn tất
Phải kèm:
1. File đã đổi
2. Checklist đã tick
3. DB precheck result + gate evidence
4. Lessons learned entry (nếu có issue)
5. Kết quả build/test/smoke check
6. Trạng thái commit/push cho web/api

## 8) Templates liên quan
- Task template: `docs/tasks/_template.md`
- Lessons template: `docs/lessons-learned/_template.md`
