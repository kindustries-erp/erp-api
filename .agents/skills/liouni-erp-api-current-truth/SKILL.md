---
name: liouni-erp-api-current-truth
description: API-specific local-only skill for Liouni ERP. Use when working in this repo to load the repo-local current-truth context, index, and implementation rules without relying on external docs.
---

# Liouni ERP API Current-Truth

Use this skill only inside this repository.

## Local read order
1. `@docs/ai/current-truth-context.md`
2. `@AGENTS.md`
3. `@docs/api-current-truth-index.md`
4. `@docs/ai/technical-instructions.md`
5. `@README.md`
6. Relevant file in `@docs/tasks/`

## Current truth
- Main ERP lane = GitHub + branch `erp-master`
- Directus = legacy/reference only unless task explicit says legacy scope
- Gitea = historical only
- Old dev domains are not default smoke endpoints
- Removed `liouni-erp-core-*` stacks must not be assumed to exist

## API responsibilities
- backend contract
- auth
- DTOs
- persistence
- business rules
- build / test / smoke evidence

## Working rules
- Follow DB -> API -> UI -> QC
- Inspect current state before edits
- Use Bun/Bunx first
- Be evidence-first
- Do not let historical Directus/Gitea-era docs drive new implementation by default
