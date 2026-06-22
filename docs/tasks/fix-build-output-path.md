# Fix Build Output Path

## Context
The GitHub Actions CD workflow on `erp-master` failed its health check. The `docker build` succeeds but the `CMD ["node", "dist/main"]` fails at runtime because `test-date.ts` at the root directory of `liouni-erp-api` causes `tsc` to preserve the directory structure. As a result, the built file ends up in `dist/src/main.js` instead of `dist/main.js`. 

## Task
1. Remove `test-date.ts` which is a rogue test file.
2. Commit and push the changes to `erp-master` branch.
