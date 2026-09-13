# Greenway production DB clone and migration dependency fix

- Created: 2026-09-09
- Scope: clone full schema/data from the configured legacy source (`DATABASE_URL_OLD_2` in `.env.greenway-production`) into the new Elite `greenway_production` database, then repair the blocked TypeORM migration dependency and deploy API only after the DB gate passes.
- Environment: source is a legacy Neon database; target is the dedicated Greenway database on Elite.
- Safety: use `.agents/skills/db-migrate/scripts/typeorm-runner.sh` for DB operations; runner creates a target schema backup before destructive sync. No credential values are recorded here.

## Acceptance criteria

1. Full source schema/data clone completes successfully into `greenway_production`.
2. Target identity, table count and selected row counts match the source after clone.
3. TypeORM migration gate completes without missing-relation failure.
4. API deploys through Komodo and `/api/v1/auth/profile` returns `401` or `200` via Elite Tailscale endpoint.

## Risks and rollback

- Full sync intentionally overwrites the target database. The runner creates a schema backup before applying it.
- If clone or migration fails, do not deploy API; retain the runner-generated backup and inspect errors before retrying.
