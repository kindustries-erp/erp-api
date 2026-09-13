# ERP API - Copilot Instructions

## Required read order

1. `.agents/context/current-truth.md`
2. `.agents/context/working-contract.md`
3. `.agents/tasks/current-lane.md`
4. `.agents/AGENTS.md`
5. `AGENTS.md`
6. `.agents/rules/ai-instructions/technical-instructions.md`

## Working rules

- Reuse existing skills, hooks, and patterns before creating new artifacts.
- Follow gate order: DB -> API -> UI -> QC.
- Use Bun/Bunx only.
- No code without a task file in `.agents/tasks/`.
- Respect pre-commit and pre-push hooks.
- Before push, run this sequence explicitly: `bun run check:ci` -> `bun run test` (or scoped Jest) -> `bun run build` -> `git push`.
