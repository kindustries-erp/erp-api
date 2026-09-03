# Task: Fix RustFS upload endpoint resolution

## Scope
Fix ERP API S3-compatible RustFS upload/download clients when `R2_ENDPOINT` points to an internal RustFS service.

## Root cause
AWS SDK virtual-hosted addressing transforms `http://erp-infra-rustfs:9000` into `http://erp-master-demo.erp-infra-rustfs:9000`, which is not a Docker DNS name.

## Acceptance criteria
- Both S3 clients use path-style addressing.
- Existing Cloudflare R2 fallback remains unchanged.
- Regression test covers explicit endpoint compatibility.
- Targeted tests, build, and CI checks pass.
- Runtime upload via `erp-master-demo` is verified with PUT/metadata persistence.

## Constraints
- Do not modify Web source changes.
- Do not log or commit credentials.
- Deploy only after image publication and digest verification.
- Use Komodo for runtime deployment.

## Verification
- `bun test` targeted/full as practical.
- `bun run build`.
- Upload a PDF through `/api/v1/erp-attachments/upload`.
- Verify object and DB metadata.
