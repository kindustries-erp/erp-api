# ERP API - Copilot Instructions

## Required read order

1. `AGENTS.md` (router gộp của repo này)
2. `.agents/AGENTS.md`
3. `.agents/skills/erp-api-current-truth/SKILL.md`
4. Workflow liên quan trong `.agents/workflows/` (ví dụ `plan-and-task.md`)

## Working rules

- Dùng `bun` / `bunx` only, không dùng `npm` hay `yarn`.
- Reuse existing modules, services, DTOs and helpers before creating new ones.
- Follow gate order: DB -> API -> UI -> QC.
- Kiểm tra schema PostgreSQL thật trước khi viết DTO hoặc service.
- Before push: chạy `bun run verify:final` một lần trên commit cuối, sau đó push theo ERP Git workflow.
