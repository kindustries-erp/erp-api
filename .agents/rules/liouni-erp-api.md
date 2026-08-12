# Liouni ERP API Rule

Apply to all work in this repo.

## Git Workflow Mandates

When asked to **commit code**, you MUST execute the following in order:
1. `bun run build`
2. `bun run check:ci`
3. `bun run test`
4. `git commit`

When asked to **push code**, you MUST execute the following in order:
1. `git pull --rebase` (and resolve conflicts if any)
2. `bun run build`
3. `bun run check:ci`
4. `bun run test`
5. `git commit` (if there are uncommitted changes)
6. `git push`

## Required behavior
- load `@.agents/skills/liouni-erp-api-current-truth/SKILL.md`
- read `@.agents/context/current-truth.md` first
- use repo-local context as default guidance
- MUST use bun/bunx exclusively (do NOT use npm)
- when debugging and testing API locally, always start dev on port 10010
- by default, always work on ERP_MASTER_DATABASE_URL unless ERP_KLTOUS_STAGING_DATABASE_URL or ERP_KLTOUS_MASTER_DATABASE_URL is explicitly indicated
- follow DB -> API -> UI -> QC
- inspect current state before edits
- use evidence-first wording
- before push/commit, `cd` vào root của repo hiện tại (`./erp-api` từ workspace root)
- **Strict Git Workflow**: You MUST follow the `Git Workflow Mandates` defined above for all commits and pushes.
- if backend source changed, also run `bunx jest --forceExit` or a narrower affected test scope and report which scope was used
- push with `github-industries`
- always check branch 1st when push. all commit must be push on erp-master 1st, then I will create PR to another branch
- reuse existing components/modules/services/DTOs/helpers/utils/functions first
- extend/adapt before duplicating
- no code without a task file under `docs/tasks/`
- keep task checklist updated in realtime
- if task status in docs drifts from code reality, verify by code + build/test + git state before correcting the artifact

## Architecture & Development Standards

- **TDD**: Prefer Test-Driven Development for new features and non-trivial fixes. If not practical, add or update the nearest affected automated test before closing the task.
- **Modularity**: Apply a modular mindset to backend code. Split controllers, services, DTOs, mappers, and helper functions by domain responsibility; do not grow "god services".
- **Imports**: Use alias imports. Group 3rd-party imports first, followed by a blank line, then custom code imports.
- **Module boundaries**: New domain work should stay inside `src/<domain>/...`. Cross-domain orchestration is allowed, but hidden coupling and DTO leakage across domains are not.
- **Reuse-first**: Before creating a new helper/service/util, inspect existing code in `src/common/**`, the current domain, and adjacent ERP domains. If creating a new primitive, note the reason in the task.
- **Definition of done**: A backend task is not done until task checklist is updated, validation evidence is recorded, and commit/push status is stated clearly.

## Teamwork guardrails
- Use `must` only for standards already enforced or verified in this repo; use `prefer` for target-direction conventions.
- When introducing a new module, record registration points explicitly: module file, controller path, `src/app.module.ts`, DTO/validation, and affected Web contract.
- If response shape or route path changes, call out required Web follow-up in the task artifact before closing.
- Documentation/process changes must update the canonical file first (`docs/ai/technical-instructions.md`), then keep `.agents` aligned.

## Anti-drift / anti-patterns
- Do not reference non-existent bootstrap files.
- Do not let historical docs override repo-local current truth.
- Do not duplicate business logic in multiple services when a shared domain helper or mapper is enough.
