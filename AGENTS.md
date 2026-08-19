# Liouni ERP API Agent Entry

This file is the root entry point for AI agents in `erp-api`.

## Mandatory Implementation Authority

The canonical source of truth and full rules for this repository are defined in:
👉 [`.agents/AGENTS.md`](./.agents/AGENTS.md)

## Core Guardrails Summary

1. **Delivery Sequence**: Always follow `DB -> API -> UI -> QC`.
2. **Tooling**: Use `bun` / `bunx` exclusively (do NOT use `npm` or `yarn`).
3. **Task & Planning**: Use Antigravity Brain (`implementation_plan.md` & `walkthrough.md`) for all feature & bugfix planning across DB -> API -> UI -> QC.
4. **Git Operations**: All git commands MUST be run inside `./erp-api`. Remote is `github-industries`, branch is `erp-master`.
5. **Strict Pre-push Mandate**: Before commit/push, you MUST run `bun run build`, `bun run check:ci`, and `bun run test`.
