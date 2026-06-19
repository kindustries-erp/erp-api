# Liouni ERP API Agent Bootstrap

Entry point for `liouni-erp-api`.

## Read order
1. `.agents/README.md`
2. `.agents/context/current-truth.md`
3. `.agents/context/working-contract.md`
4. `.agents/tasks/current-lane.md`
5. `docs/ai/technical-instructions.md`
6. `README.md`
7. Relevant `docs/tasks/*`

## Execution contract
- no code without a task file
- update checklists in real time
- record lessons learned for blockers/wrong turns
- use `bun` / `bunx` unless Bun incompatibility is proven
- before commit/push, `cd /opt/repos/liouni-erp-core/liouni-erp-api`
- push with `github-industries`
- reuse existing components/modules/services/DTOs/helpers/utils/functions first
- extend/adapt before duplicating

## References
- `docs/ai/technical-instructions.md`
- `docs/tasks/_template.md`
- `docs/lessons-learned/_template.md`

## Tests
- pre-commit runs `bunx jest --forceExit`
- fix source, not tests
- tests live in `*.spec.ts`
- run all: `bunx jest --forceExit`
- run one area: `bunx jest --testPathPatterns=<module>`
