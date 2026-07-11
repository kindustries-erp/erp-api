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
- before commit/push, `cd` vào root của repo hiện tại (`./erp-api` từ workspace root)
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

---

## API Specific Agent Rules

### 1. API Auto-TDD (Test Driven)
- After creating or modifying a core function, service, controller, or critical logic, you **MUST** generate a corresponding `.spec.ts` file.
- The unit test must cover the happy path and any obvious edge cases.

### 2. API Contract DB-First
- Before creating or modifying a DTO (Data Transfer Object) or service logic, you **MUST** check the actual database schema (PostgreSQL) to ensure field names and types match.
- Use the `erp-gate-0-precheck` skill or directly query the database to verify the contract. DO NOT guess database fields.

### 3. Strict Pre-push Hook
- Before running `git push`, you **MUST** run `bun run check:ci` and `bun run test` (or the equivalent test script for API).
- Do NOT push if any of these commands fail. Fix the issues first.
