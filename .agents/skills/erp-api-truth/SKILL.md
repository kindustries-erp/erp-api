---
name: erp-api-truth
description: Ngữ cảnh hiện hành của erp-api (backend NestJS của ERP) - lane giao hàng, hợp đồng DB/API, tooling, quy trình git/CI, bản đồ module và checklist bảo mật (references/security-baseline.md). Load đầu tiên trước mọi task trong erp-api. Với việc tổ chức lại code hoặc refactor, dùng skill erp-api-structure.
---

# ERP API — Current Truth

Chỉ dùng trong repo `erp/erp-api`. Skill này chỉ giữ ngữ cảnh ngắn và các rule đã kiểm chứng. Chi tiết nằm ở file được trỏ tới, không sao chép lại.

## 1. Đọc theo thứ tự

1. `.agents/AGENTS.md` — router và mandates của API (Auto-TDD, DB-first, pre-push).
2. `README.md`.
3. Plan và task hiện hành: Plane, project KINDU (skill `plane-work-items`). Antigravity Brain (`implementation_plan.md`, `walkthrough.md`) chỉ là bản phụ.

## 2. Lane và trạng thái

- Lane giao hàng chính: branch `erp-master`. Repo `erp/erp-api` đang ở `erp-master`.
- Thứ tự giao hàng, quy tắc git và xác minh trạng thái: xem `.agents/AGENTS.md` (Working Contract, Git Workflow Mandates).
- Không suy đoán từ note cũ hay mock data.

## 3. Hợp đồng DB và runtime

- Nguồn sự thật về schema là Postgres runtime, truy cập qua `DATABASE_URL`. Mẫu cấu hình nằm trong `.env.example`. Không ghi credential thật vào repo.
- Endpoint PostgreSQL chuẩn (cập nhật 2026-11-24): các môi trường **staging** (`erp-greenway-staging`, `erp-klotus-staging`) và **demo** (môi trường do CI/CD của `erp-master` deploy, stack `erp-master-elite-*`, env `.env.demo`) chạy trọn bộ trên **Elite**: DB, S3 (RustFS), API và Web; `DATABASE_URL` của file `.env.*-staging` trỏ host Elite. Đã kiểm container demo 2026-11-24: DB `db-elite.liouni.com:5432` (database `erp_demo`), S3/RustFS `s3-elite.liouni.com` (bucket `demo`). Lưu ý `.env.demo` ở máy dev có thể khác giá trị container; luôn xác nhận DB thực tế trước khi ghi. DB master (`.env`) và production (`.env.*-production`) vẫn trên `db-dev.liouni.com:5433`. Các DB khác nhau bằng tên database trong `DATABASE_URL` của từng file env. `db.liouni.com` là cơ chế cũ, không dùng. Xác nhận DB thực tế trước khi ghi theo `.agents/AGENTS.md`; không suy ra từ tên file hay host.
- Đổi DTO, filter, persistence hoặc business rule phải đối chiếu schema thật (mandate DB-First). Skill hỗ trợ: `erp-gate-0-precheck`.

## 4. Tooling

- Stack: NestJS, TypeORM, Jest.
- Script trong `package.json`:
  - `type:check` = `tsc --noEmit`
  - `check:ci` = tsc + eslint `--max-warnings=0` + `prettier --check`
  - `build` = `nest build && tsc-alias`
  - `test` = `jest`
- Jest: `rootDir: src`, `testRegex: .*\.spec\.ts$`.
- `tsconfig.build.json` loại trừ `test`, `dist`, `**/*spec.ts`, `scripts`, `*.ts` ở root. Thêm file `.ts` nằm ngoài `src/` thì phải thêm thư mục đó vào `exclude`, nếu không `dist/main.js` sẽ lệch đường dẫn.

## 5. Git, hook và CI (đã đối chiếu với `.husky/` và `.github/workflows/`)

- **pre-commit**: `bunx lint-staged` (eslint, prettier, `jest --findRelatedTests` trên file đã stage).
- **pre-push**: `bun run type:check`. Chỉ bypass bằng `SKIP_TESTS=1` hoặc `HUSKY_SKIP_TESTS=1` khi đã verify thủ công. Không dùng để bỏ qua lỗi thật.
- **CI `pipeline-erp-master.yml`** (trigger push và PR vào `erp-master`):
  - Type, Lint & Format: `bun run check:ci`
  - Unit tests: `bunx jest --forceExit`
  - Build: `bun run build`
  - Build & push image
  - Deploy qua Komodo
- Chi tiết luồng commit, pull, push: skill `erp-git-workflow`.
- Chỉ commit/push khi user yêu cầu.

## 6. Trách nhiệm của tầng API

Backend contract, auth, DTO, persistence, business rule, bằng chứng build/test/smoke.

## 7. Quy tắc làm việc

- Plan theo `/erp-plan` (cơ chế plan của agent).
- Module NestJS mới phải được import trong `src/app.module.ts`, nếu không endpoint sẽ 404.
- Phân tầng: controller → DTO/validation → service/use-case → persistence/helper.
- Endpoint mới hoặc sửa auth, upload, DTO, xử lý lỗi, truy vấn SQL: đối chiếu `references/security-baseline.md` (guard, DTO class thay vì `any`, giới hạn upload, secret không có giá trị mặc định, không lộ lỗi nội bộ) và ghi mục đã kiểm khi báo xong.

## 8. Cấu trúc code và refactor

Playbook tách Controller/Service, scanner kích thước file và generator module v2 nằm trong skill `erp-api-structure`. Không tự refactor khi chưa có yêu cầu hoặc task đã được duyệt.

## 9. Bản đồ module

Trước khi sửa hoặc thêm module, đọc `references/module-map.md` (cùng thư mục skill này) để tìm module và đọc tiếp `../modules/<module>/SKILL.md` của module đó. Bản đồ liệt kê đủ module theo nhóm nghiệp vụ. Khi cần quét mới hoặc cập nhật tài liệu module: skill `scan-module-knowledge`.

## 10. Bằng chứng cần có

- Số liệu build/test/smoke phải lấy từ lần chạy hiện tại, không lấy từ note cũ.
- Báo cáo scope test đã chạy. Nếu không chạy được, nói rõ là chưa chạy và lý do.
