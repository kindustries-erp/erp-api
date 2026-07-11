# Technical Instructions (Canonical) — Liouni ERP API

Status: Active
Scope: Áp dụng cho mọi AI agent/model làm việc trong repo backend API.

## 1) Source of truth và thứ tự đọc
Khi bắt đầu task:
1. `.agents/context/current-truth.md`
2. `.agents/context/working-contract.md`
3. `AGENTS.md`
4. `docs/ai/technical-instructions.md` (file này)
5. `README.md`
6. Task file trong `docs/tasks/`

Nếu có mâu thuẫn, ưu tiên theo thứ tự trên. Không tham chiếu file bootstrap không tồn tại.

## 2) Universal DB-first policy (FEATURE / ENHANCE / FIX)
Áp dụng cho mọi thay đổi API, kể cả enhancement và bugfix.

### Gate 0 — DB Precheck bắt buộc
Trước khi sửa workflow/API, phải ghi rõ DB precheck trong task:
- Tables/fields liên quan (trên Neon Postgres, không còn hệ thống staging)
- Data nền cần có
- Constraint/index/default cần có
- Kết quả: `DB_READY` hoặc `DB_GAP_FOUND`

Nếu `DB_GAP_FOUND`: tạo/hoàn tất TypeORM migration trước, sau đó mới xử lý API.

### Gate order bắt buộc
1. DB / Neon Postgres (TypeORM migration)
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
- Riêng DB/hệ thống staging không bắt buộc commit/push code DB repo; bắt buộc có evidence apply + verify + documentation.
- Nếu task artifact bị stale so với code thật, phải verify bằng code state + build/test + git state trước khi chỉnh status/checklist.

## 4) API architecture rules
### 4.1 Module boundaries
- Tổ chức theo Nest module/domain dưới `src/`.
- Không trộn controller/service/dto của domain khác nếu không cần thiết.

### 4.2 Neon/Postgres integration discipline (lane erp-core)
- Lane `erp-core` **không dùng hệ thống SDK**. DB là Neon Postgres qua TypeORM/DataSource.
- Thay đổi schema phải đi qua TypeORM migration (`src/migrations/`), chạy bằng `bun run migration:run`.
- Khi đổi entity/DTO/response, phải đồng bộ với ERP Web nếu có ảnh hưởng response shape.
- Migration class name phải kết thúc bằng Unix timestamp integer (ví dụ: `AddField1749772800001`), không dùng YYYYMMDDNN alone.

### 4.3 Validation & DTO
- Input/params/query phải đi qua DTO + validator.
- Không bypass validation cho endpoint public hoặc endpoint nghiệp vụ chính.

### 4.4 Reuse-first
Trước khi tạo mới utility/service/helper, rà soát:
- `src/common/**`
- `src/hệ thống/**`
- module hiện có theo domain

### 4.5 Team-scale backend structure
- Controller chỉ nên xử lý route contract, guards, params/query/body parsing, và gọi service/use-case.
- Service không nên phình thành "god service". Khi logic tăng mạnh, tách mapper/helper/use-case nội bộ theo domain.
- DTO là boundary contract; không để entity shape vô tình trở thành public response shape nếu có thể cần đổi độc lập.
- Nếu tạo primitive mới thay vì reuse, ghi lý do ngắn trong task artifact hoặc PR note.

## 5) Data-safety rules (hệ thống staging aware)
- Không viết migration phá huỷ dữ liệu khi chưa có backup.
- Không đổi schema staging mà không ghi rõ migration note + verification.
- Không in secret từ `.env` ra log/report.

## 6) Validation gates
- Bun-first tooling: dùng `bun` / `bunx` mặc định cho install/build/test/lint/format; chỉ fallback `npm`/`npx` nếu đã verify Bun không hỗ trợ và phải ghi rõ trong task evidence.
- `bun run lint:check`
- `bun run build`
- Nếu có test: chạy test scope liên quan.
- Nếu có đổi contract: kiểm tra endpoint affected bằng smoke request.

Definition of done tối thiểu cho backend task:
1. Task file tồn tại và checklist được tick realtime
2. DB precheck đã ghi rõ `DB_READY` hoặc `DB_GAP_FOUND`
3. Validation evidence đã ghi
4. Nếu source đổi: lint/build/test đã chạy
5. Nếu contract đổi: có handoff hoặc smoke evidence cho Web/QC
6. Commit/push status stated rõ theo đúng repo

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
- API module template: `docs/ai/templates/api-module-template.md`
- API contract-change template: `docs/ai/templates/api-contract-change-template.md`
- ADR-lite template: `docs/ai/templates/adr-lite-template.md`
- API naming conventions: `docs/ai/conventions/api-naming-conventions.md`
- DoD matrix: `docs/ai/conventions/definition-of-done-matrix.md`
- Anti-pattern cookbook: `docs/ai/conventions/anti-pattern-cookbook.md`
