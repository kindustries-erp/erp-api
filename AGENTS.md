# Liouni ERP API Agent Bootstrap

File này là entrypoint cho mọi AI agent/model làm việc trong repo `liouni-erp-api`.

## Required reading order
1. `docs/ai/technical-instructions.md`
2. `README.md`
3. Task file liên quan trong `docs/tasks/`

## Mandatory execution contract
- No code without task file trong `docs/tasks/`.
- Tick checklist realtime (`[ ]` -> `[x]`) khi hoàn tất từng sub-task.
- Nếu gặp issue/blocker/sai hướng: ghi lessons learned trước khi đóng task.
- Bun-first: mọi install/build/test/lint/format trong repo này phải dùng `bun` / `bunx`, không dùng `npm`, `npx`, `pnpm`, `yarn` trừ khi task chứng minh được Bun không hỗ trợ.

## Canonical references
- Technical instructions: `docs/ai/technical-instructions.md`
- Task template: `docs/tasks/_template.md`
- Lessons learned template: `docs/lessons-learned/_template.md`

## Testing rules (NON-NEGOTIABLE)
- Pre-commit hook runs ALL tests (`bunx jest --forceExit`). If tests fail, commit is blocked.
- **If a test fails, fix the SOURCE CODE — NOT the test.** Tests are the source of truth for expected behavior.
- Unit tests live in `*.spec.ts` files co-located with source.
- Run tests: `bunx jest --forceExit` (all) or `bunx jest --testPathPatterns=<module>` (specific module).
- ESLint relaxed for test files: `unbound-method` and `no-require-imports` are off in `*.spec.ts`.
