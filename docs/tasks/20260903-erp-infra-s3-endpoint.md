# Task: ERP Infra S3-compatible endpoint

## Scope

Support a configurable S3-compatible endpoint for the future `erp-infra` RustFS service while preserving the current Cloudflare R2 default behavior.

## DB/API/UI/QC

- DB: no schema change; `DB_READY` / not applicable.
- API: update S3 client endpoint resolution in `R2Service` and `FilesService`.
- UI: no code change; existing file API contract stays unchanged.
- QC: unit tests for endpoint selection plus build/check/test.

## Contract

- New optional env: `R2_ENDPOINT`.
- If `R2_ENDPOINT` is set, use it exactly as the S3 endpoint.
- If absent, preserve `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`.
- Do not change credential variable names or bucket behavior.
- Do not commit secrets.

## Acceptance

- Test proves explicit endpoint is selected.
- Test proves legacy R2 fallback is selected when endpoint is absent.
- `bun run build` passes and `dist/main.js` exists.
- `bun run check:ci` passes.
- `bun run test` passes.
- Git status/diff reviewed; no unrelated files included.

## Rollback

Revert only the endpoint code/test/task artifact changes. Runtime is not deployed in this task.

## Verification evidence

- RED: `bunx jest src/r2/r2.service.spec.ts --runInBand` initially failed because `resolveS3Endpoint` did not exist.
- GREEN: targeted suite passed: 2 tests.
- `bun run build`: passed; verified `dist/main.js` exists.
- `bun run check:ci`: passed.
- `bun run test -- --runInBand`: passed — 55 suites, 337 tests; 10 skipped.
- Independent review: PASS. No blocking bug/security/regression found; default Cloudflare R2 fallback and explicit endpoint behavior both verified. Reviewer noted non-blocking follow-up: verify `forcePathStyle` behavior with a real RustFS smoke test after deployment.

## Status

DONE — uncommitted, awaiting explicit commit/push instruction.
