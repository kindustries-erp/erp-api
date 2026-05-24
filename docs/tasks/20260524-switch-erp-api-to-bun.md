     1|# Task — Chuẩn hóa ERP API sang Bun
     2|
     3|## Request Input (bạn chỉ cần điền phần này)
     4|- Type: ENHANCE
     5|- Mục tiêu: Thay hoàn toàn npm/pnpm bằng Bun cho repo ERP API.
     6|- Bối cảnh/ngữ cảnh: Đã chuẩn hóa ERP Web sang Bun; cần làm tương tự cho API, giữ nguyên workflow Gitea nếu không gọi package manager trực tiếp.
     7|
     8|## Goal
     9|Chuẩn hóa tooling/build/package manager của `liouni-erp-api` sang Bun, giữ deploy staging ổn định, verify build/test/docker/runtime health theo flow ERP.
    10|
    11|## Scope
    12|- In-scope:
    13|  - lockfile/package manager cleanup
    14|  - `package.json` scripts liên quan npm/npx
    15|  - `.husky/pre-commit`
    16|  - `Dockerfile`
    17|  - `README.md`
    18|  - QC build/test/docker/runtime
    19|- Out-of-scope:
    20|  - DB schema/data
    21|  - business logic API
    22|  - ERP Web UI
    23|  - đổi tên workflow Gitea
    24|
    25|## Relevant Files
    26|- `package.json` - scripts và package manager flow
    27|- `.husky/pre-commit` - commit hook runtime
    28|- `Dockerfile` - build/runtime image
    29|- `README.md` - docs run/build/deploy
    30|- `.gitea/workflows/deploy-staging.yml` - verify có cần đổi runtime hay không
    31|- `docs/tasks/20260524-switch-erp-api-to-bun.md` - task evidence
    32|
    33|## Gate 0 — DB Precheck (bắt buộc)
    34|- Collections/fields liên quan: N/A (tooling-only migration)
    35|- Data nền cần có: N/A
    36|- Constraint/index/default cần có: N/A
    37|- Kết quả: `DB_READY`
    38|- Nếu `DB_GAP_FOUND`: link DB task (directus-staging): N/A
    39|
    40|## Coordination Impact
    41|- [ ] Directus staging schema affected
    42|- [ ] ERP Web contract affected
    43|- [x] No cross-system impact
    44|
    45|## Checklist (cập nhật realtime)
    46|- [x] 1.0 Gate 0 DB Precheck done
    47|- [x] 2.0 Backend workflow/API gate done
    48|- [x] 3.0 UI handoff gate done — N/A (API tooling-only)
    49|- [x] 4.0 Validate
    50|  - [x] 4.1 `bun run build`
    51|  - [x] 4.2 `bunx jest --forceExit`
    52|  - [x] 4.3 Docker build PASS
    53|  - [x] 4.4 Staging health protected route trả `401`
    54|- [ ] 5.0 Close
    55|  - [ ] 5.1 Lessons learned entry (if issue)
    56|  - [ ] 5.2 Commit + push code (api)
    57|  - [ ] 5.3 Summary with evidence
    58|
    59|## Validation Evidence
    60|- DB precheck result: `DB_READY` vì task chỉ đổi tooling/package manager.
    61|- Build: `bun run build` PASS; `bun run lint:check` PASS; `bunx jest --forceExit` PASS (5 suites / 60 tests).
    62|- Smoke: `docker compose build --no-cache` PASS; `docker compose up -d` PASS; `http://127.0.0.1:10000/api/v1/auth/profile` -> `401`.
    63|
    64|## Lessons Learned
    65|- Link: No issue
    66|
    67|## Commit/Push Status
    68|- API repo: `9a9943c` local commit created, push pending in close-out step.
    69|- Web repo (if affected): N/A
    70|- DB/directus staging: N/A
    71|