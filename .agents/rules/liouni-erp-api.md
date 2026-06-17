# Liouni ERP API Rule

Apply this rule for all work in this repository.

## Required behavior
- Load `@.agents/skills/liouni-erp-api-current-truth/SKILL.md`
- Read `@docs/ai/current-truth-context.md` first
- Use only repo-local context as default guidance
- Treat Directus as legacy/reference only unless task explicit says legacy scope
- Treat Gitea as historical only
- Use Bun/Bunx first
- Follow DB -> API -> UI -> QC
- Inspect current state before edits
- Use evidence-first wording

## Historical warning
If a file mentions Directus-first flows, Gitea deploys, old dev domains, or branch `erp-core`, classify it before using it.
Only repo-local current-truth docs should drive new implementation by default.
