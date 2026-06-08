# Task — Create ERP Core admin account

## Request Input
- Type: DATA / ACCESS
- Goal: create local account in ERP Core DB for `admin@liouni.com`

## Gate 0 — DB Precheck
- Tables involved: core user/auth tables in ERP Core Postgres lane
- Fields expected: email, password hash, role/status fields if applicable
- Result: DB_READY (pending live inspect before write)

## Checklist
- [x] Inspect runtime and auth contract
- [x] Verify whether account already exists
- [x] Create account safely
- [x] Verify login works

## Evidence
- Pre-check login before create:
  - `POST /api/v1/auth/login` with `admin@liouni.com` -> `401`
- Create path used:
  - `POST /api/v1/auth/register`
- Post-create verify:
  - `POST /api/v1/auth/login` -> `201/200` with bearer token
  - `GET /api/v1/auth/profile` with bearer token -> `200`
- Scope:
  - Local ERP Core auth lane only (`liouni-erp-core-api` on `:10010`)
