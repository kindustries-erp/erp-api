# Liouni ERP API Rule

Apply to all work in this repo.

## Required behavior
- load `@.agents/skills/liouni-erp-api-current-truth/SKILL.md`
- read `@docs/ai/current-truth-context.md` first
- use repo-local context as default guidance
- treat Directus as legacy/reference unless the task explicitly says legacy scope
- treat Gitea as historical only
- use Bun/Bunx first
- follow DB -> API -> UI -> QC
- inspect current state before edits
- use evidence-first wording
- before push/commit, `cd /opt/repos/liouni-erp-core/liouni-erp-api`
- push with `github-industries`
- reuse existing components/modules/services/DTOs/helpers/utils/functions first
- extend/adapt before duplicating

## Historical warning
If a file mentions Directus-first flows, Gitea deploys, old dev domains, or `erp-core`, classify it first.
Only repo-local current-truth docs should drive new implementation by default.
