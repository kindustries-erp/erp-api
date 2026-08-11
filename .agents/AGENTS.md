# Liouni ERP API Agent Bootstrap

Source of truth for this repo (`./erp-api`).

## Read order

1. `.agents/context/current-truth.md`
2. `.agents/context/working-contract.md`
3. `.agents/tasks/current-lane.md`
4. `.agents/skills/liouni-erp-api-current-truth/SKILL.md`
5. `.agents/rules/liouni-erp-api.md`
6. `docs/ai/technical-instructions.md`

## API Specific Agent Mandates

### 1. API Auto-TDD (Test Driven)

- After creating or modifying a core function, service, controller, or critical logic, you **MUST** generate a corresponding `.spec.ts` file.
- The unit test must cover the happy path and any obvious edge cases.

### 2. API Contract DB-First

- Before creating or modifying a DTO (Data Transfer Object) or service logic, you **MUST** check the actual database schema (PostgreSQL) to ensure field names and types match.
- Use the `erp-gate-0-precheck` skill or directly query the database to verify the contract. DO NOT guess database fields.

### 3. Strict Pre-push Hook

- Before running `git push`, you **MUST** run `bun run check:ci` and `bun run test` (or the equivalent test script for API).
- Do NOT push if any of these commands fail. Fix the issues first.

### 4. Rebase First Conflict Resolution

- When pushing code and encountering a conflict, your **first priority** is to use `git pull --rebase github-industries erp-master`.
- Only if the rebase presents overly complex conflicts, you may `git rebase --abort` and resolve using a standard merge (`git pull origin erp-master`).
