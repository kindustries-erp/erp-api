# Task: R2 File Storage + Company Profile + SysFile Migration

## Type: REFACTOR / FEATURE

## Goal
Migrate file storage layer from Directus to Cloudflare R2, add Company Profile module,
and extend the SysFile entity to work with Neon DB + R2 storage.

## Scope
- In-scope:
  - `src/company-profile/` — new module: entity, service, controller, DTO
  - `src/files/` — files.service.ts migrated to R2; sys-file entity extended
  - `src/r2/` — R2 module extracted from erp-invoices-core, promoted to top-level
  - `src/migrations/` — 3 new migration files (CompanyProfile table + AutoSync x2)
  - `src/app.module.ts`, `src/db/data-source.ts` — register new entities/modules
  - `src/auth/guards/directus-auth.guard.ts` — minor guard fix alongside storage refactor
  - `src/erp-invoices-core/` — updated to use top-level R2 module
- Out-of-scope:
  - UI layer (no FE changes in this commit — company profile UI may follow separately)

## Related commits
- `e06188e` — `refactor: migrate file storage from directus to r2 and neon db`

## Gate 0 — DB Precheck
- New table: `erp_company_profiles` (via `1782109001550-CompanyProfile.ts`)
- AutoSync migrations: `1782109911729`, `1782109970576` — schema reconcile for new entity
- `SysFile` entity extended with R2-compatible fields
- DB gate result: `DB_READY` — migrations applied, entity registered

## API
- `GET/PATCH /api/v1/company-profile` — new endpoints on `company-profile.controller.ts`
- `POST /api/v1/files/upload` — now uses R2 service, no longer depends on Directus
- R2 module promoted to top-level `src/r2/r2.module.ts` with `R2Service`
- `FilesModule` imports `R2Module`; `CompanyProfileModule` standalone

## UI
- No UI change in this commit (separate Web task may follow for company-profile page).

## QC / Verification
- `bun run check` — PASS (part of commit `52711c9` chain verification)
- `dist/main.js` — exists (verified per lane closure session 20260622)
- Endpoint smoke: company-profile controller registered at `/api/v1/company-profile`
- File upload route uses R2; old Directus file path is no longer default

## Risk
- Low for existing flows: R2 migration is additive; old Directus file references still
  resolvable via previous uploads if not migrated.
- If R2 credentials are missing in `.env` at runtime, file upload will fail. Ops must
  confirm `R2_*` environment variables are set before promoting to staging/prod.

## Rollback
- Revert `e06188e` restores Directus-backed file storage and removes company-profile module.
- Migrations must be reversed manually if DB was already applied.

## Commit/Push Status
- API repo: DONE — `e06188e` committed + pushed to `github-industries erp-master`
- Web repo: N/A (no FE code in this commit; Web company profile UI tracked separately)
- DB: New migrations applied via TypeORM auto-sync on boot
