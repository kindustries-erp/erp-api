# Klotus production Elite — Komodo lane

## 1. Phạm vi
Tạo lane production Klotus song song Greenway trên Elite, CI GitHub Actions -> GHCR immutable image -> Komodo Core trên ops-01 -> ELITE.

## 2. Contract
- Source delivery: `erp-master` commit/push, sau đó merge vào `erp-klotus-master`.
- Existing Klotus raw-Docker workflow remains unchanged.
- New stacks: `erp-klotus-production-elite-api`, `erp-klotus-production-elite-web`, `erp-klotus-production-elite-migrate`.
- Ports: API `10016:3000`, Web `8016:80`.
- Database: `klotus_production_elite`, provisioned directly on Elite, not Komodo.
- Runtime secrets remain host-only, mode `0600`.

## 3. DB migration evidence
- Source env: repo-local ignored file `.env.klotus-production`; only `DATABASE_URL` was used, value not printed or committed.
- Source PostgreSQL: `18.6`.
- Target PostgreSQL: shared Elite `postgres:16.10`.
- Initial target state: `0` public tables.
- Destination backup: `/opt/backups/klotus_production_elite/<timestamp>/target-before.sql` on Elite, mode `0600`.
- PostgreSQL 18 dump contained `SET transaction_timeout`, unsupported by PostgreSQL 16. The restore was stopped before schema creation; target remained empty. A sanitized dump removed only that incompatible session setting.
- Restore used `psql -v ON_ERROR_STOP=1`.
- Final source public tables: `105`.
- Final target public tables: `105`.
- Final source migrations: `116`.
- Final target migrations: `116`.
- Final target identity verified as database `klotus_production_elite`, role `klotus_production_elite_admin`.

## 4. Acceptance status
- DB_READY: PASS.
- Data clone: PASS.
- Workflow YAML and CI/CD validation remain separate gates.
- No production workflow was committed or merged in this DB-only step.

## 5. Security
No password, token, connection URL, or raw credential was written to this task record, Git, chat, or wiki.

## 6. Rollback
Before any future destructive restore, preserve the destination backup under `/opt/backups/klotus_production_elite/`; restore that dump with `psql -v ON_ERROR_STOP=1` after verifying the target connection identity.

## 7. Known compatibility note
When cloning from PostgreSQL 18.x into the current Elite PostgreSQL 16.x instance, inspect dump session settings. `transaction_timeout` must be removed or the target PostgreSQL major version must be upgraded before restore.
