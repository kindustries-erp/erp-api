# Liouni ERP API Agent Pack

Source of truth for this repo.

## Read order
1. `context/current-truth.md`
2. `context/working-contract.md`
3. `tasks/current-lane.md`
4. `skills/liouni-erp-api-current-truth/SKILL.md`
5. `rules/liouni-erp-api.md`

## Purpose
- keep current truth, contract, lane, skill, and rule together
- avoid deriving implementation guidance from scattered historical docs
- separate bootstrap from implementation docs

## Boundary
- `.agents/` = agent source of truth
- `docs/` = implementation/history/references

## Preferences
- Bun/Bunx first
- stay inside this repo for commit/push
- use `github-industries`
- reuse existing components/modules/services/DTOs/helpers/utils/functions first
- extend/adapt before duplicating

## Historical rule
Treat `docs/` files mentioning Directus, Gitea, old dev domains, or `erp-core` as historical/reference before using them for new work.
