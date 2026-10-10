# Liouni ERP API (NestJS)

Claude xưng "em", gọi người dùng là "anh". Trả lời tiếng Việt, ngắn gọn.
Rule chung của ERP nằm ở `../CLAUDE.md` (Claude Code tự nạp).

@.agents/AGENTS.md
@.agents/skills/liouni-erp-api-current-truth/SKILL.md

## Đọc khi đúng việc (không import sẵn)

- Workflows (`.agents/workflows/`): `erp-git-workflow.md` (commit/push/sync), `plan-and-task.md` (lập kế hoạch), `api-service-refactor.md` (refactor service/DTO), `clean-brain.md`.
- Rules (`.agents/rules/`): `create-prd.md`, `generate-tasks.md`.
- Skills (`.agents/skills/`): `db-migrate`, `erp-gate-0-precheck` (kiểm tra schema trước khi viết DTO), `plop-generate`, `scan-module-knowledge`, `komodo-tailscale-deploy`.

## Script & env (backfill, seed, netoff...)

- Env theo nhánh deploy: `erp-<tenant>-<stage>` ↔ file `.env.<tenant>-<stage>` ↔ secret GitHub `<TENANT>_<STAGE>_API_ENV`. DB master = `DATABASE_URL` trong `.env` (`erp_local`).
- Script nạp env bằng `src/common/scripts/load-script-env.ts`: tham số vị trí `.env.xxx` | `--env=` | `--target=<tenant>-<stage>` | `ENV_FILE` | `.env`. Không hard-code file env mặc định; file chỉ định thiếu thì báo lỗi.
- Mặc định dry-run; ghi DB cần `--apply`; DB production cần thêm `--confirm=<tên DB>`. Bare `.env` có thể đang trỏ DB production nên script từ chối nếu không chỉ định env tường minh.
- Script gọi lại service/handler của app, AI qua `NineRouterClient`; không đường dẫn tuyệt đối. Chi tiết: `.agents/workflows/api-service-refactor.md` (mục *Script độc lập*).
- Kiểm tra tuân thủ: `bun .agents/skills/api-service-refactor/scripts/scan-oversized-files.ts --strict`. Lưu ý lệnh `grep` trong shell agent có thể bỏ qua file bị `.gitignore`; dùng `/usr/bin/grep`.
