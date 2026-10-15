# ERP API - Copilot Instructions

## Required read order

1. `AGENTS.md` (router gộp của repo này)
2. `.agents/AGENTS.md`
3. `.agents/skills/liouni-erp-api-current-truth/SKILL.md`
4. Workflow liên quan trong `.agents/workflows/` (ví dụ `plan-and-task.md`)

## Working rules

- Dùng `bun` / `bunx` only, không dùng `npm` hay `yarn`.
- Reuse existing modules, services, DTOs and helpers before creating new ones.
- Follow gate order: DB -> API -> UI -> QC.
- Kiểm tra schema PostgreSQL thật trước khi viết DTO hoặc service.
- Before push: `bun run build` -> `bun run check:ci` -> `bunx jest --forceExit` -> `git push`, chạy trong `erp-api` và push lên `github-industries erp-master`.
